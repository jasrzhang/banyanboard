/**
 * 12-Factor Configuration Module
 *
 * Loads environment-specific configuration at startup.
 * Fails immediately (before app starts) if any required environment variable is missing.
 * Follows the 12-Factor App pattern: all environment-specific values come from process.env.
 *
 * All configuration is frozen to prevent accidental mutation.
 *
 * Usage:
 *   import { config } from './config/env.js';
 *   const port = config.port;
 */
import 'dotenv/config';

/**
 * Custom error for configuration validation failures.
 * Distinguishes config problems from other startup errors.
 */
class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Reads a required environment variable.
 * Throws ConfigurationError if not set.
 * Call this at module load time to fail fast if critical config is missing.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new ConfigurationError(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Reads an optional environment variable with a default fallback.
 */
function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

/**
 * Reads an optional environment variable as an integer.
 * Validates that the value (or default) parses to a finite integer.
 * Throws ConfigurationError if parsing fails.
 */
function optionalIntEnv(key: string, defaultValue: number): number {
  const raw = optionalEnv(key, String(defaultValue));
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new ConfigurationError(
      `Environment variable ${key} must be a finite integer, got: "${raw}"`,
    );
  }
  return parsed;
}

/**
 * Application configuration object.
 * All values are loaded from environment variables at startup.
 * Frozen to prevent accidental mutation.
 * Any missing required variable (e.g., DATABASE_URL) causes a ConfigurationError at require time.
 */
export const config = Object.freeze({
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  port: parseInt(optionalEnv('PORT', '3001'), 10),
  databaseUrl: requireEnv('DATABASE_URL'), // REQUIRED: database connection string
  serviceName: optionalEnv('SERVICE_NAME', 'banyanboard-backend'),
  serviceVersion: optionalEnv('SERVICE_VERSION', process.env['npm_package_version'] ?? '0.0.0'),
  log: {
    level: optionalEnv('LOG_LEVEL', 'info'),
    format: optionalEnv('LOG_FORMAT', 'json'),
    output: optionalEnv('LOG_OUTPUT', 'stdout'),
    redactPatterns: optionalEnv(
      'LOG_REDACT_PATTERNS',
      'password,secret,token,apiKey,authorization',
    ).split(','),
  },
  pg: {
    poolMax: optionalIntEnv('PG_POOL_MAX', 10),
    poolIdleTimeoutMs: optionalIntEnv('PG_POOL_IDLE_TIMEOUT_MS', 30000),
    connectionTimeoutMs: optionalIntEnv('PG_CONNECTION_TIMEOUT_MS', 10000),
  },
  cards: {
    positionGap: optionalIntEnv('CARD_POSITION_GAP', 1000),
  },
  sse: {
    heartbeatIntervalMs: optionalIntEnv('SSE_HEARTBEAT_INTERVAL_MS', 25000),
  },
});

export type Config = typeof config;
