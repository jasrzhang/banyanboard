type LogContext = Record<string, unknown>;

interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, errorOrContext?: Error | LogContext, context?: LogContext): void;
}

const isDev = import.meta.env.DEV;

// This file is the only sanctioned console wrapper (see eslint.config.js no-console override).
// warn and error always surface — even in production builds.
export const logger: Logger = {
  debug: isDev ? (m, c) => console.debug(`[debug] ${m}`, c ?? '') : () => {},
  info: isDev ? (m, c) => console.info(`[info] ${m}`, c ?? '') : () => {},
  warn: (m, c) => console.warn(`[warn] ${m}`, c ?? ''),
  error: (m, e, c) => console.error(`[error] ${m}`, e ?? '', c ?? ''),
};
