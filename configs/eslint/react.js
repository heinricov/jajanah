import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

import base from './base.js';

export default [
  ...base,
  reactHooks.configs.flat['recommended-latest'],
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
  },
];
