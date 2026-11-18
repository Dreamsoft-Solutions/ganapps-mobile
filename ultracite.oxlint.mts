import { defineConfig } from 'oxlint';
import core from 'ultracite/oxlint/core';
import landmines from 'ultracite/oxlint/landmines';

export default defineConfig({
  env: core.env,
  extends: [core, landmines],
  ignorePatterns: core.ignorePatterns,
  jsPlugins: landmines.jsPlugins,
});
