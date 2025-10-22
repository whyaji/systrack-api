import { and, eq, isNull } from 'drizzle-orm';
import * as cron from 'node-cron';

import { db } from '../db/database.js';
import { servicesTable } from '../db/schema/schema.js';
import { logger } from '../lib/logger.js';
import { SERVICE_TYPE } from '../types/service.type.js';
import { WhatsAppQueueService } from '../whatsapp/services/whatsappQueueService.js';

class ServiceWhatsappScheduler {
  private cronTask: cron.ScheduledTask | null = null;
  private isRunning = false;
  private whatsappQueueService: WhatsAppQueueService;

  constructor() {
    this.setupCronJob();
    this.whatsappQueueService = new WhatsAppQueueService();
  }

  private setupCronJob(): void {
    // Run daily at 6:45 AM
    const cronExpression = '45 6 * * *'; // minute hour day month dayOfWeek

    // For testing, you can use: '*/5 * * * *' (every 5 minutes)
    // const cronExpression = '*/5 * * * *';

    this.cronTask = cron.schedule(cronExpression, this.scheduleServiceWhatsappJobs.bind(this), {
      timezone: 'Asia/Jakarta', // You can change this to your preferred timezone
    });

    logger.info(`Service whatsapp scheduler configured with cron: ${cronExpression}`);
  }

  private async scheduleServiceWhatsappJobs(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Service whatsapp scheduler is already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    logger.info('Starting scheduled service whatsapp jobs...');

    try {
      // Get all active services that are configured for send whatsapp
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

      logger.info(`Found ${services.length} services to send whatsapp messages`);

      if (services.length === 0) {
        logger.info('No services found for send whatsapp messages');
        return;
      }

      // Create jobs for each service
      const jobs = await Promise.allSettled(
        services.map(async (service) => {
          // Add job to queue with delay to prevent overwhelming the API
          const delay = 0;

          const job = await this.whatsappQueueService.queueCommand(
            'Digital Architect',
            `!systrack service-status ${service.id}`,
            delay
          );

          logger.info(
            `Scheduled sync job for service ${service.name} (ID: ${service.id}) with delay ${delay}ms`
          );
          return job;
        })
      );

      // Log results
      const successful = jobs.filter((result) => result.status === 'fulfilled').length;
      const failed = jobs.filter((result) => result.status === 'rejected').length;

      logger.info(
        `Service whatsapp scheduling completed: ${successful} successful, ${failed} failed`
      );

      if (failed > 0) {
        const failedJobs = jobs
          .filter((result) => result.status === 'rejected')
          .map((result) => (result as PromiseRejectedResult).reason);

        logger.error(`Failed to schedule some jobs: ${failedJobs}`);
      }
    } catch (error) {
      logger.error(`Error in scheduled service whatsapp: ${error}`);
    } finally {
      this.isRunning = false;
    }
  }

  public async start(): Promise<void> {
    logger.info('Starting service whatsapp scheduler...');

    if (this.cronTask) {
      this.cronTask.start();
      logger.info('Cron-based scheduler started');
    }

    // For development/testing, you can manually trigger the job
    if (process.env.NODE_ENV === 'development') {
      logger.info('Development mode: You can manually trigger whatsapp jobs via API endpoint');
    }
  }

  public async stop(): Promise<void> {
    logger.info('Stopping service whatsapp scheduler...');
    if (this.cronTask) {
      this.cronTask.stop();
      this.cronTask = null;
    }
  }

  // Method to manually trigger send whatsapp for all services (useful for testing)
  public async triggerManualSendWhatsapp(): Promise<void> {
    logger.info('Manually triggering service whatsapp...');
    await this.scheduleServiceWhatsappJobs();
  }
}

export default ServiceWhatsappScheduler;
