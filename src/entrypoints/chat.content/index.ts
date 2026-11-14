import { mount, unmount } from 'svelte';
import App from '@/components/App.svelte';
import { PageBridge } from '@/lib/bridge';
import { ChatStore } from '@/lib/chat/store.svelte';
import './style.css';

const HOST_TAG = 'better-yt-chat';
const ANCHOR = 'yt-live-chat-renderer #item-list';

/** Hide YouTube's message list only while ours is mounted, so the native one comes back if we fail. */
const DOCUMENT_CSS = `
  #item-list:has(> ${HOST_TAG}) { position: relative; }
  #item-list:has(> ${HOST_TAG}) > yt-live-chat-item-list-renderer { display: none !important; }
`;

/** Copies `<html dark>` onto the shadow host so `:host([dark])` styles follow YouTube's theme. */
function syncDarkAttribute(host: HTMLElement): () => void {
  const root = document.documentElement;
  const sync = () => host.toggleAttribute('dark', root.hasAttribute('dark'));
  sync();
  const observer = new MutationObserver(sync);
  observer.observe(root, { attributes: true, attributeFilter: ['dark'] });
  return () => observer.disconnect();
}

export default defineContentScript({
  matches: ['https://www.youtube.com/live_chat*'],
  allFrames: true,
  runAt: 'document_idle',
  cssInjectionMode: 'ui',

  async main(ctx) {
    const store = new ChatStore();
    const bridge = new PageBridge((payload) => store.apply(payload));

    const style = document.createElement('style');
    style.textContent = DOCUMENT_CSS;
    document.head.append(style);
    ctx.onInvalidated(() => style.remove());

    const ui = await createShadowRootUi(ctx, {
      name: HOST_TAG,
      position: 'inline',
      // Only the message list is replaced; header, ticker, pinned banner and input stay native.
      anchor: ANCHOR,
      append: 'last',
      onMount: (container, _shadow, host) => {
        const stopThemeSync = syncDarkAttribute(host);
        const app = mount(App, { target: container, props: { store, bridge } });
        return { app, stopThemeSync };
      },
      onRemove: (mounted) => {
        if (!mounted) return;
        mounted.stopThemeSync();
        unmount(mounted.app);
      },
    });

    // WXT's autoMount only reacts to the anchor appearing/disappearing, but YouTube also empties
    // `#item-list` and re-creates its native list (e.g. when switching Top chat / Live chat), which
    // drops our host. Re-mount whenever the host isn't inside the anchor. The store survives remounts.
    const ensureMounted = () => {
      const anchor = document.querySelector(ANCHOR);
      if (anchor && ui.shadowHost.parentElement === anchor) return;
      if (ui.mounted) ui.remove();
      if (anchor) ui.mount();
    };
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        ensureMounted();
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
    ensureMounted();
  },
});
