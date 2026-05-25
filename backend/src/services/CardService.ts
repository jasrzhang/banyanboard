import type { CardRepository, CardRow } from '../repositories/CardRepository.js';
import type { UpdateCardInput } from '../schemas/cardSchemas.js';

export class CardService {
  constructor(private readonly cardRepo: CardRepository) {}

  async getCardContext(cardId: string): Promise<{ columnId: string; boardId: string; title: string } | null> {
    return this.cardRepo.getContext(cardId);
  }

  async updateCard(cardId: string, input: UpdateCardInput): Promise<CardRow | null> {
    const exists = await this.cardRepo.exists(cardId);
    if (!exists) return null;

    // If only columnId/position are changing this is a card move — use the dedicated move path
    // for clarity, but the general update method handles both cases.
    return this.cardRepo.update(cardId, {
      title: input.title,
      description: input.description,
      dueDate: input.dueDate,
      columnId: input.columnId,
      position: input.position,
    });
  }
}
