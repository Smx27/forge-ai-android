module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['./babel-plugin-lucide.js'],
  env: {production: {plugins: ['transform-remove-console']}},
};
