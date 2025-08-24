// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
  eslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': tseslint
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...tseslint.configs['recommended-requiring-type-checking'].rules,
      
      // Gaming-specific rules for performance and security
      'no-console': 'warn', // Allow console for Lambda logging but warn
      'prefer-const': 'error',
      'no-var': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      
      // SOLID principles enforcement
      'max-params': ['error', 4], // Single Responsibility
      'max-lines-per-function': ['warn', 50], // Single Responsibility
      'complexity': ['warn', 10], // Open/Closed principle
      
      // Security rules for gaming context
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-implied-eval': 'error'
    }
  },
  {
    files: ['**/*.test.ts', 'test/**/*.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'max-lines-per-function': 'off'
    }
  },
  {
    ignores: [
      'node_modules/',
      'lib/',
      'cdk.out/',
      '*.d.ts',
      '*.js'
    ]
  }
];