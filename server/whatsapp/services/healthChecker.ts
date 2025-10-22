import { and, count, eq, gte, isNull } from 'drizzle-orm';

import { db } from '../../db/database.js';
import { serviceLogsTable, servicesTable } from '../../db/schema/schema.js';
import { logger } from '../../lib/logger.js';

export class HealthChecker {
  public async checkSystemHealth(): Promise<string> {
    try {
      // Get total services count
      const totalServicesResult = await db
        .select({ count: count() })
        .from(servicesTable)
        .where(isNull(servicesTable.deletedAt));

      const totalServices = totalServicesResult[0].count;

      // Get active services count
      const activeServicesResult = await db
        .select({ count: count() })
        .from(servicesTable)
        .where(and(eq(servicesTable.status, 1), isNull(servicesTable.deletedAt)));

      const activeServices = activeServicesResult[0].count;

      // Get inactive services count
      const inactiveServices = totalServices - activeServices;

      // Get recent logs count (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const recentLogsResult = await db
        .select({ count: count() })
        .from(serviceLogsTable)
        .where(
          and(isNull(serviceLogsTable.deletedAt), gte(serviceLogsTable.recordedAt, yesterday))
        );

      const recentLogs = recentLogsResult[0].count;

      // Calculate health score
      const healthScore =
        totalServices > 0 ? Math.round((activeServices / totalServices) * 100) : 100;

      let healthStatus = '🟢 Healthy';
      if (healthScore < 50) {
        healthStatus = '🔴 Critical';
      } else if (healthScore < 80) {
        healthStatus = '🟡 Warning';
      }

      let response = `*System Health Status: ${healthStatus}*\n\n`;
      response += `*Health Score:* ${healthScore}%\n`;
      response += `*Total Services:* ${totalServices}\n`;
      response += `*Active Services:* ${activeServices}\n`;
      response += `*Inactive Services:* ${inactiveServices}\n`;
      response += `*Recent Logs (24h):* ${recentLogs}\n\n`;

      if (inactiveServices > 0) {
        response += `⚠️ *Warning:* ${inactiveServices} service(s) are inactive.\n`;
      }

      if (recentLogs === 0) {
        response += `⚠️ *Warning:* No recent logs found in the last 24 hours.\n`;
      }

      return response;
    } catch (error) {
      logger.error(`Error checking system health: ${error}`);
      throw error;
    }
  }

  public async getSystemStatus(): Promise<string> {
    try {
      // Get services by type
      const serverServices = await db
        .select({ count: count() })
        .from(servicesTable)
        .where(and(eq(servicesTable.type, 1), isNull(servicesTable.deletedAt)));

      const vpsServices = await db
        .select({ count: count() })
        .from(servicesTable)
        .where(and(eq(servicesTable.type, 2), isNull(servicesTable.deletedAt)));

      const sharedHostingServices = await db
        .select({ count: count() })
        .from(servicesTable)
        .where(and(eq(servicesTable.type, 3), isNull(servicesTable.deletedAt)));

      // Get recent activity (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const recentActivityResult = await db
        .select({ count: count() })
        .from(serviceLogsTable)
        .where(and(isNull(serviceLogsTable.deletedAt), gte(serviceLogsTable.recordedAt, weekAgo)));

      const recentActivity = recentActivityResult[0].count;

      let response = `*System Status Overview*\n\n`;
      response += `*Service Types:*\n`;
      response += `🖥️ Servers: ${serverServices[0].count}\n`;
      response += `☁️ VPS: ${vpsServices[0].count}\n`;
      response += `🌐 Shared Hosting: ${sharedHostingServices[0].count}\n\n`;
      response += `*Recent Activity (7 days):* ${recentActivity} log entries\n\n`;
      response += `*System Uptime:* ${this.getSystemUptime()}\n`;
      response += `*Last Check:* ${new Date().toLocaleString()}`;

      return response;
    } catch (error) {
      logger.error(`Error getting system status: ${error}`);
      throw error;
    }
  }

  private getSystemUptime(): string {
    const uptime = process.uptime();
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);

    return `${days}d ${hours}h ${minutes}m`;
  }
}
