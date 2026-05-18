/**
 * Tests for src/api/apiClient.ts
 *
 * AC-HAPPY-3: API client reads VITE_API_BASE_URL and exposes correct baseUrl
 * AC-ERROR-1:  When VITE_API_BASE_URL is absent, client falls back to
 *              http://localhost:3001 and emits a warning via the logger
 *              (not console.warn directly).
 *
 * Testing pattern: vi.stubEnv + vi.resetModules() + dynamic import ensures each
 * test re-initialises the module with the env var value in effect at import time.
 * See: https://vitest.dev/api/#vi-stubenv
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('apiClient', () => {
  beforeEach(() => {
    // Reset module registry so apiClient re-executes its top-level initialisation
    // with the env stub that is applied before the import in each test.
    vi.resetModules();
  });

  afterEach(() => {
    // Restore all stubbed env vars after every test.
    vi.unstubAllEnvs();
  });

  describe('when VITE_API_BASE_URL is set', () => {
    it('exposes the configured URL as baseUrl', async () => {
      vi.stubEnv('VITE_API_BASE_URL', 'http://api.example.com:4000');

      const { apiClient } = await import('./apiClient');

      expect(apiClient.baseUrl).toBe('http://api.example.com:4000');
    });
  });

  describe('when VITE_API_BASE_URL is not set', () => {
    it('falls back to http://localhost:3001 and warns via the logger', async () => {
      // Stub to empty string to trigger the fallback path.
      vi.stubEnv('VITE_API_BASE_URL', '');

      // Import logger first so it is cached in the module registry.
      // Spy on its warn method before apiClient is imported — apiClient will
      // import the same cached logger instance and trigger the spy when the
      // module-level fallback code runs.
      const loggerModule = await import('../utils/logger');
      const warnSpy = vi.spyOn(loggerModule.logger, 'warn');

      // Import apiClient — it reuses the already-cached logger (with spy attached).
      const { apiClient } = await import('./apiClient');

      expect(apiClient.baseUrl).toBe('http://localhost:3001');
      expect(warnSpy).toHaveBeenCalledOnce();
      // The warning must mention the missing env var so the message is actionable.
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('VITE_API_BASE_URL'),
      );
    });

    it('exposes get, post, patch, and delete typed methods', async () => {
      vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:3001');

      const { apiClient } = await import('./apiClient');

      expect(typeof apiClient.get).toBe('function');
      expect(typeof apiClient.post).toBe('function');
      expect(typeof apiClient.patch).toBe('function');
      expect(typeof apiClient.delete).toBe('function');
    });
  });
});
