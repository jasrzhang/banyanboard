import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const controllersDir = resolve(__dirname, '..', 'controllers');

function getControllerFiles(): string[] {
  return readdirSync(controllersDir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
    .map((f) => join(controllersDir, f));
}

function readFile(filePath: string): string {
  return readFileSync(filePath, 'utf-8');
}

describe('Layering enforcement — controllers/', () => {
  it('no controller imports the pg driver or ORM clients', () => {
    const violations: string[] = [];
    for (const filePath of getControllerFiles()) {
      const content = readFile(filePath);
      if (/from ['"]pg['"]/i.test(content) || /require\(['"]pg['"]\)/i.test(content)) {
        violations.push(filePath);
      }
    }
    expect(violations, `Controllers with pg imports: ${violations.join(', ')}`).toHaveLength(0);
  });

  it('no controller contains raw SQL string literals', () => {
    const sqlPattern = /\b(SELECT|INSERT|UPDATE|DELETE)\b.*\b(FROM|INTO|WHERE)\b/i;
    const violations: string[] = [];
    for (const filePath of getControllerFiles()) {
      const content = readFile(filePath);
      if (sqlPattern.test(content)) {
        violations.push(filePath);
      }
    }
    expect(violations, `Controllers with raw SQL: ${violations.join(', ')}`).toHaveLength(0);
  });
});
