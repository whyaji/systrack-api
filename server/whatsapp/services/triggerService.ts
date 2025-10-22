import { CommandHandler } from '../commands/commandHandler.js';
import { HealthChecker } from './healthChecker.js';
import { MessageBroker } from './messageBroker.js';
import { ServiceManager } from './serviceManager.js';

export interface TriggerMessage {
  id: string;
  groupName: string;
  message: string;
  timestamp: Date;
  status: 'pending' | 'sent' | 'failed';
  retryCount: number;
  maxRetries: number;
}

export class TriggerService {
  private messageBroker: MessageBroker;
  private serviceManager: ServiceManager;
  private healthChecker: HealthChecker;
  private commandHandler: CommandHandler;

  constructor() {
    this.messageBroker = MessageBroker.getInstance();
    this.serviceManager = new ServiceManager();
    this.healthChecker = new HealthChecker();
    this.commandHandler = new CommandHandler(this.serviceManager, this.healthChecker);
  }

  public async sendTriggerToGroup(
    groupName: string,
    message: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    return await this.messageBroker.sendTriggerToGroup(groupName, message);
  }

  public async sendTriggerCommandToGroup(
    groupName: string,
    command: string
  ): Promise<{ success: boolean; messageId?: string; error?: string; imageBuffer?: Buffer }> {
    const response = await this.commandHandler.handleCommand(command);
    if (!response) {
      return { success: false, error: 'Failed to handle command.' };
    }

    // Send message with optional image
    const result = await this.messageBroker.sendTriggerToGroup(
      groupName,
      response.text + `\n\n_Response for ${groupName} from SysTrack WhatsApp Bot_`,
      response.imageBuffer
    );

    return result;
  }

  public async getAvailableGroups(): Promise<Array<{ name: string; id: string }>> {
    return await this.messageBroker.getAvailableGroups();
  }

  public getMessageStatus(messageId: string): TriggerMessage | undefined {
    return this.messageBroker.getMessageStatus(messageId);
  }

  public getAllMessages(): TriggerMessage[] {
    return this.messageBroker.getAllMessages();
  }

  public async retryFailedMessages(): Promise<void> {
    return await this.messageBroker.retryFailedMessages();
  }

  public async cleanupOldMessages(maxAgeHours: number = 24): Promise<void> {
    return await this.messageBroker.cleanupOldMessages(maxAgeHours);
  }
}
