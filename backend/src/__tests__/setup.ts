// Sets DATABASE_URL before any test module loads so config/env.ts doesn't throw.
// Default matches docker-compose.yml defaults; override via TEST_DATABASE_URL for CI.
if (!process.env['DATABASE_URL']) {
  process.env['DATABASE_URL'] =
    process.env['TEST_DATABASE_URL'] ?? 'postgres://banyan:changeme@localhost:5432/banyanboard';
}
