import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [
    // WXT's Vite setup: the `@/` alias, auto-imports and `import.meta.env`. It doesn't include
    // WXT modules, so Svelte is added separately (for runes in `.svelte.ts` files).
    WxtVitest(),
    svelte({ configFile: false }),
  ],
});
