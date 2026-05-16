export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  [key: string]: unknown;
}

export interface TraceContext {
  traceId: string;
  spanId: string;
}

export interface Logger {
  trace(message: string, context?: LogContext): void;
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, errorOrContext?: Error | LogContext, context?: LogContext): void;
  fatal(message: string, errorOrContext?: Error | LogContext, context?: LogContext): void;
  child(context: LogContext): Logger;
  withTraceContext(traceContext: TraceContext): Logger;
}
