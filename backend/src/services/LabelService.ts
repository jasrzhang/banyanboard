import type { LabelRepository, LabelRow } from '../repositories/LabelRepository.js';
export { DuplicateLabelError, InvalidLabelAssignmentError } from '../repositories/LabelRepository.js';

export class LabelService {
  constructor(private readonly repo: LabelRepository) {}

  async listForBoard(boardId: string): Promise<LabelRow[]> {
    return this.repo.findByBoardId(boardId);
  }

  async createLabel(input: {
    boardId: string;
    name: string;
    color: string;
    icon?: string | null;
  }): Promise<LabelRow> {
    const trimmed = input.name.trim();
    return this.repo.create({ ...input, name: trimmed });
  }

  async updateLabel(
    boardId: string,
    labelId: string,
    input: { name?: string; color?: string; icon?: string | null },
  ): Promise<LabelRow | null> {
    const existing = await this.repo.findById(labelId);
    if (!existing || existing.boardId !== boardId) return null;
    const trimmed = input.name?.trim();
    return this.repo.update(labelId, {
      ...input,
      ...(trimmed !== undefined ? { name: trimmed } : {}),
    });
  }

  async deleteLabel(boardId: string, labelId: string): Promise<boolean> {
    const existing = await this.repo.findById(labelId);
    if (!existing || existing.boardId !== boardId) return false;
    return this.repo.delete(labelId);
  }

  async replaceCardLabels(
    cardId: string,
    labelIds: string[],
  ): Promise<{
    cardId: string;
    boardId: string;
    labels: LabelRow[];
    added: string[];
    removed: string[];
  } | null> {
    const boardId = await this.repo.getCardBoardId(cardId);
    if (!boardId) return null;

    const before = await this.repo.getAssignedLabelIds(cardId);
    const labels = await this.repo.replaceAssignments(cardId, labelIds);

    const beforeSet = new Set(before);
    const afterSet = new Set(labelIds);
    const added = labelIds.filter((id) => !beforeSet.has(id));
    const removed = before.filter((id) => !afterSet.has(id));

    return { cardId, boardId, labels, added, removed };
  }
}
