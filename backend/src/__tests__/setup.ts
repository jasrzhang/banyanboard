// Ensure DATABASE_URL is set before config/env.ts is loaded.
// Override by setting TEST_DATABASE_URL in your environment.
// Phase 4 will point this at the real compose Postgres via TEST_DATABASE_URL or DATABASE_URL.
if (!process.env['DATABASE_URL']) {
  process.env['DATABASE_URL'] =
    process.env['TEST_DATABASE_URL'] ?? 'postgres://test:test@localhost:5432/test';
}
