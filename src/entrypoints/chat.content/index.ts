import { mount, unmount } from 'svelte';
import App from '@/components/App.svelte';
import { PageBridge } from '@/lib/bridge';
import { ChatStore } from '@/lib/chat/store.svelte';
import { NativeThemeSampler } from '@/lib/native-theme';
import './style.css';

const HOST_TAG = 'better-yt-chat';
const ANCHOR = 'yt-live-chat-renderer #item-list';

/**
 * Hide YouTube's message list only while ours is mounted and visible, so the native one comes back
 * if we fail, or when compare mode (`data-native` on the host) is on.
 */
const DOCUMENT_CSS = `
  #item-list:has(> ${HOST_TAG}) { position: relative; }
  #item-list:has(> ${HOST_TAG}:not([data-native])) > yt-live-chat-item-list-renderer { display: none !important; }
`;

/** Alt+Shift+N in the chat toggles between our list and YouTube's, for comparing the two. */
const isCompareShortcut = (e: KeyboardEvent) => e.altKey && e.shiftKey && e.code === 'KeyN';

/**
 * Mirrors YouTube's settings onto the shadow host so our CSS can follow them:
 * - `<html dark>` → `:host([dark])`
 * - the header's Timestamps toggle (`yt-live-chat-renderer[hide-timestamps]`) → `:host([show-timestamps])`
 */
function syncHostAttributes(host: HTMLElement, onThemeChange: () => void): () => void {
  const sync = () => {
    const dark = document.documentElement.hasAttribute('dark');
    const themeChanged = host.hasAttribute('dark') !== dark;
    host.toggleAttribute('dark', dark);
    const renderer = document.querySelector('yt-live-chat-renderer');
    host.toggleAttribute('show-timestamps', !!renderer && !renderer.hasAttribute('hide-timestamps'));
    if (themeChanged) onThemeChange();
  };
  sync();
  const observer = new MutationObserver(sync);
  observer.observe(document.documentElement, {
    attributes: true,
    subtree: true,
    attributeFilter: ['dark', 'hide-timestamps'],
  });
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
    const theme = new NativeThemeSampler();

    const style = document.createElement('style');
    style.textContent = DOCUMENT_CSS;
    document.head.append(style);
    ctx.onInvalidated(() => style.remove());

    let showNative = false;

    const ui = await createShadowRootUi(ctx, {
      name: HOST_TAG,
      position: 'inline',
      // Only the message list is replaced; header, ticker, pinned banner and input stay native.
      anchor: ANCHOR,
      append: 'last',
      onMount: (container, _shadow, host) => {
        host.toggleAttribute('data-native', showNative);
        const stopThemeSync = syncHostAttributes(host, () => theme.reset());
        theme.attach(host);
        const app = mount(App, { target: container, props: { store, bridge } });
        return { app, stopThemeSync };
      },
      onRemove: (mounted) => {
        if (!mounted) return;
        mounted.stopThemeSync();
        unmount(mounted.app);
      },
    });

    const onKeydown = (e: KeyboardEvent) => {
      if (!isCompareShortcut(e)) return;
      e.preventDefault();
      showNative = !showNative;
      ui.shadowHost.toggleAttribute('data-native', showNative);
    };
    window.addEventListener('keydown', onKeydown, true);
    ctx.onInvalidated(() => window.removeEventListener('keydown', onKeydown, true));

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
        theme.update();
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
    ensureMounted();
  },
});
