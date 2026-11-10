module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      files: ['backend/**/*.js'],
      env: {node: true, jest: false},
    },
  ],
};
