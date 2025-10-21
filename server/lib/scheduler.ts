import { and, eq, isNull } from 'drizzle-orm';
import * as cron from 'node-cron';

import { db } from '../db/database.js';
import { servicesTable } from '../db/schema/schema.js';
import { SERVICE_TYPE } from '../types/service.type.js';
import { logger } from './logger.js';
import { ServiceSyncJobData, serviceSyncQueue } from './queue.js';

class ServiceSyncScheduler {
  private cronTask: cron.ScheduledTask | null = null;
  private isRunning = false;

  constructor() {
    this.setupCronJob();
  }

  private setupCronJob(): void {
    // Run daily at 6:30 AM
    const cronExpression = '30 6 * * *'; // minute hour day month dayOfWeek

    // For testing, you can use: '*/5 * * * *' (every 5 minutes)
    // const cronExpression = '*/5 * * * *';

    this.cronTask = cron.schedule(cronExpression, this.scheduleServiceSyncJobs.bind(this), {
      timezone: 'Asia/Jakarta', // You can change this to your preferred timezone
    });

    logger.info(`Service sync scheduler configured with cron: ${cronExpression}`);
  }

  private async scheduleServiceSyncJobs(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Service sync scheduler is already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    logger.info('Starting scheduled service sync jobs...');

    try {
      // Get all active services that are configured for sync
      const services = await db
        .select({
          id: servicesTable.id,
          name: servicesTable.name,
          type: servicesTable.type,
          status: servicesTable.status,
          resStatusApiUrl: servicesTable.resStatusApiUrl,
          resStatusApiKey: servicesTable.resStatusApiKey,
        })
        .from(servicesTable)
        .where(
          and(
            eq(servicesTable.status, 1), // Active services only
            eq(servicesTable.type, SERVICE_TYPE.SHARED_HOSTING), // Only shared hosting services
            isNull(servicesTable.deletedAt)
          )
        );

      logger.info(`Found ${services.length} services to sync`);

      if (services.length === 0) {
        logger.info('No services found for sync');
        return;
      }

      // Create jobs for each service
      const jobs = await Promise.allSettled(
        services.map(async (service) => {
          const jobData: ServiceSyncJobData = {
            serviceId: service.id,
            serviceName: service.name,
            serviceType: service.type,
            resStatusApiUrl: service.resStatusApiUrl,
            resStatusApiKey: service.resStatusApiKey,
          };

          // Add job to queue with delay to prevent overwhelming the API
          const delay = Math.random() * 30000; // Random delay up to 30 seconds

          const job = await serviceSyncQueue.add(`sync-service-${service.id}`, jobData, {
            delay,
            jobId: `daily-sync-${service.id}-${Date.now()}`, // Unique job ID
          });

          logger.info(
            `Scheduled sync job for service ${service.name} (ID: ${service.id}) with delay ${delay}ms`
          );
          return job;
        })
      );

      // Log results
      const successful = jobs.filter((result) => result.status === 'fulfilled').length;
      const failed = jobs.filter((result) => result.status === 'rejected').length;

      logger.info(`Service sync scheduling completed: ${successful} successful, ${failed} failed`);

      if (failed > 0) {
        const failedJobs = jobs
          .filter((result) => result.status === 'rejected')
          .map((result) => (result as PromiseRejectedResult).reason);

        logger.error(`Failed to schedule some jobs: ${failedJobs}`);
      }
    } catch (error) {
      logger.error(`Error in scheduled service sync: ${error}`);
    } finally {
      this.isRunning = false;
    }
  }

  public async start(): Promise<void> {
    logger.info('Starting service sync scheduler...');

    if (this.cronTask) {
      this.cronTask.start();
      logger.info('Cron-based scheduler started');
    }

    // For development/testing, you can manually trigger the job
    if (process.env.NODE_ENV === 'development') {
      logger.info('Development mode: You can manually trigger sync jobs via API endpoint');
    }
  }

  public async stop(): Promise<void> {
    logger.info('Stopping service sync scheduler...');
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }
  }

  // Method to manually trigger sync for all services (useful for testing)
  public async triggerManualSync(): Promise<void> {
    logger.info('Manually triggering service sync...');
    await this.scheduleServiceSyncJobs();
  }
}

export default ServiceSyncScheduler;
