// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Lus par Node (Expo CLI), pas par l'app.
    files: ['*.config.js'],
    languageOptions: { globals: globals.node },
  },
]);
