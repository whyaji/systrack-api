import { Hono } from 'hono';

import { logger } from '../lib/logger.js';
import authMiddleware from '../middleware/jwt.js';
import { TriggerService } from '../whatsapp/services/triggerService.js';

// This route can be used to send messages to WhatsApp from the API
// or to get bot status information
export const whatsappRoute = new Hono().use(authMiddleware);

// Initialize trigger service
const triggerService = new TriggerService();

// Send trigger message to specific group
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

    const result = await triggerService.sendTriggerToGroup(groupName, message);

    if (result.success) {
      return c.json({
        success: true,
        message: 'Trigger message sent successfully',
        data: {
          messageId: result.messageId,
          groupName,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      return c.json(
        {
          success: false,
          message: result.error || 'Failed to send trigger message',
          data: {
            groupName,
            timestamp: new Date().toISOString(),
          },
        },
        500
      );
    }
  } catch (error) {
    logger.error(`Error sending trigger to group: ${error}`);
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

    const result = await triggerService.sendTriggerCommandToGroup(groupName, command);

    if (result.success) {
      return c.json({
        success: true,
        message: 'Trigger command sent successfully',
        data: {
          messageId: result.messageId,
          groupName,
          hasImage: !!result.imageBuffer,
          timestamp: new Date().toISOString(),
        },
      });
    } else {
      return c.json(
        {
          success: false,
          message: result.error || 'Failed to send trigger command',
          data: {
            groupName,
            timestamp: new Date().toISOString(),
          },
        },
        500
      );
    }
  } catch (error) {
    logger.error(`Error sending trigger command: ${error}`);
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
