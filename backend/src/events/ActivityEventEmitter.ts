import { EventEmitter } from 'events';

export type ActivityEventType = 'card_created' | 'card_moved' | 'card_updated' | 'card_deleted';

export interface ActivityEvent {
  boardId: string;
  cardId: string | null;
  eventType: ActivityEventType;
  payload: Record<string, unknown>;
}

export class ActivityEventEmitter {
  private readonly inner = new EventEmitter();

  constructor() {
    // One listener per SSE client connection — allow unlimited.
    this.inner.setMaxListeners(0);
  }

  emit(data: ActivityEvent): void {
    this.inner.emit('activity', data);
  }

  on(listener: (data: ActivityEvent) => void): this {
    this.inner.on('activity', listener);
    return this;
  }

  off(listener: (data: ActivityEvent) => void): this {
    this.inner.off('activity', listener);
    return this;
  }

  listenerCount(): number {
    return this.inner.listenerCount('activity');
  }
}

export const activityEmitter = new ActivityEventEmitter();
