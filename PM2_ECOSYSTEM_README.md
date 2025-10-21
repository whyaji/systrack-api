# PM2 Ecosystem Configuration

This document explains the PM2 ecosystem configuration for the Systrack application and how to manage the scheduled job system in production.

## Overview

The PM2 ecosystem configuration manages three separate processes:

1. **systrack-api** - Main API server
2. **systrack-worker** - Background job processor
3. **systrack-scheduler** - Cron job scheduler

## Configuration File: `ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'systrack-api',
      script: 'bun',
      args: 'run server/index.ts',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/pm2-api-error.log',
      out_file: './logs/pm2-api-out.log',
      log_file: './logs/pm2-api-combined.log',
      time: true,
    },
    {
      name: 'systrack-worker',
      script: 'bun',
      args: 'run server/worker/index.ts',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2-worker-error.log',
      out_file: './logs/pm2-worker-out.log',
      log_file: './logs/pm2-worker-combined.log',
      time: true,
    },
    {
      name: 'systrack-scheduler',
      script: 'bun',
      args: 'run server/scheduler/index.ts',
      cwd: './',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2-scheduler-error.log',
      out_file: './logs/pm2-scheduler-out.log',
      log_file: './logs/pm2-scheduler-combined.log',
      time: true,
    },
  ],
};
```

## Configuration Options Explained

### Common Options

| Option               | Description                     | Value                                                   |
| -------------------- | ------------------------------- | ------------------------------------------------------- |
| `name`               | Process name identifier         | `systrack-api`, `systrack-worker`, `systrack-scheduler` |
| `script`             | Runtime to execute              | `bun`                                                   |
| `args`               | Arguments passed to the script  | `run server/index.ts`                                   |
| `cwd`                | Working directory               | `./`                                                    |
| `instances`          | Number of process instances     | `1`                                                     |
| `autorestart`        | Auto-restart on crash           | `true`                                                  |
| `watch`              | Watch files for changes         | `false` (production)                                    |
| `max_memory_restart` | Restart if memory exceeds limit | `1G`, `512M`, `256M`                                    |

### Process-Specific Settings

#### systrack-api

- **Memory Limit**: 1GB
- **Port**: 3000
- **Purpose**: Main API server handling HTTP requests

#### systrack-worker

- **Memory Limit**: 512MB
- **Purpose**: Processes background jobs from Redis queue
- **Concurrency**: Up to 5 concurrent jobs

#### systrack-scheduler

- **Memory Limit**: 256MB
- **Purpose**: Schedules daily sync jobs at 6:30 AM
- **Timezone**: Asia/Jakarta

### Logging Configuration

| Log Type     | Location                            | Description                |
| ------------ | ----------------------------------- | -------------------------- |
| `error_file` | `./logs/pm2-{service}-error.log`    | Error logs only            |
| `out_file`   | `./logs/pm2-{service}-out.log`      | Standard output logs       |
| `log_file`   | `./logs/pm2-{service}-combined.log` | All logs combined          |
| `time`       | `true`                              | Include timestamps in logs |

## Installation & Setup

### 1. Install PM2

```bash
npm install -g pm2
```

### 2. Create Logs Directory

```bash
mkdir -p logs
```

### 3. Start All Processes

```bash
pm2 start ecosystem.config.js
```

### 4. Save PM2 Configuration

```bash
pm2 save
```

### 5. Setup Auto-Start on Boot

```bash
pm2 startup
# Follow the instructions provided by the command
```

## Management Commands

### Process Management

```bash
# Start all processes
pm2 start ecosystem.config.js

# Stop all processes
pm2 stop ecosystem.config.js

# Restart all processes
pm2 restart ecosystem.config.js

# Graceful reload (zero-downtime)
pm2 reload ecosystem.config.js

# Delete all processes
pm2 delete ecosystem.config.js
```

### Individual Process Management

```bash
# Start specific process
pm2 start systrack-api
pm2 start systrack-worker
pm2 start systrack-scheduler

# Stop specific process
pm2 stop systrack-api
pm2 stop systrack-worker
pm2 stop systrack-scheduler

# Restart specific process
pm2 restart systrack-api
pm2 restart systrack-worker
pm2 restart systrack-scheduler
```

### Monitoring & Status

```bash
# Check process status
pm2 status

# View real-time monitoring
pm2 monit

# View process information
pm2 describe systrack-api
pm2 describe systrack-worker
pm2 describe systrack-scheduler
```

### Log Management

```bash
# View all logs
pm2 logs

# View specific service logs
pm2 logs systrack-api
pm2 logs systrack-worker
pm2 logs systrack-scheduler

# View logs with lines limit
pm2 logs --lines 100

# Follow logs in real-time
pm2 logs --follow

# Clear all logs
pm2 flush
```

## Environment Variables

### Production Environment

```bash
NODE_ENV=production
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

### Development Environment

```bash
NODE_ENV=development
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
```

## Monitoring & Health Checks

### Process Health

```bash
# Check if all processes are running
pm2 status

# Expected output:
# ┌─────┬─────────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
# │ id  │ name                │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
# ├─────┼─────────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
# │ 0   │ systrack-api        │ default     │ 1.0.0   │ fork    │ 12345    │ 1m     │ 0    │ online    │ 0%       │ 45.2mb   │ user     │ disabled │
# │ 1   │ systrack-worker     │ default     │ 1.0.0   │ fork    │ 12346    │ 1m     │ 0    │ online    │ 0%       │ 23.1mb   │ user     │ disabled │
# │ 2   │ systrack-scheduler  │ default     │ 1.0.0   │ fork    │ 12347    │ 1m     │ 0    │ online    │ 0%       │ 15.8mb   │ user     │ disabled │
# └─────┴─────────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```

### API Health Check

```bash
# Test API endpoint
curl http://localhost:3000/api/v1/sync/status

# Expected response:
{
  "success": true,
  "data": {
    "queue": "service-sync",
    "waiting": 0,
    "active": 0,
    "completed": 5,
    "failed": 0
  }
}
```

### Redis Connection Check

```bash
# Test Redis connection
redis-cli ping

# Expected response: PONG
```

## Troubleshooting

### Common Issues

#### 1. Process Not Starting

```bash
# Check PM2 logs
pm2 logs

# Check if Redis is running
redis-cli ping

# Check if Bun is installed
bun --version
```

#### 2. Memory Issues

```bash
# Check memory usage
pm2 monit

# Increase memory limit in ecosystem.config.js
max_memory_restart: '2G'
```

#### 3. Log Files Not Created

```bash
# Ensure logs directory exists
mkdir -p logs

# Check permissions
ls -la logs/
```

#### 4. Scheduled Jobs Not Running

```bash
# Check scheduler logs
pm2 logs systrack-scheduler

# Check worker logs
pm2 logs systrack-worker

# Verify timezone setting
# Check ecosystem.config.js timezone configuration
```

### Debug Commands

```bash
# Show detailed process info
pm2 show systrack-api

# Show process environment
pm2 env 0

# Restart with more verbose logging
pm2 restart systrack-api --update-env
```

## Performance Tuning

### Memory Optimization

- **API Server**: 1GB (handles HTTP requests)
- **Worker**: 512MB (processes background jobs)
- **Scheduler**: 256MB (lightweight cron scheduler)

### Scaling Considerations

```javascript
// For high-traffic scenarios, you can scale the API server
{
  name: 'systrack-api',
  instances: 'max', // Use all CPU cores
  exec_mode: 'cluster', // Enable cluster mode
}
```

### Redis Optimization

```bash
# Redis memory optimization
redis-cli CONFIG SET maxmemory 1gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

## Backup & Recovery

### Backup PM2 Configuration

```bash
# Save current PM2 configuration
pm2 save

# Backup ecosystem file
cp ecosystem.config.js ecosystem.config.js.backup
```

### Recovery

```bash
# Restore from saved configuration
pm2 resurrect

# Or start from ecosystem file
pm2 start ecosystem.config.js
```

## Security Considerations

### Process Isolation

- Each process runs in its own memory space
- No shared memory between processes
- Individual log files for better security

### Environment Variables

- Store sensitive data in environment variables
- Use `.env` files for development
- Use system environment variables in production

### Log Security

- Log files are stored locally
- Consider log rotation for disk space management
- Monitor log files for sensitive information

## Maintenance

### Regular Tasks

```bash
# Weekly log rotation
pm2 flush

# Monthly process restart
pm2 restart all

# Check for updates
pm2 update
```

### Log Rotation

```bash
# Install logrotate for automatic log management
sudo apt-get install logrotate

# Create logrotate configuration
sudo nano /etc/logrotate.d/pm2
```

## Production Deployment Checklist

- [ ] PM2 installed globally
- [ ] Redis server running
- [ ] Environment variables configured
- [ ] Logs directory created
- [ ] Processes started with PM2
- [ ] PM2 configuration saved
- [ ] Auto-startup configured
- [ ] Health checks working
- [ ] Monitoring setup
- [ ] Backup strategy in place

This configuration provides a robust, production-ready setup for your Systrack scheduled job system with PM2.
