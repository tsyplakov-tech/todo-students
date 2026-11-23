import js from '@eslint/js';
import globals from 'globals';
export default [
  { ignores: ['node_modules/**', 'generated/**', 'dist/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  { rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }] } },
  { files: ['**/*.{js,mjs}'], languageOptions: { ecmaVersion: 2024, sourceType: 'module', globals: globals.node } },
  { files: ['public/**/*.js'], languageOptions: { globals: globals.browser } },
];
