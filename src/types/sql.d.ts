/**
 * Lets TypeScript resolve the `.sql` imports inside Drizzle's generated
 * `drizzle/migrations.js`.
 *
 * babel-plugin-inline-import replaces each import with the file's contents as a
 * string at build time, so `string` is the accurate runtime type. Without this
 * declaration `tsc` fails on `drizzle/migrations.js` with an unresolved module,
 * even though Metro bundles it correctly.
 */
declare module '*.sql' {
  const content: string;
  export default content;
}
