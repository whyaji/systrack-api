// Security configuration and utilities
import env from './env';
import { logger } from './logger';

export const SECURITY_CONFIG = {
  // Rate limiting
  FORM_RATE_LIMIT: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 submissions per IP
  },
  API_RATE_LIMIT: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per IP
  },

  // Input validation
  MAX_TEXT_LENGTH: 1000,
  MAX_EMAIL_LENGTH: 254,
  MAX_PHONE_LENGTH: 15,

  // Suspicious patterns
  SUSPICIOUS_PATTERNS: [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /expression\s*\(/i,
    /vbscript:/i,
    /data:text\/html/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<link/i,
    /<meta/i,
    /<style/i,
    /sql\s+injection/i,
    /union\s+select/i,
    /drop\s+table/i,
    /delete\s+from/i,
    /insert\s+into/i,
    /update\s+set/i,
    /exec\s*\(/i,
    /system\s*\(/i,
    /shell_exec/i,
    /passthru/i,
    /proc_open/i,
    /popen/i,
  ],

  // Suspicious IPs (privateRanges)
  SUSPICIOUS_IPS: [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^::1$/,
    /^fe80:/,
  ],

  // Blocked user agents
  BLOCKED_USER_AGENTS: [
    'bot',
    'crawler',
    'spider',
    'scraper',
    'curl',
    'wget',
    'python',
    'java',
    'php',
    'perl',
    'ruby',
    'go-http',
    'okhttp',
    'apache',
    'libwww',
    'lwp',
    'winhttp',
    'webbandit',
    'netmechanic',
    'sitecheck',
    'proximic',
    'ahrefs',
    'semrush',
    'majestic',
    'screaming',
    'sistrix',
    'linkdex',
    'blexbot',
    'dotbot',
    'mj12bot',
    'yandexbot',
    'bingbot',
    'googlebot',
    'facebook',
    'twitter',
    'linkedin',
    'whatsapp',
    'telegram',
    'discord',
    'slack',
  ],

  // Content Security Policy
  CSP: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"], // masih boleh inline style
    scriptSrc: ["'self'", 'https://challenges.cloudflare.com', 'https://*.cloudflare.com'],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'", 'https://challenges.cloudflare.com'],
    fontSrc: ["'self'"],
    objectSrc: ["'none'"],
    mediaSrc: ["'self'"],
    frameSrc: ["'self'", 'https://challenges.cloudflare.com', 'https://*.cloudflare.com'],
  },
};

export const sanitizeText = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['"]/g, '') // Remove quotes that could break SQL
    .substring(0, SECURITY_CONFIG.MAX_TEXT_LENGTH); // Limit length
};

export const containsSuspiciousPatterns = (text: string): boolean => {
  return SECURITY_CONFIG.SUSPICIOUS_PATTERNS.some((pattern) => pattern.test(text));
};

export const isBlockedUserAgent = (userAgent: string): boolean => {
  const ua = userAgent.toLowerCase();
  return SECURITY_CONFIG.BLOCKED_USER_AGENTS.some((blocked) => ua.includes(blocked));
};

export const isSuspiciousIP = (ip: string): boolean => {
  return SECURITY_CONFIG.SUSPICIOUS_IPS.some((range) => range.test(ip));
};

/**
 * Verify Cloudflare Turnstile token
 * @param token - The Turnstile token from the client
 * @param ip - The client's IP address (optional)
 * @returns Promise<boolean> - true if verification succeeds
 */
export async function verifyTurnstileToken(token: string, ip?: string): Promise<boolean> {
  try {
    const formData = new FormData();
    formData.append('secret', env.TURNSTILE_SECRET_KEY);
    formData.append('response', token);
    if (ip) {
      formData.append('remoteip', ip);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      logger.error(
        `Turnstile verification request failed: ${response.status} ${response.statusText}`
      );
      return false;
    }

    const result = await response.json();

    if (result.success) {
      logger.info('Turnstile verification successful');
      return true;
    } else {
      logger.warn('Turnstile verification failed:', result['error-codes'] || 'Unknown error');
      return false;
    }
  } catch (error) {
    logger.error(`Error verifying Turnstile token: ${String(error)}`);
    return false;
  }
}
