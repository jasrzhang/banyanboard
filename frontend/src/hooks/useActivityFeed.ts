import { useState, useEffect, useCallback } from 'react';
import { fetchActivity } from '../api/activitiesApi';
import type { ActivityEvent } from '../types/domain';
import { logger } from '../utils/logger';
import { apiClient } from '../api/apiClient';

export type ActivityFeedStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface UseActivityFeedResult {
  events: ActivityEvent[];
  status: ActivityFeedStatus;
  retry: () => void;
}

export function useActivityFeed(boardId: string): UseActivityFeedResult {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [status, setStatus] = useState<ActivityFeedStatus>('connecting');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    fetchActivity(boardId).then(setEvents).catch((err: unknown) => {
      logger.warn('Failed to load initial activity', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, [boardId]);

  useEffect(() => {
    const sseUrl = `${apiClient.baseUrl}/api/boards/${boardId}/activity-stream`;
    let hasConnected = false;
    const es = new EventSource(sseUrl);

    es.onopen = () => {
      hasConnected = true;
      setStatus('connected');
    };

    es.onmessage = (event: MessageEvent<string>) => {
      try {
        const data = JSON.parse(event.data) as ActivityEvent;
        setEvents((prev) => [data, ...prev]);
      } catch {
        logger.warn('Failed to parse SSE activity event');
      }
    };

    es.onerror = () => {
      setStatus(hasConnected ? 'reconnecting' : 'error');
    };

    return () => {
      es.close();
    };
  }, [boardId, retryKey]);

  const retry = useCallback(() => {
    setStatus('connecting');
    setRetryKey((k) => k + 1);
  }, []);

  return { events, status, retry };
}
