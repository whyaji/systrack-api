import { and, desc, eq, isNull, like } from 'drizzle-orm';

import { formatBytesToString } from '../../../frontend/src/utils/formatBytes.js';
import { db } from '../../db/database.js';
import { serviceLogsTable, servicesTable } from '../../db/schema/schema.js';
import { logger } from '../../lib/logger.js';
import { SERVICE_TYPE, SharedHostingHistoryData } from '../../types/service.type.js';

export class ServiceManager {
  public async getAllServices(): Promise<string> {
    try {
      const services = await db
        .select({
          id: servicesTable.id,
          name: servicesTable.name,
          description: servicesTable.description,
          type: servicesTable.type,
          status: servicesTable.status,
          createdAt: servicesTable.createdAt,
        })
        .from(servicesTable)
        .where(isNull(servicesTable.deletedAt))
        .orderBy(servicesTable.name);

      if (services.length === 0) {
        return 'No services found.';
      }

      let response = `Found ${services.length} service(s):\n\n`;

      services.forEach((service) => {
        const typeText = this.getServiceTypeText(service.type);
        const statusText = service.status === 1 ? '🟢 Active' : '🔴 Inactive';

        response += `*${service.name}* (ID: ${service.id})\n`;
        response += `Type: ${typeText}\n`;
        response += `Status: ${statusText}\n`;
        response += `Description: ${service.description}\n`;
        response += `Created: ${service.createdAt?.toLocaleDateString() || 'Unknown'}\n\n`;
      });

      return response;
    } catch (error) {
      logger.error(`Error getting all services: ${error}`);
      throw error;
    }
  }

  public async getServiceDetails(identifier: string): Promise<string> {
    try {
      // Try to find by ID first, then by name
      let service;

      if (!isNaN(Number(identifier))) {
        // Search by ID
        const services = await db
          .select()
          .from(servicesTable)
          .where(and(eq(servicesTable.id, Number(identifier)), isNull(servicesTable.deletedAt)));
        service = services[0];
      } else {
        // Search by name
        const services = await db
          .select()
          .from(servicesTable)
          .where(and(like(servicesTable.name, `%${identifier}%`), isNull(servicesTable.deletedAt)));
        service = services[0];
      }

      if (!service) {
        return `Service "${identifier}" not found.`;
      }

      const typeText = this.getServiceTypeText(service.type);
      const statusText = service.status === 1 ? '🟢 Active' : '🔴 Inactive';

      let response = `*${service.name}* (ID: ${service.id})\n\n`;
      response += `*Description:* ${service.description}\n`;
      response += `*Type:* ${typeText}\n`;
      response += `*Status:* ${statusText}\n`;
      response += `*API URL:* ${service.resStatusApiUrl}\n`;
      response += `*Created:* ${service.createdAt?.toLocaleDateString() || 'Unknown'}\n`;
      response += `*Updated:* ${service.updatedAt?.toLocaleDateString() || 'Unknown'}\n`;

      return response;
    } catch (error) {
      logger.error(`Error getting service details: ${error}`);
      throw error;
    }
  }

  public async getServiceLogs(identifier: string, limit: number = 10): Promise<string> {
    try {
      // Find service by ID or name
      let service;

      if (!isNaN(Number(identifier))) {
        const services = await db
          .select()
          .from(servicesTable)
          .where(and(eq(servicesTable.id, Number(identifier)), isNull(servicesTable.deletedAt)));
        service = services[0];
      } else {
        const services = await db
          .select()
          .from(servicesTable)
          .where(and(like(servicesTable.name, `%${identifier}%`), isNull(servicesTable.deletedAt)));
        service = services[0];
      }

      if (!service) {
        return `Service "${identifier}" not found.`;
      }

      // Get recent logs
      const logs = await db
        .select()
        .from(serviceLogsTable)
        .where(and(eq(serviceLogsTable.serviceId, service.id), isNull(serviceLogsTable.deletedAt)))
        .orderBy(desc(serviceLogsTable.recordedAt))
        .limit(limit);

      if (logs.length === 0) {
        return `No logs found for service "${service.name}".`;
      }

      let response = `*Logs for ${service.name}* (${logs.length} recent entries)\n\n`;

      logs.forEach((log, index) => {
        const logData = log.data as SharedHostingHistoryData;
        response += `*Log ${index + 1}* (ID: ${log.id})\n`;
        const date = new Date(log.recordedAt).toLocaleDateString('id-ID', {
          year: '2-digit',
          month: 'short',
          day: 'numeric',
        });
        response += `Recorded: ${date}\n`;

        // Format log data based on service type
        if (service.type === SERVICE_TYPE.SHARED_HOSTING) {
          // Shared hosting
          response += `Disk: ${formatBytesToString(logData.disk_usage_mb)} / ${formatBytesToString(
            logData.available_space_mb
          )} (${((logData.disk_usage_mb / logData.available_space_mb) * 100)
            .toFixed(2)
            .toString()}% used)\n`;
          response += `Inodes: ${logData.available_inode} / ${logData.available_inode} (${(
            (logData.available_inode / logData.available_inode) *
            100
          )
            .toFixed(2)
            .toString()}% used)\n`;
        } else {
          // For other service types, show raw data
          response += `Data: ${JSON.stringify(logData, null, 2)}\n`;
        }

        response += '\n';
      });

      return response;
    } catch (error) {
      logger.error(`Error getting service logs: ${error}`);
      throw error;
    }
  }

  private getServiceTypeText(type: number): string {
    switch (type) {
      case 1:
        return '🖥️ Server';
      case 2:
        return '☁️ VPS';
      case 3:
        return '🌐 Shared Hosting';
      default:
        return '❓ Unknown';
    }
  }
}
