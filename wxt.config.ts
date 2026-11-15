import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte'],
  svelte: {
    // Components add their own styles at runtime, into the shadow root they're mounted in, instead of
    // a separate CSS file that would have to be web-accessible to youtube.com (see chat.content).
    // (The module ignores svelte.config.js for the build, so this goes here.)
    vite: { emitCss: false, compilerOptions: { css: 'injected' } },
  },
  manifest: {
    name: 'Better YouTube Chat',
    description: 'A better YouTube live chat.',
  },
  // Don't launch a separate browser in dev; load .output/chrome-mv3-dev as an unpacked extension instead.
  webExt: { disabled: true },
});
