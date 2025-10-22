import { Redis } from 'ioredis';
import * as qrcode from 'qrcode-terminal';
import { Client, LocalAuth } from 'whatsapp-web.js';

import env from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { WhatsAppBot } from './bot.js';

// Create WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth({
    clientId: 'systrack-whatsapp-bot',
    dataPath: env.WHATSAPP_SESSION_PATH,
  }),
  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
    ],
  },
});

// Initialize bot
const bot = new WhatsAppBot(client);

// Create separate Redis connections for bot process
const subscriber = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

const publisher = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null,
  lazyConnect: true,
});

// Redis message handler for bot process
async function handleRedisMessage(channel: string, message: string) {
  try {
    const data = JSON.parse(message);

    if (channel === 'whatsapp:trigger:send') {
      if (data.type === 'send_to_group') {
        let success = false;

        try {
          // Send text message
          success = await bot.sendMessageToGroup(data.groupName, data.message);

          // Send image if provided
          if (success && data.imageBuffer) {
            const imageBuffer = Buffer.from(data.imageBuffer, 'base64');
            await bot.sendImageToGroup(
              data.groupName,
              imageBuffer,
              `Chart for ${data.groupName} for detail service ${data.serviceName}`
            );
          }
        } catch (error) {
          logger.error(`Error sending message to group: ${error}`);
          success = false;
        }

        // Publish result back
        await publisher.publish(
          'whatsapp:trigger:result',
          JSON.stringify({
            messageId: data.messageId,
            success,
            error: success ? undefined : 'Failed to send message to group',
          })
        );
      }
    } else if (channel === 'whatsapp:trigger:request') {
      if (data.type === 'get_groups') {
        const groups = await bot.getAvailableGroups();

        // Publish groups response
        await publisher.publish('whatsapp:trigger:groups', JSON.stringify(groups));
      }
    }
  } catch (error) {
    logger.error(`Error handling Redis message: ${error}`);
  }
}

// Subscribe to Redis channels
subscriber.subscribe('whatsapp:trigger:send', 'whatsapp:trigger:request');
subscriber.on('message', handleRedisMessage);

// Event handlers
client.on('qr', (qr) => {
  logger.info('QR Code received, scan with WhatsApp mobile app');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  logger.info('WhatsApp bot is ready!');
  bot.setReady(true);
});

client.on('authenticated', () => {
  logger.info('WhatsApp bot authenticated successfully');
});

client.on('auth_failure', (msg) => {
  logger.error(`Authentication failed: ${msg}`);
});

client.on('disconnected', (reason) => {
  logger.warn(`WhatsApp bot disconnected: ${reason}`);
  bot.setReady(false);
});

client.on('message', async (message) => {
  try {
    await bot.handleMessage(message);
  } catch (error) {
    logger.error(`Error handling message: ${error}`);
  }
});

// Start the bot
client.initialize().catch((error) => {
  logger.error(`Failed to initialize WhatsApp client: ${error}`);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down WhatsApp bot...');
  await client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down WhatsApp bot...');
  await client.destroy();
  process.exit(0);
});
