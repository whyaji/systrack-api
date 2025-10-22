import { Queue } from 'bullmq';

import { logger } from './logger.js';
import { redis } from './redis.js';

// Job types
export interface ServiceSyncJobData {
  serviceId: number;
  serviceName: string;
  serviceType: number;
  resStatusApiUrl: string;
  resStatusApiKey: string;
}

export interface WhatsAppMessageJobData {
  groupName: string;
  message: string;
  messageId?: string;
  timestamp: string;
}

export interface WhatsAppCommandJobData {
  groupName: string;
  command: string;
  messageId?: string;
  timestamp: string;
}

// Queue names
export const QUEUE_NAMES = {
  SERVICE_SYNC: 'systrack-service-sync',
  WHATSAPP_MESSAGE: 'systrack-whatsapp-message',
  WHATSAPP_COMMAND: 'systrack-whatsapp-command',
} as const;

// Create queues
const serviceSyncQueue = new Queue(QUEUE_NAMES.SERVICE_SYNC, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

const whatsappMessageQueue = new Queue(QUEUE_NAMES.WHATSAPP_MESSAGE, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 20,
    removeOnFail: 10,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

const whatsappCommandQueue = new Queue(QUEUE_NAMES.WHATSAPP_COMMAND, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 20,
    removeOnFail: 10,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

// Queue event handlers
serviceSyncQueue.on('error', (error: Error) => {
  logger.error(`Service sync queue error: ${error}`);
});

whatsappMessageQueue.on('error', (error: Error) => {
  logger.error(`WhatsApp message queue error: ${error}`);
});

whatsappCommandQueue.on('error', (error: Error) => {
  logger.error(`WhatsApp command queue error: ${error}`);
});

export { serviceSyncQueue, whatsappCommandQueue, whatsappMessageQueue };
