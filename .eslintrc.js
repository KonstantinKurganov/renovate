module.exports = {
  env: {
    node: true,
  },
  extends: [
    'plugin:promise/recommended',
    'plugin:@typescript-eslint/recommended',
    'airbnb-typescript/base',
    'prettier',
    'prettier/@typescript-eslint',
  ],
  parserOptions: {
    ecmaVersion: 9,
    project: './tsconfig.json',
  },
  rules: {
    'import/no-unresolved': 0, // only required for js, see overrides
    'require-await': 'error',
    'no-use-before-define': 0,
    'no-restricted-syntax': 0,
    'no-await-in-loop': 0,
    'prefer-destructuring': 'off',
    'prefer-template': 'off',
    'no-underscore-dangle': 0,

    // TODO: fix lint
    '@typescript-eslint/camelcase': 'off', // disabled until ??
    '@typescript-eslint/no-var-requires': 'off', // disable until all files converted to typescript
    '@typescript-eslint/no-use-before-define': 'off', // disable until all files converted to typescript
    '@typescript-eslint/explicit-member-accessibility': 0,
    '@typescript-eslint/explicit-function-return-type': 0,
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/no-non-null-assertion': 0,
  },
  overrides: [
    {
      // TODO: should be removed in near future, uses around ~50% lint time
      files: ['*.js'],
      rules: {
        'import/no-unresolved': [
          'error',
          { commonjs: true, caseSensitive: true },
        ],
      },
    },
  ],
};
