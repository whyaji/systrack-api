import { Job, Worker } from 'bullmq';
import { and, eq, inArray, isNull } from 'drizzle-orm';

import { db } from '../db/database.js';
import { serviceLogsTable, servicesTable } from '../db/schema/schema.js';
import { logger } from '../lib/logger.js';
import { ServiceSyncJobData } from '../lib/queue.js';
import { redis } from '../lib/redis.js';
import { SERVICE_TYPE, SharedHostingHistoryResponse } from '../types/service.type.js';

class ServiceSyncWorker {
  private worker: Worker;

  constructor() {
    this.worker = new Worker('systrack-service-sync', this.processServiceSyncJob.bind(this), {
      connection: redis,
      concurrency: 5,
    });

    this.setupEventHandlers();
  }

  private async processServiceSyncJob(job: Job<ServiceSyncJobData>): Promise<void> {
    const { serviceId, serviceName } = job.data;

    logger.info(`Processing service sync for service: ${serviceName} (ID: ${serviceId})`);

    try {
      // Check if service still exists and is active
      const services = await db
        .select()
        .from(servicesTable)
        .where(and(eq(servicesTable.id, serviceId), isNull(servicesTable.deletedAt)));

      if (services.length === 0) {
        logger.warn(`Service with ID ${serviceId} not found or deleted`);
        return;
      }

      const service = services[0];

      // Only sync shared hosting services
      if (service.type !== SERVICE_TYPE.SHARED_HOSTING) {
        logger.info(`Service ${serviceName} is not a shared hosting service, skipping sync`);
        return;
      }

      // Check if service is active
      if (service.status === 0) {
        logger.info(`Service ${serviceName} is inactive, skipping sync`);
        return;
      }

      // Fetch history from res status API
      const history = await fetch(`${service.resStatusApiUrl}/resource-usage/history`, {
        headers: {
          'x-api-key': service.resStatusApiKey,
        },
      });

      if (!history.ok) {
        throw new Error(`Failed to fetch history from res status API. Status: ${history.status}`);
      }

      const historyData: SharedHostingHistoryResponse = await history.json();

      if (!historyData.success) {
        throw new Error('Failed to fetch history from res status API: API returned success=false');
      }

      const historyDataList = historyData.data;
      logger.info(`Fetched ${historyDataList.length} records for service ${serviceName}`);

      if (historyDataList.length === 0) {
        logger.info(`No new data to sync for service ${serviceName}`);
        return;
      }

      const listRecordIds = historyDataList.map((historyData) => historyData.id);

      // Get list of existing record IDs from service logs table
      const existingRecordIds = await db
        .select({ recordId: serviceLogsTable.recordId })
        .from(serviceLogsTable)
        .where(
          and(
            eq(serviceLogsTable.serviceId, service.id),
            inArray(serviceLogsTable.recordId, listRecordIds),
            isNull(serviceLogsTable.deletedAt)
          )
        );

      // Filter records that are not already in the database
      const newRecords = historyDataList.filter(
        (record) => !existingRecordIds.some((existing) => existing.recordId === record.id)
      );

      if (newRecords.length === 0) {
        logger.info(`No new records to insert for service ${serviceName}`);
        return;
      }

      // Prepare data for insertion
      const valuesToInsert = newRecords.map((record) => ({
        serviceId: service.id,
        recordId: record.id,
        data: record,
        recordedAt: new Date(record.checked_at),
      }));

      // Insert new records
      await db.insert(serviceLogsTable).values(valuesToInsert);

      logger.info(
        `Successfully synced ${newRecords.length} new records for service ${serviceName}`
      );

      // Update job progress
      await job.updateProgress(100);
    } catch (error) {
      logger.error(`Error syncing service ${serviceName}: ${error}`);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    this.worker.on('ready', () => {
      logger.info('Service sync worker is ready');
    });

    this.worker.on('error', (error) => {
      logger.error(`Service sync worker error: ${error}`);
    });

    this.worker.on('failed', (job, err) => {
      logger.error(`Service sync job ${job?.id} failed: ${err.message}`);
    });

    this.worker.on('completed', (job) => {
      logger.info(`Service sync job ${job.id} completed successfully`);
    });

    this.worker.on('stalled', (jobId) => {
      logger.warn(`Service sync job ${jobId} stalled`);
    });
  }

  public async start(): Promise<void> {
    logger.info('Starting service sync worker...');
    // Worker is automatically started when created
  }

  public async stop(): Promise<void> {
    logger.info('Stopping service sync worker...');
    await this.worker.close();
  }
}

export default ServiceSyncWorker;
