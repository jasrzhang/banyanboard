import { config } from './config/env.js';
import { createApp } from './app.js';
import { checkDatabaseConnection, closePool } from './config/db.js';
import { rootLogger } from './config/logger.js';

async function start(): Promise<void> {
  await checkDatabaseConnection().catch((err: unknown) => {
    rootLogger.error(
      'Database connectivity check failed',
      err instanceof Error ? err : new Error(String(err)),
    );
    process.exit(1);
  });

  const app = createApp();

  const server = app.listen(config.port, () => {
    rootLogger.info('Server started', { port: config.port });
  });

  let shuttingDown = false;
  function gracefulShutdown(): void {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(() => {
      void closePool().finally(() => process.exit(0));
    });
  }

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

start().catch((err: unknown) => {
  rootLogger.error(
    'Unexpected startup error',
    err instanceof Error ? err : new Error(String(err)),
  );
  process.exit(1);
});
