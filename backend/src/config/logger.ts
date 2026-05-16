import pino from 'pino';
import type { Writable } from 'node:stream';
import type { Logger, LogContext, TraceContext } from '../types/logger.js';
import { config as appConfig, type Config } from './env.js';

function wrapPino(p: pino.Logger): Logger {
  return {
    trace(message, context) {
      p.trace(context ?? {}, message);
    },
    debug(message, context) {
      p.debug(context ?? {}, message);
    },
    info(message, context) {
      p.info(context ?? {}, message);
    },
    warn(message, context) {
      p.warn(context ?? {}, message);
    },
    error(message, errOrCtx?: Error | LogContext, ctx?: LogContext) {
      if (errOrCtx instanceof Error) {
        p.error({ err: errOrCtx, ...(ctx ?? {}) }, message);
      } else {
        p.error({ ...(errOrCtx ?? {}), ...(ctx ?? {}) }, message);
      }
    },
    fatal(message, errOrCtx?: Error | LogContext, ctx?: LogContext) {
      if (errOrCtx instanceof Error) {
        p.fatal({ err: errOrCtx, ...(ctx ?? {}) }, message);
      } else {
        p.fatal({ ...(errOrCtx ?? {}), ...(ctx ?? {}) }, message);
      }
    },
    child(context: LogContext) {
      return wrapPino(p.child(context));
    },
    withTraceContext({ traceId, spanId }: TraceContext) {
      return wrapPino(p.child({ traceId, spanId }));
    },
  };
}

export function createLogger(deps: { config: Config; destination?: Writable }): Logger {
  const { config, destination } = deps;

  const options: pino.LoggerOptions = {
    level: config.log.level,
    redact: {
      paths: config.log.redactPatterns.map((p) => p.trim()).filter(Boolean),
      censor: '[Redacted]',
    },
    base: {
      service: config.serviceName,
      version: config.serviceVersion,
      environment: config.nodeEnv,
    },
  };

  if (config.log.format === 'text' && !destination) {
    options.transport = {
      target: 'pino-pretty',
      options: { colorize: true },
    };
  }

  const instance = destination ? pino(options, destination) : pino(options);
  return wrapPino(instance);
}

export const rootLogger: Logger = createLogger({ config: appConfig });
