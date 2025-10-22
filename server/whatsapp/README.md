# WhatsApp Bot for SysTrack

This WhatsApp bot allows you to monitor your system services and get health status updates directly through WhatsApp.

## Features

- **Health Check**: Check overall system health and status
- **Service Management**: List all services and get detailed information
- **Service Logs**: View recent logs for specific services
- **Real-time Monitoring**: Get instant updates about your system

## Commands

All commands must start with `!systrack` prefix.

### Health & Status

- `!systrack health` - Check system health
- `!systrack status` - Get system status overview

### Services

- `!systrack services` - List all services
- `!systrack service <id|name>` - Get service details
- `!systrack logs <id|name>` - Get service logs

### General

- `!systrack help` - Show detailed help message
- `!systrack commands` - Show list of all commands

## Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Environment Variables

Add the following to your `.env` file:

```env
# WhatsApp Bot Configuration
WHATSAPP_SESSION_PATH=./whatsapp-session
WHATSAPP_ADMIN_PHONE=+1234567890  # Optional: restrict bot to admin only
```

### 3. Run the Bot

```bash
# Development mode
bun run whatsapp-bot:dev

# Production mode
bun run whatsapp-bot
```

### 4. Connect WhatsApp

1. Run the bot
2. Scan the QR code with your WhatsApp mobile app
3. The bot will be ready to receive commands

## Usage

1. Send a message to the WhatsApp number running the bot
2. Use any of the available commands
3. The bot will respond with the requested information

## Security

- The bot can be restricted to admin users only by setting `WHATSAPP_ADMIN_PHONE`
- All commands are logged for audit purposes
- The bot only responds to text messages

## Troubleshooting

### Bot Not Responding

- Check if the bot is running
- Verify the WhatsApp session is active
- Check logs for any errors

### QR Code Not Appearing

- Ensure all dependencies are installed
- Check if the session path is writable
- Try deleting the session folder and restarting

### Database Connection Issues

- Verify database credentials in `.env`
- Ensure the database is running
- Check network connectivity

## File Structure

```
server/whatsapp/
├── index.ts              # Main bot entry point
├── bot.ts               # Bot class and message handling
├── commands/
│   └── commandHandler.ts # Command processing logic
├── services/
│   ├── serviceManager.ts # Service data management
│   └── healthChecker.ts  # Health and status checking
└── README.md            # This file
```

## Integration

The bot integrates with your existing SysTrack system by:

- Reading service data from the database
- Using the same service management logic
- Providing real-time access to system information
- Maintaining the same security and authentication patterns
