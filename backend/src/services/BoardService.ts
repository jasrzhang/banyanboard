import type { BoardRepository, BoardListItem, BoardFull } from '../repositories/BoardRepository.js';

export class BoardService {
  constructor(private readonly boardRepo: BoardRepository) {}

  async listBoards(): Promise<BoardListItem[]> {
    return this.boardRepo.findAll();
  }

  async getBoard(boardId: string): Promise<BoardFull | null> {
    return this.boardRepo.findByIdWithColumnsAndCards(boardId);
  }

  async createBoard(name: string): Promise<BoardFull | null> {
    return this.boardRepo.createWithDefaultColumns(name);
  }
}
