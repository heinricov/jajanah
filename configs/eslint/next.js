import nextVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier';

import react from './react.js';

export default [
  ...react,
  {
    ignores: ['**/next-env.d.ts'],
  },
  ...nextVitals,
  {
    settings: {
      next: {
        rootDir: ['.'],
      },
    },
  },
  prettier,
];
