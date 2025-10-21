import { zValidator } from '@hono/zod-validator';
import { asc, desc, inArray, isNull, like, or } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { and } from 'drizzle-orm';
import { ne } from 'drizzle-orm';
import { count } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

import { db } from '../db/database.js';
import { serviceLogsTable, servicesTable } from '../db/schema/schema.js';
import { logger } from '../lib/logger.js';
import {
  createPaginationResponse,
  getPaginationParams,
  paginationSchema,
} from '../lib/pagination.js';
import authMiddleware from '../middleware/jwt.js';
import { SERVICE_TYPE, SharedHostingHistoryResponse } from '../types/service.type.js';

// Validation schemas
const createServiceSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  description: z.string().min(3, 'Description must be at least 3 characters'),
  type: z
    .number()
    .int()
    .min(1)
    .max(3, 'Type must be between 1-3 (1: server, 2: vps, 3: shared hosting)'),
  status: z
    .number()
    .int()
    .min(0)
    .max(1, 'Status must be 0 or 1 (0: inactive, 1: active)')
    .optional(),
  resStatusApiUrl: z.string().url('Invalid API URL format'),
  resStatusApiKey: z.string().min(1, 'API key is required'),
});

const updateServiceSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').optional(),
  description: z.string().min(3, 'Description must be at least 3 characters').optional(),
  type: z
    .number()
    .int()
    .min(1)
    .max(3, 'Type must be between 1-3 (1: server, 2: vps, 3: shared hosting)')
    .optional(),
  status: z
    .number()
    .int()
    .min(0)
    .max(1, 'Status must be 0 or 1 (0: inactive, 1: active)')
    .optional(),
  resStatusApiUrl: z.url('Invalid API URL format').optional(),
  resStatusApiKey: z.string().min(1, 'API key is required').optional(),
});

const serviceIdSchema = z.object({
  id: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive()),
});

// for service management CRUD
export const serviceRoute = new Hono()
  .use(authMiddleware)
  // Create service
  .post('/', zValidator('json', createServiceSchema), async (c) => {
    try {
      const {
        name,
        description,
        type,
        status = 1,
        resStatusApiUrl,
        resStatusApiKey,
      } = c.req.valid('json');

      // Check if service with name already exists
      const existingService = await db
        .select()
        .from(servicesTable)
        .where(eq(servicesTable.name, name));

      if (existingService.length > 0) {
        return c.json({ message: 'Service with this name already exists.' }, 400);
      }

      // Create service
      await db.insert(servicesTable).values({
        name,
        description,
        type,
        status,
        resStatusApiUrl,
        resStatusApiKey,
      });

      const newService = await db.select().from(servicesTable).where(eq(servicesTable.name, name));

      if (!newService[0]) {
        return c.json({ message: 'Failed to create service.' }, 500);
      }

      return c.json(
        {
          success: true,
          message: 'Service created successfully.',
          data: newService[0],
        },
        201
      );
    } catch (error) {
      logger.error(`Error creating service: ${error}`);
      return c.json({ message: 'Internal server error.' }, 500);
    }
  })
  // Get all services with pagination, search, and sorting
  .get('/', zValidator('query', paginationSchema), async (c) => {
    try {
      const { page, limit, search, sort_by, order } = c.req.valid('query');
      const { offset } = getPaginationParams(page, limit);

      // Build search conditions
      const searchConditions = search
        ? or(
            like(servicesTable.name, `%${search}%`),
            like(servicesTable.description, `%${search}%`)
          )
        : undefined;

      // Build where clause
      const whereClause = searchConditions
        ? and(isNull(servicesTable.deletedAt), searchConditions)
        : isNull(servicesTable.deletedAt);

      // Get total count of services
      const totalResult = await db
        .select({ count: count() })
        .from(servicesTable)
        .where(whereClause);

      const total = totalResult[0].count;

      // Build order by clause
      const orderBy =
        order === 'desc'
          ? desc(servicesTable[sort_by as keyof typeof servicesTable.$inferSelect])
          : asc(servicesTable[sort_by as keyof typeof servicesTable.$inferSelect]);

      // Get paginated services
      const services = await db
        .select({
          id: servicesTable.id,
          name: servicesTable.name,
          description: servicesTable.description,
          type: servicesTable.type,
          status: servicesTable.status,
          resStatusApiUrl: servicesTable.resStatusApiUrl,
          resStatusApiKey: servicesTable.resStatusApiKey,
          createdAt: servicesTable.createdAt,
          updatedAt: servicesTable.updatedAt,
        })
        .from(servicesTable)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset);

      const response = createPaginationResponse(
        services,
        total,
        page,
        limit,
        search || '',
        sort_by,
        order
      );

      return c.json(response);
    } catch (error) {
      logger.error(`Error fetching services: ${error}`);
      return c.json({ message: 'Internal server error.' }, 500);
    }
  })
  // Get service by ID
  .get('/:id', zValidator('param', serviceIdSchema), async (c) => {
    try {
      const { id } = c.req.valid('param');

      const service = await db
        .select({
          id: servicesTable.id,
          name: servicesTable.name,
          description: servicesTable.description,
          type: servicesTable.type,
          status: servicesTable.status,
          resStatusApiUrl: servicesTable.resStatusApiUrl,
          resStatusApiKey: servicesTable.resStatusApiKey,
          createdAt: servicesTable.createdAt,
          updatedAt: servicesTable.updatedAt,
        })
        .from(servicesTable)
        .where(and(eq(servicesTable.id, id), isNull(servicesTable.deletedAt)));

      if (service.length === 0) {
        return c.json({ message: 'Service not found.' }, 404);
      }

      return c.json({
        success: true,
        data: service[0],
      });
    } catch (error) {
      logger.error(`Error fetching service: ${error}`);
      return c.json({ message: 'Internal server error.' }, 500);
    }
  })
  // Update service
  .put(
    '/:id',
    zValidator('param', serviceIdSchema),
    zValidator('json', updateServiceSchema),
    async (c) => {
      try {
        const { id } = c.req.valid('param');
        const updateData = c.req.valid('json');

        // Check if service exists
        const existingService = await db
          .select()
          .from(servicesTable)
          .where(and(eq(servicesTable.id, id), isNull(servicesTable.deletedAt)));

        if (existingService.length === 0) {
          return c.json({ message: 'Service not found.' }, 404);
        }

        // Check if name is being updated and if it already exists
        if (updateData.name && updateData.name !== existingService[0].name) {
          const nameExists = await db
            .select()
            .from(servicesTable)
            .where(and(eq(servicesTable.name, updateData.name), ne(servicesTable.id, id)));

          if (nameExists.length > 0) {
            return c.json({ message: 'Service name already exists.' }, 400);
          }
        }

        // Prepare update data
        const updateValues: Partial<typeof servicesTable.$inferSelect> = {
          updatedAt: new Date(),
        };

        if (updateData.name) {
          updateValues.name = updateData.name;
        }

        if (updateData.description) {
          updateValues.description = updateData.description;
        }

        if (updateData.type !== undefined) {
          updateValues.type = updateData.type;
        }

        if (updateData.status !== undefined) {
          updateValues.status = updateData.status;
        }

        if (updateData.resStatusApiUrl) {
          updateValues.resStatusApiUrl = updateData.resStatusApiUrl;
        }

        if (updateData.resStatusApiKey) {
          updateValues.resStatusApiKey = updateData.resStatusApiKey;
        }

        // Update service
        await db.update(servicesTable).set(updateValues).where(eq(servicesTable.id, id));

        const updatedService = await db
          .select()
          .from(servicesTable)
          .where(eq(servicesTable.id, id));

        if (updatedService.length === 0) {
          return c.json({ message: 'Failed to update service.' }, 500);
        }

        return c.json({
          success: true,
          message: 'Service updated successfully.',
          data: updatedService[0],
        });
      } catch (error) {
        logger.error(`Error updating service: ${error}`);
        return c.json({ message: 'Internal server error.' }, 500);
      }
    }
  )
  // Delete service (soft delete)
  .delete('/:id', zValidator('param', serviceIdSchema), async (c) => {
    try {
      const { id } = c.req.valid('param');

      // Check if service exists
      const existingService = await db
        .select()
        .from(servicesTable)
        .where(and(eq(servicesTable.id, id), isNull(servicesTable.deletedAt)));

      if (existingService.length === 0) {
        return c.json({ message: 'Service not found.' }, 404);
      }

      // Soft delete service
      await db
        .update(servicesTable)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(servicesTable.id, id));

      return c.json({
        success: true,
        message: 'Service deleted successfully.',
      });
    } catch (error) {
      logger.error(`Error deleting service: ${error}`);
      return c.json({ message: 'Internal server error.' }, 500);
    }
  })

  // Get service logs by service ID with pagination
  .get(
    '/:id/logs',
    zValidator('param', serviceIdSchema),
    zValidator('query', paginationSchema),
    async (c) => {
      try {
        const { id } = c.req.valid('param');
        const { page, limit, sort_by, order } = c.req.valid('query');
        const { offset } = getPaginationParams(page, limit);

        // Check if service exists
        const service = await db
          .select()
          .from(servicesTable)
          .where(and(eq(servicesTable.id, id), isNull(servicesTable.deletedAt)));

        if (service.length === 0) {
          return c.json({ message: 'Service not found.' }, 404);
        }

        // Get total count of service logs
        const totalResult = await db
          .select({ count: count() })
          .from(serviceLogsTable)
          .where(and(eq(serviceLogsTable.serviceId, id), isNull(serviceLogsTable.deletedAt)));

        const total = totalResult[0].count;

        // Build order by clause
        const orderBy =
          order === 'desc'
            ? desc(serviceLogsTable[sort_by as keyof typeof serviceLogsTable.$inferSelect])
            : asc(serviceLogsTable[sort_by as keyof typeof serviceLogsTable.$inferSelect]);

        // Get paginated service logs
        const serviceLogs = await db
          .select({
            id: serviceLogsTable.id,
            serviceId: serviceLogsTable.serviceId,
            data: serviceLogsTable.data,
            recordId: serviceLogsTable.recordId,
            recordedAt: serviceLogsTable.recordedAt,
            createdAt: serviceLogsTable.createdAt,
            updatedAt: serviceLogsTable.updatedAt,
          })
          .from(serviceLogsTable)
          .where(and(eq(serviceLogsTable.serviceId, id), isNull(serviceLogsTable.deletedAt)))
          .orderBy(orderBy)
          .limit(limit)
          .offset(offset);

        const response = createPaginationResponse(
          serviceLogs,
          total,
          page,
          limit,
          '',
          sort_by,
          order
        );

        return c.json(response);
      } catch (error) {
        logger.error(`Error fetching service logs: ${error}`);
        return c.json({ message: 'Internal server error.' }, 500);
      }
    }
  )

  .post('/:id/sync-logs', zValidator('param', serviceIdSchema), async (c) => {
    try {
      const { id } = c.req.valid('param');
      // get service by id
      const services = await db
        .select()
        .from(servicesTable)
        .where(and(eq(servicesTable.id, id), isNull(servicesTable.deletedAt)));

      if (services.length === 0) {
        return c.json({ message: 'Service not found.' }, 404);
      }

      const service = services[0];

      // check type of service
      let isConfigureToSyncLogs = false;

      // check if service is shared hosting and is configured to sync logs
      if (service.type === SERVICE_TYPE.SHARED_HOSTING) {
        isConfigureToSyncLogs = true;

        try {
          // fetch histroy from res status api and it api key
          const history = await fetch(`${service.resStatusApiUrl}/resource-usage/history`, {
            headers: {
              'x-api-key': service.resStatusApiKey,
            },
          });

          if (!history.ok) {
            return c.json({ message: 'Failed to fetch history from res status api.' }, 500);
          }

          const historyData: SharedHostingHistoryResponse = await history.json();

          if (!historyData.success) {
            return c.json({ message: 'Failed to fetch history from res status api.' }, 500);
          }

          const historyDataList = historyData.data;

          const listRecordIds = historyDataList.map((historyData) => historyData.id);

          // get list of record ids from service logs table
          const listRecordIdsResponse = await db
            .select({ recordId: serviceLogsTable.recordId })
            .from(serviceLogsTable)
            .where(
              and(
                eq(serviceLogsTable.serviceId, service.id),
                inArray(serviceLogsTable.recordId, listRecordIds)
              )
            );

          // filter list of record ids that are not in the list of record ids from service logs table
          const listRecordIdsToInsert = historyDataList.filter(
            (record) => !listRecordIdsResponse.some((response) => response.recordId === record.id)
          );

          const valuesToInsert = listRecordIdsToInsert.map((record) => ({
            serviceId: service.id,
            recordId: record.id,
            data: record,
            recordedAt: new Date(record.checked_at),
          }));

          if (valuesToInsert.length > 0) {
            // insert into service logs table
            await db.insert(serviceLogsTable).values(valuesToInsert);
          }

          return c.json({
            success: true,
            message: 'Service logs synced successfully.',
            data: valuesToInsert,
          });
        } catch (error) {
          logger.error(`Error fetching history from res status api: ${error}`);
          return c.json({ message: 'Internal server error.' }, 500);
        }
      }

      if (!isConfigureToSyncLogs) {
        return c.json({ message: 'Service is not configured to sync logs.' }, 400);
      }
    } catch (error) {
      logger.error(`Error syncing service logs: ${error}`);
      return c.json({ message: 'Internal server error.' }, 500);
    }
  });
