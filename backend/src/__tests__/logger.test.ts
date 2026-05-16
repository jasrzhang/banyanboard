import { describe, it, expect } from 'vitest';
import { Writable } from 'node:stream';
import { createLogger } from '../config/logger.js';
import type { Config } from '../config/env.js';

function makeConfig(overrides: { level?: string; format?: string; redactPatterns?: string[] } = {}): Config {
  return {
    nodeEnv: 'test',
    port: 3001,
    databaseUrl: 'postgres://test:test@localhost:5432/test',
    serviceName: 'test-service',
    serviceVersion: '0.0.1',
    log: {
      level: overrides.level ?? 'debug',
      format: overrides.format ?? 'json',
      output: 'stdout',
      redactPatterns: overrides.redactPatterns ?? ['password', 'secret', 'token', 'apiKey', 'authorization'],
    },
    pg: {
      poolMax: 10,
      poolIdleTimeoutMs: 30000,
      connectionTimeoutMs: 10000,
    },
  } as unknown as Config;
}

function captureLogger(overrides: { level?: string; format?: string; redactPatterns?: string[] } = {}) {
  const lines: string[] = [];
  const dest = new Writable({
    write(chunk, _enc, cb) {
      const str = (chunk as Buffer).toString().trim();
      if (str) lines.push(str);
      cb();
    },
  });
  const logger = createLogger({ config: makeConfig(overrides), destination: dest });
  return { logger, lines };
}

describe('Logger', () => {
  it('emits JSON with required fields (level, time, msg, service, version) when LOG_FORMAT=json', () => {
    const { logger, lines } = captureLogger({ format: 'json' });
    logger.info('test message');
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(parsed['level']).toBeTypeOf('number');
    expect(parsed['time']).toBeTypeOf('number');
    expect(parsed['msg']).toBe('test message');
    expect(parsed['service']).toBe('test-service');
    expect(parsed['version']).toBe('0.0.1');
  });

  it('LOG_LEVEL=warn suppresses info-level messages', () => {
    const { logger, lines } = captureLogger({ level: 'warn' });
    logger.info('should be suppressed');
    expect(lines).toHaveLength(0);
    logger.warn('should appear');
    expect(lines).toHaveLength(1);
  });

  it('withTraceContext produces a logger whose output includes traceId and spanId', () => {
    const { logger, lines } = captureLogger();
    const traced = logger.withTraceContext({ traceId: 'abc123def456abc123def456abc123de', spanId: 'abc123def456abc1' });
    traced.info('trace test');
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(parsed['traceId']).toBe('abc123def456abc123def456abc123de');
    expect(parsed['spanId']).toBe('abc123def456abc1');
    expect(parsed['msg']).toBe('trace test');
  });

  it('redacts sensitive fields (password) with [Redacted]', () => {
    const { logger, lines } = captureLogger({ redactPatterns: ['password'] });
    logger.info('auth event', { password: 'secret123', username: 'alice' });
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!) as Record<string, unknown>;
    expect(parsed['password']).toBe('[Redacted]');
    expect(parsed['username']).toBe('alice');
  });
});
