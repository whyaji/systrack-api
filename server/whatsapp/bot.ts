import { Chat, Client, Message, MessageMedia } from 'whatsapp-web.js';

import env from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { CommandHandler } from './commands/commandHandler.js';
import { HealthChecker } from './services/healthChecker.js';
import { ServiceManager } from './services/serviceManager.js';

export class WhatsAppBot {
  private client: Client;
  private isReady: boolean = false;
  private serviceManager: ServiceManager;
  private healthChecker: HealthChecker;
  private commandHandler: CommandHandler;
  private adminPhone: string | undefined;
  private groupsOnly: boolean;

  constructor(client: Client) {
    this.client = client;
    this.serviceManager = new ServiceManager();
    this.healthChecker = new HealthChecker();
    this.commandHandler = new CommandHandler(this.serviceManager, this.healthChecker);
    this.adminPhone = env.WHATSAPP_ADMIN_PHONE;
    this.groupsOnly = env.WHATSAPP_GROUPS_ONLY === 'true';
  }

  public setReady(ready: boolean): void {
    this.isReady = ready;
  }

  public async handleMessage(message: Message): Promise<void> {
    if (!this.isReady) {
      logger.warn('Bot is not ready, ignoring message');
      return;
    }

    // Only process text messages
    if (message.type !== 'chat') {
      return;
    }

    const contact = await message.getContact();
    const chat = await message.getChat();
    const messageBody = message.body.trim().toLowerCase();

    // Only process commands that start with !systrack
    if (!messageBody.startsWith('!systrack')) {
      return;
    }

    // Check if this is a group chat
    const isGroup = chat.isGroup;
    const groupName = isGroup ? chat.name : 'Private Chat';

    if (!['Digital Architect', 'Test bot', 'Harian 8.6'].includes(groupName)) {
      return;
    }

    logger.info(
      `Received message from ${contact.name || contact.number} in ${groupName}: ${messageBody}`
    );

    // Only work in groups - ignore private chats
    if (!isGroup) {
      return;
    }

    // Check if groups are allowed (can be disabled for maintenance)
    if (!this.groupsOnly) {
      await this.sendMessage(chat, 'Sorry, this bot is currently disabled.');
      return;
    }

    // Check if message is from admin (if admin phone is configured)
    if (this.adminPhone && contact.number !== this.adminPhone) {
      // Send private message to non-admin users
      await this.sendPrivateMessage(
        contact.number,
        'Sorry, this bot is only available for administrators.'
      );
      return;
    }

    // Send welcome message for first-time users
    if (
      messageBody === '!systrack' ||
      messageBody === '!systrack hi' ||
      messageBody === '!systrack hello'
    ) {
      const welcomeMsg =
        '🤖 Welcome to SysTrack WhatsApp Bot!\n\nType `!systrack help` to see available commands or `!systrack commands` for a quick list.';
      await this.sendMessage(chat, welcomeMsg);
      return;
    }

    try {
      const response = await this.commandHandler.handleCommand(messageBody);

      // Always respond in the group since we only work in groups
      const groupContext = `\n\n_Response for ${contact.name || contact.number}_`;
      const fullResponse = response.text + groupContext;

      // Send text message
      await this.sendMessage(chat, fullResponse);

      // Send image if available
      if (response.imageBuffer) {
        await this.sendImage(
          chat,
          response.imageBuffer,
          `Service Status Chart - ${contact.name || contact.number}`
        );
      }
    } catch (error) {
      logger.error(`Error handling command: ${error}`);
      const errorMsg = 'Sorry, an error occurred while processing your request.';
      const groupContext = `\n\n_Error for ${contact.name || contact.number}_`;
      await this.sendMessage(chat, errorMsg + groupContext);
    }
  }

  private async sendMessage(chat: Chat, message: string): Promise<void> {
    try {
      await chat.sendMessage(message);
    } catch (error) {
      logger.error(`Error sending message: ${error}`);
    }
  }

  private async sendImage(chat: Chat, imageBuffer: Buffer, caption?: string): Promise<void> {
    try {
      const media = new MessageMedia('image/png', imageBuffer.toString('base64'));
      await chat.sendMessage(media, { caption });
    } catch (error) {
      logger.error(`Error sending image: ${error}`);
    }
  }

  private async sendPrivateMessage(phoneNumber: string, message: string): Promise<void> {
    try {
      const chatId = `${phoneNumber}@c.us`;
      await this.client.sendMessage(chatId, message);
    } catch (error) {
      logger.error(`Error sending private message: ${error}`);
    }
  }

  public async sendMessageToAdmin(message: string): Promise<void> {
    if (!this.adminPhone || !this.isReady) {
      logger.warn('Cannot send message to admin: bot not ready or admin phone not configured');
      return;
    }

    try {
      const chatId = `${this.adminPhone}@c.us`;
      await this.client.sendMessage(chatId, message);
    } catch (error) {
      logger.error(`Error sending message to admin: ${error}`);
    }
  }

  public async sendMessageToGroup(groupName: string, message: string): Promise<boolean> {
    if (!this.isReady) {
      logger.warn('Bot is not ready, cannot send message to group');
      return false;
    }

    try {
      const chats = await this.client.getChats();
      const targetGroup = chats.find(
        (chat) => chat.isGroup && chat.name?.toLowerCase() === groupName.toLowerCase()
      );

      if (!targetGroup) {
        logger.warn(`Group "${groupName}" not found`);
        return false;
      }

      await this.sendMessage(targetGroup, message);
      logger.info(`Message sent to group "${groupName}"`);
      return true;
    } catch (error) {
      logger.error(`Error sending message to group "${groupName}": ${error}`);
      return false;
    }
  }

  public async sendImageToGroup(
    groupName: string,
    imageBuffer: Buffer,
    caption?: string
  ): Promise<boolean> {
    if (!this.isReady) {
      logger.warn('Bot is not ready, cannot send image to group');
      return false;
    }

    try {
      const chats = await this.client.getChats();
      const targetGroup = chats.find(
        (chat) => chat.isGroup && chat.name?.toLowerCase() === groupName.toLowerCase()
      );

      if (!targetGroup) {
        logger.warn(`Group "${groupName}" not found`);
        return false;
      }

      await this.sendImage(targetGroup, imageBuffer, caption);
      logger.info(`Image sent to group "${groupName}"`);
      return true;
    } catch (error) {
      logger.error(`Error sending image to group "${groupName}": ${error}`);
      return false;
    }
  }

  public async getAvailableGroups(): Promise<Array<{ name: string; id: string }>> {
    if (!this.isReady) {
      logger.warn('Bot is not ready, cannot get groups');
      return [];
    }

    try {
      const chats = await this.client.getChats();
      return chats
        .filter((chat) => chat.isGroup)
        .map((chat) => ({
          name: chat.name || 'Unknown',
          id: chat.id._serialized,
        }));
    } catch (error) {
      logger.error(`Error getting groups: ${error}`);
      return [];
    }
  }
}
