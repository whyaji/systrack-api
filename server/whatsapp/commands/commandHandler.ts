import { logger } from '../../lib/logger.js';
import { ChartGenerator } from '../services/chartGenerator.js';
import { HealthChecker } from '../services/healthChecker.js';
import { ServiceDataFetcher } from '../services/serviceDataFetcher.js';
import { ServiceManager } from '../services/serviceManager.js';

export class CommandHandler {
  private serviceManager: ServiceManager;
  private healthChecker: HealthChecker;
  private serviceDataFetcher: ServiceDataFetcher;
  private chartGenerator: ChartGenerator;

  constructor(serviceManager: ServiceManager, healthChecker: HealthChecker) {
    this.serviceManager = serviceManager;
    this.healthChecker = healthChecker;
    this.serviceDataFetcher = new ServiceDataFetcher();
    this.chartGenerator = new ChartGenerator();
  }

  public async handleCommand(command: string): Promise<{ text: string; imageBuffer?: Buffer }> {
    try {
      // Remove extra spaces and convert to lowercase
      const cleanCommand = command.trim().toLowerCase();

      // Check if command starts with !systrack prefix
      if (!cleanCommand.startsWith('!systrack')) {
        return {
          text: 'Please use the !systrack prefix for commands. Type "!systrack help" to see available commands.',
        };
      }

      // Extract the actual command after the prefix
      const actualCommand = cleanCommand.replace('!systrack', '').trim();

      // Commands list command
      if (actualCommand === 'commands' || actualCommand === 'list') {
        return { text: this.getCommandsList() };
      }

      // Help command
      if (actualCommand === 'help' || actualCommand === '') {
        return { text: this.getHelpMessage() };
      }

      // Health check command
      if (actualCommand === 'health') {
        return { text: await this.handleHealthCheck() };
      }

      // Status command
      if (actualCommand === 'status') {
        return { text: await this.handleStatusCheck() };
      }

      // Services list command
      if (actualCommand === 'services') {
        return { text: await this.handleServicesList() };
      }

      // Service details command (format: service <id> or service <name>)
      if (actualCommand.startsWith('service ')) {
        const serviceIdentifier = actualCommand.replace('service ', '').trim();
        return { text: await this.handleServiceDetails(serviceIdentifier) };
      }

      // Service logs command (format: logs <id> or logs <name>)
      if (actualCommand.startsWith('logs ')) {
        const serviceIdentifier = actualCommand.replace('logs ', '').trim();
        return { text: await this.handleServiceLogs(serviceIdentifier) };
      }

      // Service status command (format: service-status <id> or service-status <name>)
      if (actualCommand.startsWith('service-status ')) {
        const serviceIdentifier = actualCommand.replace('service-status ', '').trim();
        return await this.handleServiceStatus(serviceIdentifier);
      }

      // Unknown command
      return {
        text: `Unknown command: "${actualCommand}". Type "!systrack help" to see available commands.`,
      };
    } catch (error) {
      logger.error(`Error handling command: ${error}`);
      return { text: 'Sorry, an error occurred while processing your command.' };
    }
  }

  private getCommandsList(): string {
    return `📋 *All Available Commands*

*Health & Status:*
• \`!systrack health\` - Check system health
• \`!systrack status\` - Get system status overview

*Services:*
• \`!systrack services\` - List all services
• \`!systrack service <id|name>\` - Get service details
• \`!systrack service-status <id|name>\` - Get service status with charts
• \`!systrack logs <id|name>\` - Get service logs

*General:*
• \`!systrack help\` - Show detailed help message
• \`!systrack commands\` - Show this commands list

*Quick Examples:*
• \`!systrack service 1\` - Get details for service with ID 1
• \`!systrack service my-server\` - Get details for service named "my-server"
• \`!systrack logs 1\` - Get logs for service with ID 1
• \`!systrack logs my-server\` - Get logs for service named "my-server"`;
  }

  private getHelpMessage(): string {
    return `🤖 *SysTrack WhatsApp Bot Help*

*How to use:*
All commands must start with \`!systrack\` prefix.

*Health & Status:*
• \`!systrack health\` - Check system health and get health score
• \`!systrack status\` - Get system status overview with service counts

*Services:*
• \`!systrack services\` - List all services with their status
• \`!systrack service <id|name>\` - Get detailed information about a specific service
• \`!systrack service-status <id|name>\` - Get service status with charts and recent logs
• \`!systrack logs <id|name>\` - Get recent logs for a specific service

*General:*
• \`!systrack help\` - Show this help message
• \`!systrack commands\` - Show list of all commands

*Examples:*
• \`!systrack service 1\` - Get details for service with ID 1
• \`!systrack service my-server\` - Get details for service named "my-server"
• \`!systrack service-status 1\` - Get status chart for service with ID 1
• \`!systrack service-status my-server\` - Get status chart for service named "my-server"
• \`!systrack logs 1\` - Get logs for service with ID 1
• \`!systrack logs my-server\` - Get logs for service named "my-server"

*Note:* Type \`!systrack commands\` to see a quick list of all available commands.`;
  }

  private async handleHealthCheck(): Promise<string> {
    try {
      const healthStatus = await this.healthChecker.checkSystemHealth();
      return `🏥 *System Health Check*\n\n${healthStatus}`;
    } catch (error) {
      logger.error(`Error checking health: ${error}`);
      return '❌ Failed to check system health.';
    }
  }

  private async handleStatusCheck(): Promise<string> {
    try {
      const status = await this.healthChecker.getSystemStatus();
      return `📊 *System Status*\n\n${status}`;
    } catch (error) {
      logger.error(`Error checking status: ${error}`);
      return '❌ Failed to get system status.';
    }
  }

  private async handleServicesList(): Promise<string> {
    try {
      const services = await this.serviceManager.getAllServices();
      return `📋 *Services List*\n\n${services}`;
    } catch (error) {
      logger.error(`Error getting services list: ${error}`);
      return '❌ Failed to get services list.';
    }
  }

  private async handleServiceDetails(identifier: string): Promise<string> {
    try {
      const serviceDetails = await this.serviceManager.getServiceDetails(identifier);
      return `🔧 *Service Details*\n\n${serviceDetails}`;
    } catch (error) {
      logger.error(`Error getting service details: ${error}`);
      return `❌ Failed to get service details for "${identifier}".`;
    }
  }

  private async handleServiceLogs(identifier: string): Promise<string> {
    try {
      const serviceLogs = await this.serviceManager.getServiceLogs(identifier);
      return `📝 *Service Logs*\n\n${serviceLogs}`;
    } catch (error) {
      logger.error(`Error getting service logs: ${error}`);
      return `❌ Failed to get service logs for "${identifier}".`;
    }
  }

  private async handleServiceStatus(
    identifier: string
  ): Promise<{ text: string; imageBuffer?: Buffer }> {
    try {
      // Get service data
      const serviceData = await this.serviceDataFetcher.getServiceByIdOrName(identifier);

      if (!serviceData) {
        return { text: `❌ Service "${identifier}" not found.` };
      }

      // Generate chart
      const chartBuffer = await this.chartGenerator.generateServiceStatusChart(serviceData);

      const logs = serviceData.logs;
      const latestLog = logs[0];

      let statusMessage = `📊 *Service Status Report*\n\n`;
      statusMessage += `*Service:* ${serviceData.name}\n`;
      statusMessage += `*Domain:* ${serviceData.domain}\n`;
      statusMessage += `*Status:* ${serviceData.status.toUpperCase()}\n\n`;

      if (latestLog) {
        const diskUsageGB = (latestLog.disk_usage_mb / 1024).toFixed(2);
        const availableSpaceGB = (latestLog.available_space_mb / 1024).toFixed(2);
        const diskUsagePercentage = (
          (latestLog.disk_usage_mb / latestLog.available_space_mb) *
          100
        ).toFixed(1);
        const fileCountPercentage = (
          (latestLog.file_count / latestLog.available_inode) *
          100
        ).toFixed(1);

        statusMessage += `*Current Usage:*\n`;
        statusMessage += `• Disk: ${diskUsageGB} GB / ${availableSpaceGB} GB (${diskUsagePercentage}%)\n`;
        statusMessage += `• Files: ${latestLog.file_count.toLocaleString()} / ${latestLog.available_inode.toLocaleString()} (${fileCountPercentage}%)\n\n`;

        statusMessage += `*Recent Logs (Last ${Math.min(logs.length, 7)} entries):*\n`;
        logs.slice(0, 7).forEach((log, index) => {
          const date = new Date(log.created_at).toLocaleDateString();
          const time = new Date(log.created_at).toLocaleTimeString();
          const diskGB = (log.disk_usage_mb / 1024).toFixed(2);
          statusMessage += `${index + 1}. ${date} ${time}\n`;
          statusMessage += `   Disk: ${diskGB} GB | Files: ${log.file_count.toLocaleString()}\n`;
        });
      } else {
        statusMessage += `*No data available* - Try syncing the logs first.`;
      }

      return { text: statusMessage, imageBuffer: chartBuffer };
    } catch (error) {
      logger.error(`Error generating service status: ${error}`);
      return { text: `❌ Failed to generate service status for "${identifier}".` };
    }
  }
}
