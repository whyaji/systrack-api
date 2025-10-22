import 'dotenv/config';

import { logger } from '../lib/logger.js';
import ServiceSyncScheduler from './serviceSyncScheduler.js';
class SchedulerManager {
  private serviceSyncScheduler: ServiceSyncScheduler;

  constructor() {
    this.serviceSyncScheduler = new ServiceSyncScheduler();
  }

  public async start(): Promise<void> {
    logger.info('Starting scheduler manager...');

    try {
      await this.serviceSyncScheduler.start();
      logger.info('All schedulers started successfully');
    } catch (error) {
      logger.error(`Error starting schedulers: ${error}`);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    logger.info('Stopping scheduler manager...');

    try {
      await this.serviceSyncScheduler.stop();
      logger.info('All schedulers stopped successfully');
    } catch (error) {
      logger.error(`Error stopping schedulers: ${error}`);
    }
  }

  // Method to manually trigger sync (useful for testing)
  public async triggerManualSync(): Promise<void> {
    await this.serviceSyncScheduler.triggerManualSync();
  }
}

// Handle graceful shutdown
const schedulerManager = new SchedulerManager();

// Start schedulers
schedulerManager.start().catch((error) => {
  logger.error(`Failed to start schedulers: ${error}`);
  process.exit(1);
});

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await schedulerManager.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await schedulerManager.stop();
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
