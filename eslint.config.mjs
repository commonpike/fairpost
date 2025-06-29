import jsdoc from 'eslint-plugin-jsdoc';
import prettier from 'eslint-plugin-prettier';
import typescript from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      prettier,
      jsdoc,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      ...prettier.configs.recommended.rules,
      ...jsdoc.configs.recommended.rules,
      "prettier/prettier": 'error',
      "jsdoc/require-jsdoc": 'off',
      "jsdoc/require-param-description" : 'off',
      "jsdoc/require-param-type" : 'off',
      "jsdoc/require-returns-type" : 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': ['warn', { allowWithName: '.*Dto' }],
      "@typescript-eslint/no-floating-promises": "error",
    },
    
  },
  {
    ignores: ['node_modules/', 'dist/', 'users/', 'build/'],
  }
];