// @ts-check
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        args: 'all',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-console': 'error',
    },
  },
  // Layering enforcement: controllers may not import the DB layer
  {
    files: ['src/controllers/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: 'pg',
            message: 'Controllers may not import database drivers. Delegate to a Service which calls a Repository.',
          },
          {
            name: '@prisma/client',
            message: 'Controllers may not import ORM clients. Delegate to a Service which calls a Repository.',
          },
          {
            name: 'kysely',
            message: 'Controllers may not import query builders. Delegate to a Service which calls a Repository.',
          },
        ],
        patterns: [
          {
            group: ['**/repositories/**'],
            message: 'Controllers may not import from repositories. Call a Service instead.',
          },
          {
            group: ['**/config/db*'],
            message: 'Controllers may not import the DB pool. Call a Service instead.',
          },
        ],
      }],
    },
  },
  // Layering enforcement: services may not import the DB pool directly
  {
    files: ['src/services/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          {
            name: 'pg',
            message: 'Services may not import pg directly. Delegate to a Repository.',
          },
        ],
        patterns: [
          {
            group: ['**/config/db*'],
            message: 'Services may not import the DB pool. Use a Repository.',
          },
        ],
      }],
    },
  },
  {
    files: ['src/**/*.test.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
