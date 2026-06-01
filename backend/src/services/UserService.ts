import type { UserRepository, UserRow } from '../repositories/UserRepository.js';

export class UserService {
  constructor(private readonly repo: UserRepository) {}

  async login(firstName: string): Promise<UserRow> {
    return this.repo.findOrCreate(firstName);
  }
}
