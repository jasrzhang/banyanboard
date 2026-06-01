import type { Pool } from 'pg';

export interface UserRow {
  id: string;
  firstName: string;
}

export class UserRepository {
  constructor(private readonly pool: Pool) {}

  async findOrCreate(firstName: string): Promise<UserRow> {
    const result = await this.pool.query<{ id: string; first_name: string }>(
      `INSERT INTO users (first_name)
       VALUES ($1)
       ON CONFLICT (first_name) DO UPDATE SET first_name = EXCLUDED.first_name
       RETURNING id, first_name`,
      [firstName],
    );
    const row = result.rows[0]!;
    return { id: row.id, firstName: row.first_name };
  }
}
