const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Drizzle's generated `drizzle/migrations.js` imports the raw `.sql` migration
// files. Metro does not resolve that extension by default, so bundling fails with
// an unresolved-module error naming the .sql file rather than the missing config.
// Paired with babel-plugin-inline-import in babel.config.js, which turns the file
// contents into a string at build time. Both are required; either alone fails.
config.resolver.sourceExts.push('sql');

module.exports = withNativeWind(config, { input: './src/global.css' });
