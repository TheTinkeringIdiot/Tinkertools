// ESLint flat config
import js from '@eslint/js';
import vuePlugin from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: ['dist', 'node_modules', 'coverage', 'playwright-report', 'test-results'],
  },
  js.configs.recommended,
  // `recommended`, not the type-checked presets: the codebase still leans on
  // `any` (API responses, stores), which makes the no-unsafe-* family noise for
  // now. The type-aware rules that catch real bugs are enabled below.
  ...tseslint.configs.recommended,
  ...vuePlugin.configs['flat/recommended'],
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './e2e/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
      },
    },
    rules: {
      // Allow single-word component names
      'vue/multi-word-component-names': 'off',
      // Promise misuse: silently dropped errors and ordering bugs.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },
  {
    // The typescript-eslint presets set their parser for every file; .vue files
    // need vue-eslint-parser on the outside, handing <script lang="ts"> to it.
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tseslint.parser,
        project: ['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: ['.vue'],
      },
    },
  },
  {
    // Tooling config files are not part of any tsconfig project.
    files: ['*.config.{js,ts,cjs,mjs}'],
    ...tseslint.configs.disableTypeChecked,
  },
  // Formatting is Prettier's job (`prettier --check`); turn off every rule that
  // would fight it. Must stay last.
  prettierConfig,
];
