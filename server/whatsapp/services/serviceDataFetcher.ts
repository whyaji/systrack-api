import { desc, eq } from 'drizzle-orm';

import { db } from '../../db/database.js';
import { serviceLogsTable, servicesTable } from '../../db/schema/schema.js';
import { logger } from '../../lib/logger.js';
import { SharedHostingHistoryData } from '../../types/service.type.js';
import { getDomainUrlFromResApi } from '../../utils/resApiToDomain.js';

export interface ServiceLogData {
  id: number;
  service_id: number;
  disk_usage_mb: number;
  file_count: number;
  available_space_mb: number;
  available_inode: number;
  created_at: string;
}

export interface ServiceData {
  id: number;
  name: string;
  domain: string;
  status: string;
  logs: ServiceLogData[];
}

export class ServiceDataFetcher {
  public async getServiceByIdOrName(identifier: string): Promise<ServiceData | null> {
    try {
      // Try to parse as ID first
      const serviceId = parseInt(identifier);

      let service;
      if (!isNaN(serviceId)) {
        // Search by ID
        service = await db
          .select()
          .from(servicesTable)
          .where(eq(servicesTable.id, serviceId))
          .limit(1);
      } else {
        // Search by name (case-insensitive)
        service = await db
          .select()
          .from(servicesTable)
          .where(eq(servicesTable.name, identifier))
          .limit(1);
      }

      if (!service || service.length === 0) {
        return null;
      }

      const serviceRecord = service[0];

      // Get recent logs (last 7)
      const logs = await db
        .select()
        .from(serviceLogsTable)
        .where(eq(serviceLogsTable.serviceId, serviceRecord.id))
        .orderBy(desc(serviceLogsTable.createdAt))
        .limit(7);

      return {
        id: serviceRecord.id,
        name: serviceRecord.name,
        domain: getDomainUrlFromResApi(serviceRecord.resStatusApiUrl),
        status: serviceRecord.status === 1 ? '🟢 Active' : '🔴 Inactive',
        logs: logs.map((log) => {
          const logData = log.data as SharedHostingHistoryData;
          return {
            id: log.id,
            service_id: log.serviceId,
            disk_usage_mb: logData.disk_usage_mb,
            file_count: logData.file_count,
            available_space_mb: logData.available_space_mb,
            available_inode: logData.available_inode,
            created_at: logData.checked_at,
          };
        }),
      };
    } catch (error) {
      logger.error(`Error fetching service data: ${error}`);
      return null;
    }
  }

  public async getAllServices(): Promise<ServiceData[]> {
    try {
      const allServices = await db.select().from(servicesTable);

      const servicesWithLogs = await Promise.all(
        allServices.map(async (service) => {
          const logs = await db
            .select()
            .from(serviceLogsTable)
            .where(eq(serviceLogsTable.serviceId, service.id))
            .orderBy(desc(serviceLogsTable.createdAt))
            .limit(7);

          return {
            id: service.id,
            name: service.name,
            domain: getDomainUrlFromResApi(service.resStatusApiUrl),
            status: service.status === 1 ? '🟢 Active' : '🔴 Inactive',
            logs: logs.map((log) => {
              const logData = log.data as SharedHostingHistoryData;
              return {
                id: log.id,
                service_id: log.serviceId,
                disk_usage_mb: logData.disk_usage_mb,
                file_count: logData.file_count,
                available_space_mb: logData.available_space_mb,
                available_inode: logData.available_inode,
                created_at: log.createdAt?.toISOString() || '',
              };
            }),
          };
        })
      );

      return servicesWithLogs;
    } catch (error) {
      logger.error(`Error fetching all services: ${error}`);
      return [];
    }
  }
}
