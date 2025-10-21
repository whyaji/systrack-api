import { zValidator } from '@hono/zod-validator';
import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { db } from '../db/database.js';
import { servicesTable } from '../db/schema/schema.js';
import { logger } from '../lib/logger.js';
import { ServiceSyncJobData, serviceSyncQueue } from '../lib/queue.js';
import authMiddleware from '../middleware/jwt.js';
import { SERVICE_TYPE } from '../types/service.type.js';

const syncRoute = new Hono().use(authMiddleware);

// Manual sync all services endpoint
syncRoute.post('/all', async (c) => {
  try {
    logger.info('Manual sync all services triggered via API');

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

    if (services.length === 0) {
      return c.json({
        success: true,
        message: 'No services found for sync',
        data: { scheduledJobs: 0 },
      });
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

        const job = await serviceSyncQueue.add(`manual-sync-service-${service.id}`, jobData, {
          jobId: `manual-sync-${service.id}-${Date.now()}`,
        });

        return {
          serviceId: service.id,
          serviceName: service.name,
          jobId: job.id,
        };
      })
    );

    // Count successful and failed jobs
    const successfulJobs = jobs
      .filter((result) => result.status === 'fulfilled')
      .map(
        (result) =>
          (
            result as PromiseFulfilledResult<{
              serviceId: number;
              serviceName: string;
              jobId: string;
            }>
          ).value
      );

    const failedJobs = jobs.filter((result) => result.status === 'rejected').length;

    logger.info(`Manual sync completed: ${successfulJobs.length} successful, ${failedJobs} failed`);

    return c.json({
      success: true,
      message: `Manual sync triggered for ${successfulJobs.length} services`,
      data: {
        scheduledJobs: successfulJobs.length,
        failedJobs,
        services: successfulJobs,
      },
    });
  } catch (error) {
    logger.error(`Error in manual sync: ${error}`);
    return c.json(
      {
        success: false,
        message: 'Internal server error',
      },
      500
    );
  }
});

// Manual sync specific service endpoint
syncRoute.post(
  '/service/:id',
  zValidator(
    'param',
    z.object({
      id: z
        .string()
        .transform((val) => parseInt(val, 10))
        .pipe(z.number().int().positive()),
    })
  ),
  async (c) => {
    try {
      const { id } = c.req.valid('param');

      // Get the specific service
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
            eq(servicesTable.id, id),
            eq(servicesTable.status, 1),
            eq(servicesTable.type, SERVICE_TYPE.SHARED_HOSTING),
            isNull(servicesTable.deletedAt)
          )
        );

      if (services.length === 0) {
        return c.json(
          {
            success: false,
            message: 'Service not found or not configured for sync',
          },
          404
        );
      }

      const service = services[0];

      const jobData: ServiceSyncJobData = {
        serviceId: service.id,
        serviceName: service.name,
        serviceType: service.type,
        resStatusApiUrl: service.resStatusApiUrl,
        resStatusApiKey: service.resStatusApiKey,
      };

      const job = await serviceSyncQueue.add(`manual-sync-service-${service.id}`, jobData, {
        jobId: `manual-sync-${service.id}-${Date.now()}`,
      });

      logger.info(`Manual sync triggered for service: ${service.name} (ID: ${service.id})`);

      return c.json({
        success: true,
        message: `Manual sync triggered for service: ${service.name}`,
        data: {
          serviceId: service.id,
          serviceName: service.name,
          jobId: job.id,
        },
      });
    } catch (error) {
      logger.error(`Error in manual sync for service ${c.req.valid('param').id}: ${error}`);
      return c.json(
        {
          success: false,
          message: 'Internal server error',
        },
        500
      );
    }
  }
);

// Get queue status endpoint
syncRoute.get('/status', async (c) => {
  try {
    const waiting = await serviceSyncQueue.getWaiting();
    const active = await serviceSyncQueue.getActive();
    const completed = await serviceSyncQueue.getCompleted();
    const failed = await serviceSyncQueue.getFailed();

    return c.json({
      success: true,
      data: {
        queue: 'service-sync',
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        jobs: {
          waiting: waiting.map((job) => ({ id: job.id, name: job.name, data: job.data })),
          active: active.map((job) => ({ id: job.id, name: job.name, data: job.data })),
          failed: failed.map((job) => ({ id: job.id, name: job.name, error: job.failedReason })),
        },
      },
    });
  } catch (error) {
    logger.error(`Error getting queue status: ${error}`);
    return c.json(
      {
        success: false,
        message: 'Internal server error',
      },
      500
    );
  }
});

export default syncRoute;
