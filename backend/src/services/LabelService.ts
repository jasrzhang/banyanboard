import type { LabelRepository, LabelRow } from '../repositories/LabelRepository.js';
export { DuplicateLabelError } from '../repositories/LabelRepository.js';

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
}
