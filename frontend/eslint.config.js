/* eslint config (flat) */
import js from '@eslint/js';
import vuePlugin from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'dist',
      'node_modules'
    ]
  },
  js.configs.recommended,
  ...vuePlugin.configs['flat/recommended'],
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json']
      }
    },
    rules: {
      'prettier/prettier': ['error'],
      // Allow single-word component names
      'vue/multi-word-component-names': 'off'
    },
    plugins: {
      prettier: {
        rules: {}
      }
    }
  }
];