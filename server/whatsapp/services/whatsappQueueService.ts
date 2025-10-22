import { logger } from '../../lib/logger.js';
import {
  WhatsAppCommandJobData,
  whatsappCommandQueue,
  WhatsAppMessageJobData,
  whatsappMessageQueue,
} from '../../lib/queue.js';

export interface JobStatus {
  id: string | number | undefined;
  state: string;
  progress: unknown;
  data: WhatsAppMessageJobData | WhatsAppCommandJobData;
  createdAt: number | undefined;
  processedOn: number | undefined;
  finishedOn: number | undefined;
  failedReason: string | undefined;
}

export class WhatsAppQueueService {
  public async queueMessage(
    groupName: string,
    message: string
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      const jobData: WhatsAppMessageJobData = {
        groupName,
        message,
        timestamp: new Date().toISOString(),
      };

      const job = await whatsappMessageQueue.add('send-message', jobData, {
        priority: 1,
        delay: 0,
      });

      logger.info(`WhatsApp message queued successfully: jobId=${job.id}, groupName=${groupName}`);

      return {
        success: true,
        jobId: job.id?.toString(),
      };
    } catch (error) {
      logger.error(`Error queuing WhatsApp message: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async queueCommand(
    groupName: string,
    command: string,
    delay: number = 0
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      const jobData: WhatsAppCommandJobData = {
        groupName,
        command,
        timestamp: new Date().toISOString(),
      };

      const job = await whatsappCommandQueue.add('send-command', jobData, {
        priority: 1,
        delay: delay,
      });

      logger.info(
        `WhatsApp command queued successfully: jobId=${job.id}, groupName=${groupName}, command=${command}, delay=${delay}ms`
      );

      return {
        success: true,
        jobId: job.id?.toString(),
      };
    } catch (error) {
      logger.error(`Error queuing WhatsApp command: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async getJobStatus(
    queueName: 'message' | 'command',
    jobId: string
  ): Promise<{ success: boolean; status?: JobStatus; error?: string }> {
    try {
      const queue = queueName === 'message' ? whatsappMessageQueue : whatsappCommandQueue;
      const job = await queue.getJob(jobId);

      if (!job) {
        return {
          success: false,
          error: 'Job not found',
        };
      }

      const state = await job.getState();
      const progress = job.progress;

      return {
        success: true,
        status: {
          id: job.id,
          state,
          progress,
          data: job.data,
          createdAt: job.timestamp,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          failedReason: job.failedReason,
        },
      };
    } catch (error) {
      logger.error(`Error getting job status: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async getQueueStats(): Promise<{
    success: boolean;
    stats?: { messageQueue: object; commandQueue: object };
    error?: string;
  }> {
    try {
      const [messageStats, commandStats] = await Promise.all([
        whatsappMessageQueue.getJobCounts(),
        whatsappCommandQueue.getJobCounts(),
      ]);

      return {
        success: true,
        stats: {
          messageQueue: messageStats,
          commandQueue: commandStats,
        },
      };
    } catch (error) {
      logger.error(`Error getting queue stats: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public async retryFailedJobs(
    queueName: 'message' | 'command'
  ): Promise<{ success: boolean; retriedCount?: number; error?: string }> {
    try {
      const queue = queueName === 'message' ? whatsappMessageQueue : whatsappCommandQueue;
      const failedJobs = await queue.getFailed();

      let retriedCount = 0;
      for (const job of failedJobs) {
        await job.retry();
        retriedCount++;
      }

      logger.info(`Retried ${retriedCount} failed ${queueName} jobs`);

      return {
        success: true,
        retriedCount,
      };
    } catch (error) {
      logger.error(`Error retrying failed jobs: ${error}`);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
