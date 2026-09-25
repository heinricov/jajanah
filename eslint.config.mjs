import globals from 'globals';

import base from '@configs/eslint/base';

export default [
  ...base,
  {
    // Workspace punya eslint.config sendiri (dijalankan lewat `turbo run lint`).
    ignores: ['apps/**', 'packages/**'],
  },
  {
    languageOptions: {
      globals: globals.node,
    },
  },
];
