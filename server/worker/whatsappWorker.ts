import { Job, Worker } from 'bullmq';

import { logger } from '../lib/logger.js';
import { WhatsAppCommandJobData, WhatsAppMessageJobData } from '../lib/queue.js';
import { redis } from '../lib/redis.js';
import { TriggerService } from '../whatsapp/services/triggerService.js';

class WhatsAppWorker {
  private messageWorker: Worker;
  private commandWorker: Worker;
  private triggerService: TriggerService;

  constructor() {
    this.triggerService = new TriggerService();

    this.messageWorker = new Worker(
      'systrack-whatsapp-message',
      this.processMessageJob.bind(this),
      {
        connection: redis,
        concurrency: 3,
      }
    );

    this.commandWorker = new Worker(
      'systrack-whatsapp-command',
      this.processCommandJob.bind(this),
      {
        connection: redis,
        concurrency: 2,
      }
    );

    this.setupEventHandlers();
  }

  private async processMessageJob(job: Job<WhatsAppMessageJobData>): Promise<void> {
    const { groupName, message, messageId } = job.data;

    logger.info(`Processing WhatsApp message job for group: ${groupName}, messageId: ${messageId}`);

    try {
      const result = await this.triggerService.sendTriggerToGroup(groupName, message);

      if (result.success) {
        logger.info(
          `WhatsApp message sent successfully to group: ${groupName}, messageId: ${result.messageId}`
        );
        job.updateProgress(100);
      } else {
        logger.error(
          `Failed to send WhatsApp message to group: ${groupName}, error: ${result.error}`
        );
        throw new Error(result.error || 'Failed to send message');
      }
    } catch (error) {
      logger.error(`Error processing WhatsApp message job: ${error}`);
      throw error;
    }
  }

  private async processCommandJob(job: Job<WhatsAppCommandJobData>): Promise<void> {
    const { groupName, command, messageId } = job.data;

    logger.info(
      `Processing WhatsApp command job for group: ${groupName}, command: ${command}, messageId: ${messageId}`
    );

    try {
      const result = await this.triggerService.sendTriggerCommandToGroup(groupName, command);

      if (result.success) {
        logger.info(
          `WhatsApp command sent successfully to group: ${groupName}, messageId: ${result.messageId}`
        );
        job.updateProgress(100);
      } else {
        logger.error(
          `Failed to send WhatsApp command to group: ${groupName}, error: ${result.error}`
        );
        throw new Error(result.error || 'Failed to send command');
      }
    } catch (error) {
      logger.error(`Error processing WhatsApp command job: ${error}`);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    // Message worker event handlers
    this.messageWorker.on('completed', (job) => {
      logger.info(`WhatsApp message job completed: ${job.id}`);
    });

    this.messageWorker.on('failed', (job, err) => {
      logger.error(`WhatsApp message job failed: ${job?.id}, error: ${err.message}`);
    });

    this.messageWorker.on('error', (err) => {
      logger.error(`WhatsApp message worker error: ${err.message}`);
    });

    // Command worker event handlers
    this.commandWorker.on('completed', (job) => {
      logger.info(`WhatsApp command job completed: ${job.id}`);
    });

    this.commandWorker.on('failed', (job, err) => {
      logger.error(`WhatsApp command job failed: ${job?.id}, error: ${err.message}`);
    });

    this.commandWorker.on('error', (err) => {
      logger.error(`WhatsApp command worker error: ${err.message}`);
    });
  }

  public async start(): Promise<void> {
    logger.info('Starting WhatsApp workers...');

    try {
      await this.messageWorker.waitUntilReady();
      await this.commandWorker.waitUntilReady();
      logger.info('WhatsApp workers started successfully');
    } catch (error) {
      logger.error(`Error starting WhatsApp workers: ${error}`);
      throw error;
    }
  }

  public async stop(): Promise<void> {
    logger.info('Stopping WhatsApp workers...');

    try {
      await this.messageWorker.close();
      await this.commandWorker.close();
      logger.info('WhatsApp workers stopped successfully');
    } catch (error) {
      logger.error(`Error stopping WhatsApp workers: ${error}`);
      throw error;
    }
  }
}

export default WhatsAppWorker;
