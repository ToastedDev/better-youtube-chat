<script lang="ts">
  import { onMount, tick } from 'svelte';
  import type { PageBridge } from '@/lib/bridge';
  import { canMention, copyText, insertMention } from '@/lib/chat/dom';
  import type { MenuTarget } from '@/lib/chat/model';
  import { plainText, textOf } from '@/lib/chat/parse';
  import type { RawMenuItem } from '@/lib/youtube/types';
  import Icon from './Icon.svelte';

  let { target, bridge, onclose }: { target: MenuTarget; bridge: PageBridge; onclose: () => void } = $props();

  /** Native items we can run through YouTube's own menu item elements. */
  const RUNNABLE = new Set(['menuServiceItemRenderer', 'menuNavigationItemRenderer']);

  interface NativeEntry {
    label: string;
    icon?: string;
    disabled: boolean;
    raw: RawMenuItem;
  }

  // The menu is re-created (keyed) for every target, so capturing the initial value is intended.
  // svelte-ignore state_referenced_locally
  const { item } = target;
  const channelPath = `/channel/${item.author.channelId}`;
  const mentionAvailable = canMention();

  let menu: HTMLDivElement;
  // Raw (not deeply proxied): the item data is posted to the page, and proxies can't be cloned.
  let native = $state.raw<NativeEntry[] | 'loading' | 'error'>(item.menuParams ? 'loading' : []);

  /** YouTube gives moderators its own "Go to channel" (opens a new window); ours navigates in-app. */
  function linksToAuthorChannel(raw: RawMenuItem): boolean {
    const json = JSON.stringify(raw);
    const id = item.author.channelId;
    return json.includes(`/channel/${id}"`) || json.includes(`"browseId":"${id}"`);
  }

  onMount(() => {
    menu.showPopover();
    place();
    // Focus the menu itself (arrow keys then move into the items) so nothing looks pre-selected.
    menu.focus({ preventScroll: true });
    if (!item.menuParams) return;
    bridge
      .call('getContextMenu', { params: item.menuParams })
      .then(async (items) => {
        native = items.flatMap((raw) => {
          const [kind, data] = Object.entries(raw)[0] ?? [];
          const label = textOf(data?.text);
          if (!kind || !data || !RUNNABLE.has(kind) || !label || linksToAuthorChannel(raw)) return [];
          return [{ label, icon: data.icon?.iconType, disabled: !!data.isDisabled, raw }];
        });
        await tick();
        place();
      })
      .catch((err) => {
        console.warn('[better-yt-chat] failed to load context menu', err);
        native = 'error';
      });
  });

  function place() {
    const margin = 8;
    const { innerWidth: width, innerHeight: height } = window;
    const rect = menu.getBoundingClientRect();
    let x = target.alignRight ? target.x - rect.width : target.x;
    let y = target.y;
    if (y + rect.height > height - margin) y = (target.flipY ?? target.y) - rect.height;
    x = Math.min(Math.max(margin, x), width - rect.width - margin);
    y = Math.min(Math.max(margin, y), height - rect.height - margin);
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }

  function close() {
    if (menu.matches(':popover-open')) menu.hidePopover();
  }

  function ontoggle(event: ToggleEvent) {
    if (event.newState === 'closed') onclose();
  }

  function goToChannel(event: MouseEvent) {
    // Modified clicks fall through to the <a href> (new tab / window).
    if (event.ctrlKey || event.metaKey || event.shiftKey) return close();
    event.preventDefault();
    bridge.call('navigate', { url: channelPath, browseId: item.author.channelId }).catch(console.warn);
    close();
  }

  function mention() {
    insertMention(item.author.name);
    close();
  }

  function copyMessage() {
    copyText(plainText(item.message));
    close();
  }

  function runNative(entry: NativeEntry) {
    close();
    bridge.call('runMenuItem', { item: entry.raw }).catch((err) => console.warn('[better-yt-chat] menu action failed', err));
  }

  function onkeydown(event: KeyboardEvent) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const entries = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])')];
    const active = (menu.getRootNode() as Document | ShadowRoot).activeElement as HTMLElement | null;
    const index = active ? entries.indexOf(active) : -1;
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
    entries[(next + entries.length) % entries.length]?.focus();
  }
</script>

<div class="menu" popover="auto" role="menu" tabindex="-1" bind:this={menu} {ontoggle} {onkeydown}>
  <a role="menuitem" class="entry" href={channelPath} target="_top" onclick={goToChannel}>
    <Icon name="ACCOUNT_CIRCLE" /><span>Go to channel</span>
  </a>
  {#if mentionAvailable}
    <button type="button" role="menuitem" class="entry" onclick={mention}>
      <Icon name="ALTERNATE_EMAIL" /><span>Mention</span>
    </button>
  {/if}
  <button type="button" role="menuitem" class="entry" onclick={copyMessage}>
    <Icon name="CONTENT_COPY" /><span>Copy message</span>
  </button>

  {#if native === 'loading'}
    <div class="divider"></div>
    <div class="loading" role="status" aria-label="Loading more actions"><span class="spinner"></span></div>
  {:else if Array.isArray(native) && native.length}
    <div class="divider"></div>
    {#each native as entry, i (i)}
      <button
        type="button"
        role="menuitem"
        class="entry"
        aria-disabled={entry.disabled}
        disabled={entry.disabled}
        onclick={() => runNative(entry)}
      >
        <Icon name={entry.icon} /><span>{entry.label}</span>
      </button>
    {/each}
  {/if}
</div>

<style>
  .menu {
    position: fixed;
    inset: auto;
    margin: 0;
    padding: 8px 0;
    min-width: 160px;
    max-width: calc(100vw - 16px);
    border: none;
    border-radius: 12px;
    background: var(--bytc-menu-bg);
    color: var(--bytc-text);
    box-shadow: var(--bytc-menu-shadow);
    font-family: Roboto, Arial, sans-serif;
    font-size: 14px;
    outline: none;
    overflow: hidden;
  }
  .entry {
    all: unset;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 16px;
    width: 100%;
    height: 36px;
    padding: 0 36px 0 16px;
    color: var(--bytc-text);
    white-space: nowrap;
    cursor: pointer;
  }
  .entry:hover,
  .entry:focus-visible {
    background: var(--bytc-menu-hover);
  }
  .entry[aria-disabled='true'] {
    opacity: 0.5;
    cursor: default;
  }
  .divider {
    height: 1px;
    margin: 8px 0;
    background: var(--bytc-divider);
  }
  /* Same height as a menu entry, so the menu doesn't jump much when YouTube's items arrive. */
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 36px;
  }
  .spinner {
    box-sizing: border-box;
    width: 20px;
    height: 20px;
    border: 2px solid var(--bytc-divider);
    border-top-color: var(--bytc-text-2);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 2.4s;
    }
  }
</style>
