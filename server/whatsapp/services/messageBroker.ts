import { Redis } from 'ioredis';

import { logger } from '../../lib/logger.js';

export interface TriggerMessage {
  id: string;
  groupName: string;
  message: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'failed';
  retryCount: number;
  maxRetries: number;
}

export interface MessageResult {
  messageId: string;
  success: boolean;
  error?: string;
}

export class MessageBroker {
  private static instance: MessageBroker;
  private messageQueue: Map<string, TriggerMessage> = new Map();
  private isSubscribed: boolean = false;
  private publisher: Redis;
  private subscriber: Redis;

  private constructor() {
    // Create separate Redis connections for pub/sub and regular operations
    this.publisher = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });

    this.subscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
      lazyConnect: true,
    });

    this.subscribeToResults();
  }

  public static getInstance(): MessageBroker {
    if (!MessageBroker.instance) {
      MessageBroker.instance = new MessageBroker();
    }
    return MessageBroker.instance;
  }

  public async sendTriggerToGroup(
    groupName: string,
    message: string,
    imageBuffer?: Buffer
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const messageId = this.generateMessageId();

      const triggerMessage: TriggerMessage = {
        id: messageId,
        groupName,
        message,
        timestamp: new Date(),
        status: 'pending',
        retryCount: 0,
        maxRetries: 3,
      };

      this.messageQueue.set(messageId, triggerMessage);

      // Publish message to bot process
      await this.publisher.publish(
        'whatsapp:trigger:send',
        JSON.stringify({
          type: 'send_to_group',
          messageId,
          groupName,
          message,
          imageBuffer: imageBuffer ? imageBuffer.toString('base64') : undefined,
          timestamp: triggerMessage.timestamp.toISOString(),
        })
      );

      logger.info(`Trigger message ${messageId} queued for group "${groupName}"`);

      // Wait for result with timeout
      const result = await this.waitForResult(messageId, 10000); // 10 second timeout

      return {
        success: result.success,
        messageId: result.success ? messageId : undefined,
        error: result.success ? undefined : result.error || 'Failed to send message to group',
      };
    } catch (error) {
      logger.error(`Error creating trigger message: ${error}`);
      return {
        success: false,
        error: 'Failed to create trigger message',
      };
    }
  }

  public async getAvailableGroups(): Promise<Array<{ name: string; id: string }>> {
    try {
      // Request groups from bot process
      await this.publisher.publish(
        'whatsapp:trigger:request',
        JSON.stringify({
          type: 'get_groups',
        })
      );

      // Wait for response
      const response = await this.waitForGroupsResponse(5000); // 5 second timeout
      return response || [];
    } catch (error) {
      logger.error(`Error getting groups: ${error}`);
      return [];
    }
  }

  public getMessageStatus(messageId: string): TriggerMessage | undefined {
    return this.messageQueue.get(messageId);
  }

  public getAllMessages(): TriggerMessage[] {
    return Array.from(this.messageQueue.values());
  }

  public async retryFailedMessages(): Promise<void> {
    const failedMessages = Array.from(this.messageQueue.values()).filter(
      (msg) => msg.status === 'failed' && msg.retryCount < msg.maxRetries
    );

    for (const message of failedMessages) {
      message.retryCount++;
      message.status = 'pending';

      await this.publisher.publish(
        'whatsapp:trigger:send',
        JSON.stringify({
          type: 'send_to_group',
          messageId: message.id,
          groupName: message.groupName,
          message: message.message,
          timestamp: message.timestamp.toISOString(),
        })
      );
    }
  }

  private async subscribeToResults(): Promise<void> {
    if (this.isSubscribed) return;

    try {
      await this.subscriber.subscribe('whatsapp:trigger:result', 'whatsapp:trigger:groups');

      this.subscriber.on('message', (channel, message) => {
        if (channel === 'whatsapp:trigger:result') {
          this.handleMessageResult(JSON.parse(message));
        } else if (channel === 'whatsapp:trigger:groups') {
          this.handleGroupsResponse(JSON.parse(message));
        }
      });

      this.isSubscribed = true;
      logger.info('MessageBroker subscribed to Redis channels');
    } catch (error) {
      logger.error(`Error subscribing to Redis channels: ${error}`);
    }
  }

  private handleMessageResult(result: MessageResult & { messageId: string }): void {
    const message = this.messageQueue.get(result.messageId);
    if (message) {
      message.status = result.success ? 'sent' : 'failed';

      if (result.success) {
        logger.info(`Message ${result.messageId} sent successfully`);
      } else {
        logger.warn(`Message ${result.messageId} failed: ${result.error}`);
      }
    }
  }

  private handleGroupsResponse(groups: Array<{ name: string; id: string }>): void {
    // Store groups response for waiting requests
    this.groupsResponse = groups;
  }

  private groupsResponse: Array<{ name: string; id: string }> | null = null;

  private async waitForResult(messageId: string, timeout: number): Promise<MessageResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkResult = () => {
        const message = this.messageQueue.get(messageId);

        if (message && message.status !== 'pending') {
          resolve({
            messageId,
            success: message.status === 'sent',
            error: message.status === 'failed' ? 'Message failed to send' : undefined,
          });
          return;
        }

        if (Date.now() - startTime > timeout) {
          resolve({
            messageId,
            success: false,
            error: 'Timeout waiting for result',
          });
          return;
        }

        setTimeout(checkResult, 100);
      };

      checkResult();
    });
  }

  private async waitForGroupsResponse(
    timeout: number
  ): Promise<Array<{ name: string; id: string }> | null> {
    return new Promise((resolve) => {
      const startTime = Date.now();

      const checkResponse = () => {
        if (this.groupsResponse !== null) {
          const response = this.groupsResponse;
          this.groupsResponse = null;
          resolve(response);
          return;
        }

        if (Date.now() - startTime > timeout) {
          resolve(null);
          return;
        }

        setTimeout(checkResponse, 100);
      };

      checkResponse();
    });
  }

  private generateMessageId(): string {
    return `trigger_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  public async cleanupOldMessages(maxAgeHours: number = 24): Promise<void> {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    for (const [messageId, message] of this.messageQueue.entries()) {
      if (message.timestamp < cutoffTime) {
        this.messageQueue.delete(messageId);
      }
    }
  }
}
