// Integration tests for the Activity Feed — Phase 2: Backend SSE Transport.
// Covers: ActivitySSEController, GET /api/boards/:boardId/activity-stream endpoint.
// Uses a real HTTP server (random port) and Node.js http module for SSE stream access.
// Requires a running PostgreSQL instance (docker compose up -d db).
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { pool } from '../config/db.js';
import { ActivityEventEmitter, activityEmitter } from '../events/ActivityEventEmitter.js';

/** Suppress ECONNRESET errors that are expected when the test destroys a connection. */
function ignoreConnReset(err: Error): void {
  if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET') throw err;
}

describe('Activity Feed — SSE Transport', () => {
  let httpServer: http.Server;
  let baseUrl: string;
  let boardId: string;

  beforeAll(async () => {
    const boardRes = await pool.query<{ id: string }>(
      "INSERT INTO boards (name) VALUES ('SSE Test Board') RETURNING id",
    );
    boardId = boardRes.rows[0]!.id;

    await new Promise<void>((resolve) => {
      httpServer = http.createServer(createApp());
      httpServer.listen(0, resolve);
    });
    baseUrl = `http://localhost:${(httpServer.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    // Force-close any lingering SSE connections so httpServer.close() completes.
    httpServer.closeAllConnections();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
    await pool.query('DELETE FROM boards WHERE id = $1', [boardId]);
  });

  // ── SSE connection headers ─────────────────────────────────────────────────

  it('SSE client connecting to activity-stream receives text/event-stream headers', async () => {
    let clientReq: http.ClientRequest | null = null;
    try {
      await new Promise<void>((resolve, reject) => {
        clientReq = http.get(
          `${baseUrl}/api/boards/${boardId}/activity-stream`,
          (res) => {
            expect(res.statusCode).toBe(200);
            expect(res.headers['content-type']).toContain('text/event-stream');
            expect(res.headers['cache-control']).toBe('no-cache');
            res.resume();
            resolve();
          },
        );
        clientReq.on('error', ignoreConnReset);
        setTimeout(() => reject(new Error('Timed out waiting for SSE headers')), 3000);
      });
    } finally {
      clientReq?.destroy();
    }
  });

  // ── Event delivery ─────────────────────────────────────────────────────────

  it('emitted activity event is received as an SSE data frame by the connected client', async () => {
    const testEvent = {
      boardId,
      cardId: null as null,
      eventType: 'card_created' as const,
      payload: { cardTitle: 'SSE Frame Test' },
    };

    let clientReq: http.ClientRequest | null = null;
    try {
      await new Promise<void>((resolve, reject) => {
        let resolved = false;
        let buffer = '';
        let connectionReady = false;

        clientReq = http.get(
          `${baseUrl}/api/boards/${boardId}/activity-stream`,
          (res) => {
            res.setEncoding('utf-8');

            res.on('data', (chunk: string) => {
              buffer += chunk;

              if (!connectionReady && buffer.includes(': connected')) {
                connectionReady = true;
                // Listener is now registered — emit the test event
                activityEmitter.emit(testEvent);
              }

              const dataMatch = /^data: (.+)$/m.exec(buffer);
              if (dataMatch && connectionReady && !resolved) {
                try {
                  const parsed = JSON.parse(dataMatch[1]!) as Record<string, unknown>;
                  expect(parsed['eventType']).toBe('card_created');
                  expect(parsed['boardId']).toBe(boardId);
                  resolved = true;
                  resolve();
                } catch (e) {
                  resolved = true;
                  reject(e as Error);
                }
              }
            });

            res.on('error', () => {});
          },
        );

        clientReq.on('error', (err) => {
          if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET' && !resolved) reject(err);
        });

        setTimeout(() => {
          if (!resolved) reject(new Error('SSE data frame not received within timeout'));
        }, 3000);
      });
    } finally {
      clientReq?.destroy();
    }
  });

  // ── Listener cleanup on disconnect ─────────────────────────────────────────

  it('SSE listener is removed from the emitter when the client disconnects', async () => {
    // Wait for any cleanup from previous tests to settle before capturing baseline
    await new Promise<void>((resolve) => setTimeout(resolve, 150));

    const countBefore = activityEmitter.listenerCount();
    let clientReq: http.ClientRequest | null = null;

    try {
      // Establish connection; wait for ": connected" comment which confirms the
      // server-side listener has been registered synchronously before the write.
      await new Promise<void>((resolve, reject) => {
        let done = false;
        clientReq = http.get(
          `${baseUrl}/api/boards/${boardId}/activity-stream`,
          (res) => {
            res.setEncoding('utf-8');
            res.on('data', (chunk: string) => {
              if (!done && chunk.includes(': connected')) {
                done = true;
                resolve();
              }
            });
            res.on('error', () => {});
          },
        );
        clientReq.on('error', (err) => {
          if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET' && !done) reject(err);
        });
        setTimeout(() => {
          if (!done) reject(new Error('SSE connection not established'));
        }, 3000);
      });

      // One extra listener should now be registered
      expect(activityEmitter.listenerCount()).toBe(countBefore + 1);

      // Destroy the client connection — server fires req.on('close') cleanup
      clientReq!.destroy();
      await new Promise<void>((resolve) => setTimeout(resolve, 150));

      expect(activityEmitter.listenerCount()).toBe(countBefore);
    } finally {
      if (clientReq && !clientReq.destroyed) clientReq.destroy();
    }
  });

  // ── Board-scoped filtering ─────────────────────────────────────────────────

  it('events emitted for a different board are NOT delivered to the SSE stream', async () => {
    const otherBoardRes = await pool.query<{ id: string }>(
      "INSERT INTO boards (name) VALUES ('Other SSE Board') RETURNING id",
    );
    const otherBoardId = otherBoardRes.rows[0]!.id;

    let spuriousDataReceived = false;
    let clientReq: http.ClientRequest | null = null;

    try {
      await new Promise<void>((resolve, reject) => {
        let connectionReady = false;

        clientReq = http.get(
          `${baseUrl}/api/boards/${boardId}/activity-stream`,
          (res) => {
            res.setEncoding('utf-8');

            res.on('data', (chunk: string) => {
              if (!connectionReady && chunk.includes(': connected')) {
                connectionReady = true;
                // Emit an event for the OTHER board — must not appear in this stream
                activityEmitter.emit({
                  boardId: otherBoardId,
                  cardId: null,
                  eventType: 'card_created',
                  payload: { cardTitle: 'Wrong Board Card' },
                });
              }

              if (connectionReady && /^data:/m.test(chunk)) {
                spuriousDataReceived = true;
              }
            });

            res.on('error', () => {});
          },
        );

        clientReq.on('error', (err) => {
          if ((err as NodeJS.ErrnoException).code !== 'ECONNRESET') reject(err);
        });

        // Wait long enough to be confident no spurious frame arrives
        setTimeout(() => resolve(), 200);
      });
    } finally {
      clientReq?.destroy();
    }

    expect(spuriousDataReceived).toBe(false);
    await pool.query('DELETE FROM boards WHERE id = $1', [otherBoardId]);
  });

  // ── Zero-listener safety ───────────────────────────────────────────────────

  it('ActivityEventEmitter does not throw when emitting with no listeners', () => {
    const emitter = new ActivityEventEmitter();
    expect(emitter.listenerCount()).toBe(0);
    expect(() => {
      emitter.emit({
        boardId: 'test-board-id',
        cardId: null,
        eventType: 'card_created',
        payload: {},
      });
    }).not.toThrow();
  });
});
