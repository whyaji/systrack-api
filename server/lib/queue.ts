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

// Queue names
export const QUEUE_NAMES = {
  SERVICE_SYNC: 'service-sync',
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

// Queue event handlers
serviceSyncQueue.on('error', (error: Error) => {
  logger.error(`Service sync queue error: ${error}`);
});

export { serviceSyncQueue };
