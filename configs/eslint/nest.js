import globals from 'globals';

import node from './node.js';

export default [
  ...node,
  {
    files: ['**/*.spec.ts', '**/test/**/*.ts'],
    languageOptions: {
      globals: globals.jest,
    },
  },
];
