# Scheduled Jobs System

This document describes the scheduled job system implemented using Redis and BullMQ for syncing services daily at 6:30 AM.

## Overview

The system consists of three main components:

1. **Scheduler** - Schedules jobs using node-cron
2. **Worker** - Processes the scheduled jobs
3. **Queue** - Manages job queues using BullMQ and Redis

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Scheduler     │───▶│   Redis Queue   │───▶│     Worker      │
│   (node-cron)   │    │   (BullMQ)      │    │   (BullMQ)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │
        │                        │                        ▼
        │                        │                ┌─────────────────┐
        │                        │                │   Database      │
        │                        │                │   (MySQL)       │
        │                        │                └─────────────────┘
        ▼                        │
┌─────────────────┐              │
│   API Endpoints │              │
│   (Manual Sync) │──────────────┘
└─────────────────┘
```

## Components

### 1. Scheduler (`server/lib/scheduler.ts`)

- Uses node-cron to schedule jobs daily at 6:30 AM
- Fetches all active shared hosting services from the database
- Creates sync jobs for each service with random delays to prevent API overload
- Handles graceful shutdown

### 2. Worker (`server/workers/serviceSyncWorker.ts`)

- Processes service sync jobs from the queue
- Fetches data from external APIs (res status API)
- Inserts new records into the service logs table
- Handles errors and retries
- Supports concurrency (up to 5 concurrent jobs)

### 3. Queue (`server/lib/queue.ts`)

- Manages BullMQ queues with Redis
- Configures job options (retries, backoff, cleanup)
- Handles queue events and logging

### 4. Redis Configuration (`server/lib/redis.ts`)

- Configures Redis connection with ioredis
- Handles connection events and errors

## Environment Variables

Add these to your `.env` file:

```env
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password  # Optional
```

## Installation

1. Install dependencies:

```bash
bun install
```

2. Make sure Redis is running:

```bash
# Using Docker
docker run -d --name redis -p 6379:6379 redis:alpine

# Or install Redis locally
```

## Usage

### Running the System

1. **Start the main application:**

```bash
bun run dev
```

2. **Start the worker (in a separate terminal):**

```bash
bun run worker:dev
```

3. **Start the scheduler (in a separate terminal):**

```bash
bun run scheduler:dev
```

### Production Deployment

For production, you can run:

```bash
# Main app
bun run start

# Worker
bun run worker

# Scheduler
bun run scheduler
```

## API Endpoints

### Manual Sync All Services

```http
POST /api/v1/sync/all
Authorization: Bearer <your_jwt_token>
```

### Manual Sync Specific Service

```http
POST /api/v1/sync/service/:id
Authorization: Bearer <your_jwt_token>
```

### Get Queue Status

```http
GET /api/v1/sync/status
Authorization: Bearer <your_jwt_token>
```

## Job Scheduling

### Cron Expression

- **Production**: `30 6 * * *` (Daily at 6:30 AM UTC)
- **Development**: `*/5 * * * *` (Every 5 minutes - for testing)

### Job Configuration

- **Concurrency**: 5 workers
- **Retries**: 3 attempts with exponential backoff
- **Cleanup**: Keep last 10 completed jobs, 5 failed jobs
- **Delays**: Random delays up to 30 seconds between jobs

## Monitoring

### Logs

All components log their activities:

- Job scheduling
- Job processing
- Errors and retries
- Queue status

### Queue Status

Use the `/api/v1/sync/status` endpoint to monitor:

- Waiting jobs
- Active jobs
- Completed jobs
- Failed jobs

## Error Handling

### Retry Strategy

- Failed jobs are retried up to 3 times
- Exponential backoff: 2s, 4s, 8s delays
- Jobs are marked as failed after all retries

### Error Types

1. **API Errors**: External API failures
2. **Database Errors**: Database connection issues
3. **Service Errors**: Service not found or inactive
4. **Network Errors**: Connection timeouts

## Development

### Testing

1. Use the manual sync endpoints for testing
2. Change cron expression to `*/5 * * * *` for frequent testing
3. Monitor logs for job execution

### Debugging

- Check Redis connection
- Verify service configuration
- Monitor queue status
- Check worker logs

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**

   - Ensure Redis is running
   - Check Redis host/port configuration
   - Verify Redis password if required

2. **Jobs Not Processing**

   - Check if worker is running
   - Verify queue status
   - Check for stuck jobs

3. **API Failures**
   - Verify service API URLs and keys
   - Check external API availability
   - Monitor rate limiting

### Logs Location

- Application logs: `server/logs/`
- Worker logs: Console output
- Scheduler logs: Console output

## Performance Considerations

1. **Concurrency**: Adjust worker concurrency based on API limits
2. **Delays**: Random delays prevent API overload
3. **Cleanup**: Automatic cleanup of old jobs
4. **Monitoring**: Regular monitoring of queue status

## Security

1. **Authentication**: All API endpoints require JWT authentication
2. **API Keys**: Service API keys are stored securely
3. **Redis**: Configure Redis authentication in production
4. **Network**: Use secure connections for external APIs

## Future Enhancements

1. **Dashboard**: Web interface for monitoring jobs
2. **Notifications**: Email/SMS notifications for failures
3. **Metrics**: Detailed metrics and analytics
4. **Scaling**: Horizontal scaling support
5. **Backup**: Job backup and recovery
