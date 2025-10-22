import { Hono } from 'hono';

import { logger } from '../lib/logger.js';
import authMiddleware from '../middleware/jwt.js';
import { TriggerService } from '../whatsapp/services/triggerService.js';
import { WhatsAppQueueService } from '../whatsapp/services/whatsappQueueService.js';

// This route can be used to send messages to WhatsApp from the API
// or to get bot status information
export const whatsappRoute = new Hono().use(authMiddleware);

// Initialize services
const triggerService = new TriggerService();
const whatsappQueueService = new WhatsAppQueueService();

// Send trigger message to specific group (queued)
whatsappRoute.post('/trigger/group/message', async (c) => {
  try {
    const { groupName, message } = await c.req.json();

    if (!groupName || !message) {
      return c.json(
        {
          message: 'Both groupName and message are required.',
        },
        400
      );
    }

    const result = await whatsappQueueService.queueMessage(groupName, message);

    if (result.success) {
      return c.json({
        success: true,
        message: 'Trigger message queued successfully',
        data: {
          jobId: result.jobId,
          groupName,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      return c.json(
        {
          success: false,
          message: result.error || 'Failed to queue trigger message',
          data: {
            groupName,
            timestamp: new Date().toISOString(),
          },
        },
        500
      );
    }
  } catch (error) {
    logger.error(`Error queuing trigger message: ${error}`);
    return c.json({ message: 'Internal server error.' }, 500);
  }
});

whatsappRoute.post('/trigger/group/command', async (c) => {
  try {
    const { groupName, command } = await c.req.json();

    if (!groupName || !command) {
      return c.json(
        {
          message: 'Both groupName and command are required.',
        },
        400
      );
    }

    const result = await whatsappQueueService.queueCommand(groupName, command);

    if (result.success) {
      return c.json({
        success: true,
        message: 'Trigger command queued successfully',
        data: {
          jobId: result.jobId,
          groupName,
          command,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      return c.json(
        {
          success: false,
          message: result.error || 'Failed to queue trigger command',
          data: {
            groupName,
            timestamp: new Date().toISOString(),
          },
        },
        500
      );
    }
  } catch (error) {
    logger.error(`Error queuing trigger command: ${error}`);
    return c.json({ message: 'Internal server error.' }, 500);
  }
});

// Get available groups
whatsappRoute.get('/groups', async (c) => {
  try {
    const groups = await triggerService.getAvailableGroups();

    return c.json({
      success: true,
      message: 'Groups retrieved successfully',
      data: {
        groups,
        count: groups.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(`Error getting groups: ${error}`);
    return c.json({ message: 'Internal server error.' }, 500);
  }
});

// Get trigger message status
whatsappRoute.get('/trigger/status/:messageId', async (c) => {
  try {
    const messageId = c.req.param('messageId');
    const message = triggerService.getMessageStatus(messageId);

    if (!message) {
      return c.json(
        {
          message: 'Message not found.',
        },
        404
      );
    }

    return c.json({
      success: true,
      message: 'Message status retrieved successfully',
      data: message,
    });
  } catch (error) {
    logger.error(`Error getting message status: ${error}`);
    return c.json({ message: 'Internal server error.' }, 500);
  }
});

// Get all trigger messages
whatsappRoute.get('/trigger/messages', async (c) => {
  try {
    const messages = triggerService.getAllMessages();

    return c.json({
      success: true,
      message: 'Messages retrieved successfully',
      data: {
        messages,
        count: messages.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(`Error getting all messages: ${error}`);
    return c.json({ message: 'Internal server error.' }, 500);
  }
});

// Retry failed messages
whatsappRoute.post('/trigger/retry-failed', async (c) => {
  try {
    await triggerService.retryFailedMessages();

    return c.json({
      success: true,
      message: 'Failed messages retry initiated',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error(`Error retrying failed messages: ${error}`);
    return c.json({ message: 'Internal server error.' }, 500);
  }
});

// Get job status by job ID
whatsappRoute.get('/job/status/:queueType/:jobId', async (c) => {
  try {
    const queueType = c.req.param('queueType') as 'message' | 'command';
    const jobId = c.req.param('jobId');

    if (!['message', 'command'].includes(queueType)) {
      return c.json(
        {
          message: 'Invalid queue type. Must be "message" or "command".',
        },
        400
      );
    }

    const result = await whatsappQueueService.getJobStatus(queueType, jobId);

    if (result.success) {
      return c.json({
        success: true,
        message: 'Job status retrieved successfully',
        data: result.status,
      });
    } else {
      return c.json(
        {
          success: false,
          message: result.error || 'Failed to get job status',
        },
        404
      );
    }
  } catch (error) {
    logger.error(`Error getting job status: ${error}`);
    return c.json({ message: 'Internal server error.' }, 500);
  }
});

// Get queue statistics
whatsappRoute.get('/queue/stats', async (c) => {
  try {
    const result = await whatsappQueueService.getQueueStats();

    if (result.success) {
      return c.json({
        success: true,
        message: 'Queue statistics retrieved successfully',
        data: result.stats,
      });
    } else {
      return c.json(
        {
          success: false,
          message: result.error || 'Failed to get queue statistics',
        },
        500
      );
    }
  } catch (error) {
    logger.error(`Error getting queue stats: ${error}`);
    return c.json({ message: 'Internal server error.' }, 500);
  }
});

// Retry failed jobs in queue
whatsappRoute.post('/queue/retry-failed/:queueType', async (c) => {
  try {
    const queueType = c.req.param('queueType') as 'message' | 'command';

    if (!['message', 'command'].includes(queueType)) {
      return c.json(
        {
          message: 'Invalid queue type. Must be "message" or "command".',
        },
        400
      );
    }

    const result = await whatsappQueueService.retryFailedJobs(queueType);

    if (result.success) {
      return c.json({
        success: true,
        message: `Failed ${queueType} jobs retry initiated`,
        data: {
          retriedCount: result.retriedCount,
          queueType,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      return c.json(
        {
          success: false,
          message: result.error || 'Failed to retry jobs',
        },
        500
      );
    }
  } catch (error) {
    logger.error(`Error retrying failed jobs: ${error}`);
    return c.json({ message: 'Internal server error.' }, 500);
  }
});
