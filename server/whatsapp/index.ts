import * as fs from 'fs';
import { Redis } from 'ioredis';
import * as path from 'path';
import * as qrcode from 'qrcode-terminal';
import { Client, LocalAuth } from 'whatsapp-web.js';

import env from '../lib/env.js';
import { logger } from '../lib/logger.js';
import { WhatsAppBot } from './bot.js';

// Session management utilities
function clearSessionData() {
  try {
    const sessionPath = path.join(env.WHATSAPP_SESSION_PATH, 'session-systrack-whatsapp-bot');
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      logger.info('Session data cleared successfully');
    }
  } catch (error) {
    logger.error(`Error clearing session data: ${error}`);
  }
}

function validateSessionExists(): boolean {
  try {
    const sessionPath = path.join(env.WHATSAPP_SESSION_PATH, 'session-systrack-whatsapp-bot');
    return fs.existsSync(sessionPath) && fs.existsSync(path.join(sessionPath, 'Default'));
  } catch (error) {
    logger.error(`Error validating session: ${error}`);
    return false;
  }
}

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
              `Chart for ${data.groupName} for detail service`
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
  // Clear session data on auth failure
  clearSessionData();
});

client.on('disconnected', (reason) => {
  logger.warn(`WhatsApp bot disconnected: ${reason}`);
  bot.setReady(false);

  // If disconnected due to logout, clear session data
  if (reason === 'LOGOUT') {
    clearSessionData();
  }
});

client.on('message', async (message) => {
  try {
    await bot.handleMessage(message);
  } catch (error) {
    logger.error(`Error handling message: ${error}`);
  }
});

// Graceful shutdown function
async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down WhatsApp bot gracefully...`);

  try {
    // Set bot as not ready
    bot.setReady(false);

    // Logout from WhatsApp before destroying client
    if (client.info) {
      logger.info('Logging out from WhatsApp...');
      await client.logout();
    }

    // Destroy the client
    await client.destroy();

    // Close Redis connections
    await subscriber.quit();
    await publisher.quit();

    logger.info('WhatsApp bot shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error(`Error during graceful shutdown: ${error}`);
    process.exit(1);
  }
}

// Start the bot
async function startBot() {
  try {
    // Check if session exists and is valid
    const sessionExists = validateSessionExists();
    if (sessionExists) {
      logger.info('Existing session found, attempting to restore...');
    } else {
      logger.info('No valid session found, will require QR code scan');
    }

    await client.initialize();
  } catch (error) {
    logger.error(`Failed to initialize WhatsApp client: ${error}`);
    process.exit(1);
  }
}

// Start the bot
startBot();

// Graceful shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error}`);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  gracefulShutdown('unhandledRejection');
});
