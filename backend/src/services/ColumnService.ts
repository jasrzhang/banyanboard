import type { ColumnRepository } from '../repositories/ColumnRepository.js';
import type { CardRepository, CardRow } from '../repositories/CardRepository.js';
import type { CreateCardInput } from '../schemas/cardSchemas.js';

export class ColumnService {
  constructor(
    private readonly columnRepo: ColumnRepository,
    private readonly cardRepo: CardRepository,
  ) {}

  async createCard(columnId: string, input: CreateCardInput): Promise<CardRow | null> {
    const columnExists = await this.columnRepo.exists(columnId);
    if (!columnExists) return null;
    return this.cardRepo.create(columnId, input.title, input.description, input.dueDate);
  }

  async getColumnInfo(columnId: string): Promise<{ boardId: string; name: string } | null> {
    const col = await this.columnRepo.findById(columnId);
    if (!col) return null;
    return { boardId: col.boardId, name: col.name };
  }
}
