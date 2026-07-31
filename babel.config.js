module.exports = (api) => {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Inlines the contents of the `.sql` files that Drizzle's generated
      // `drizzle/migrations.js` imports, so the migration SQL ships as a string
      // in the bundle. See metro.config.js for the matching resolver change.
      ['inline-import', { extensions: ['.sql'] }],
    ],
  };
};
