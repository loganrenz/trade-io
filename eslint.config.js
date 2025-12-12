// @ts-check
import { createConfigForNuxt } from '@nuxt/eslint-config/flat';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default createConfigForNuxt({
  features: {
    tooling: true,
    stylistic: false, // Use Prettier instead
  },
}).append(eslintPluginPrettierRecommended, {
  rules: {
    // TypeScript
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],

    // Vue
    'vue/multi-word-component-names': 'off',
    'vue/no-v-html': 'warn',

    // General
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',
  },
});
