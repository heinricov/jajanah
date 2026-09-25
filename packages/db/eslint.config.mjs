import node from '@configs/eslint/node';

const config = [
  ...node,
  {
    ignores: ['src/generated/**'],
  },
];

export default config;
