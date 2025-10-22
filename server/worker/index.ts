import 'dotenv/config';

import { logger } from '../lib/logger.js';
import ServiceSyncWorker from './serviceSyncWorker.js';
import WhatsAppWorker from './whatsappWorker.js';

class WorkerManager {
  private serviceSyncWorker: ServiceSyncWorker;
  private whatsappWorker: WhatsAppWorker;

  constructor() {
    this.serviceSyncWorker = new ServiceSyncWorker();
    this.whatsappWorker = new WhatsAppWorker();
  }

  public async start(): Promise<void> {
    logger.info('Starting worker manager...');

    try {
      await this.serviceSyncWorker.start();
      await this.whatsappWorker.start();
      logger.info('All workers started successfully');
    } catch (error) {
      logger.error(`Error starting workers: ${error}`);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    logger.info('Stopping worker manager...');

    try {
      await this.serviceSyncWorker.stop();
      await this.whatsappWorker.stop();
      logger.info('All workers stopped successfully');
    } catch (error) {
      logger.error(`Error stopping workers: ${error}`);
    }
  }
}

// Handle graceful shutdown
const workerManager = new WorkerManager();

// Start workers
workerManager.start().catch((error) => {
  logger.error(`Failed to start workers: ${error}`);
  process.exit(1);
});

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await workerManager.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await workerManager.stop();
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});
