import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'Better YouTube Chat',
    description: 'A better YouTube live chat.',
  },
  // Don't launch a separate browser in dev; load .output/chrome-mv3-dev as an unpacked extension instead.
  webExt: { disabled: true },
});
