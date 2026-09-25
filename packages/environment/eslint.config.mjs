import node from '@configs/eslint/node';

const config = [
  ...node,
  {
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
];

export default config;
