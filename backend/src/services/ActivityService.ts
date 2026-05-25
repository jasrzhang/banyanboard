import type { ActivityRepository, ActivityEventRow } from '../repositories/ActivityRepository.js';
import type { ActivityEvent, ActivityEventEmitter } from '../events/ActivityEventEmitter.js';
import { rootLogger } from '../config/logger.js';

export class ActivityService {
  constructor(
    private readonly repo: ActivityRepository,
    private readonly emitter: ActivityEventEmitter,
  ) {}

  async recordEvent(event: ActivityEvent): Promise<void> {
    try {
      await this.repo.insert({
        boardId: event.boardId,
        cardId: event.cardId,
        eventType: event.eventType,
        payload: event.payload,
      });
    } catch (err) {
      rootLogger.warn('ActivityService.recordEvent DB write failed', {
        boardId: event.boardId,
        cardId: event.cardId,
        eventType: event.eventType,
        err,
      });
    }
    this.emitter.emit(event);
  }

  async getByBoardId(boardId: string): Promise<ActivityEventRow[]> {
    return this.repo.findByBoardId(boardId);
  }
}
