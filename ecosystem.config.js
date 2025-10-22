// Define common environment variables for production
const env_production = {
  NODE_ENV: 'production',
  LOG_LEVEL: 'info',
  DB_HOST: 'localhost',
  DB_PORT: 3306,
  DB_USER: 'your-db-user',
  DB_PASSWORD: 'your-db-password',
  DB_NAME: 'your-db-name',
  JWT_SECRET: 'your-jwt-secret',
  HASH_SALT: 'your-hash-salt',
  TURNSTILE_SECRET_KEY: 'your-turnstile-secret-key',
  REDIS_HOST: 'localhost',
  REDIS_PORT: 6379,
  REDIS_PASSWORD: '',
};

// eslint-disable-next-line no-undef
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
      env: env_production,
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
      env: env_production, // Use common variables
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
      env: env_production, // Use common variables
      error_file: './logs/pm2-scheduler-error.log',
      out_file: './logs/pm2-scheduler-out.log',
      log_file: './logs/pm2-scheduler-combined.log',
      time: true,
    },
  ],
};
