<script lang="ts">
  import { isAuthored, type MenuTarget } from '@/lib/chat/model';
  import type { ChatStore } from '@/lib/chat/store.svelte';
  import AutoModMessage from './AutoModMessage.svelte';
  import DonationMessage from './DonationMessage.svelte';
  import EngagementMessage from './EngagementMessage.svelte';
  import GiftMessage from './GiftMessage.svelte';
  import Icon from './Icon.svelte';
  import MembershipItem from './MembershipItem.svelte';
  import ModeChangeMessage from './ModeChangeMessage.svelte';
  import PaidMessage from './PaidMessage.svelte';
  import PaidSticker from './PaidSticker.svelte';
  import QuickActions from './QuickActions.svelte';
  import TextMessage from './TextMessage.svelte';

  let {
    store,
    menuItemId,
    onmenu,
  }: { store: ChatStore; menuItemId?: string; onmenu: (target: MenuTarget) => void } = $props();

  /** Distance from the bottom (px) that still counts as "following" the chat. */
  const STICK_THRESHOLD = 48;

  let scroller: HTMLDivElement;
  let atBottom = $state(true);

  function scrollToBottom() {
    scroller.scrollTop = scroller.scrollHeight;
  }

  function onscroll() {
    const gap = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    const next = gap <= STICK_THRESHOLD;
    if (next && !atBottom) store.trim();
    atBottom = next;
    store.holding = !next;
  }

  // Follow new messages while at the bottom.
  $effect(() => {
    void store.items;
    if (atBottom) scrollToBottom();
  });

  /**
   * Moderators: while Alt is held, hovering a message shows its quick actions (Remove, timeout,
   * hide user) instead of the ⋮ button, like YouTube.
   */
  let moderating = $state(false);
  $effect(() => {
    const onkey = (e: KeyboardEvent) => {
      if (e.key === 'Alt') moderating = e.type === 'keydown';
    };
    const off = () => (moderating = false);
    window.addEventListener('keydown', onkey, true);
    window.addEventListener('keyup', onkey, true);
    window.addEventListener('blur', off);
    return () => {
      window.removeEventListener('keydown', onkey, true);
      window.removeEventListener('keyup', onkey, true);
      window.removeEventListener('blur', off);
    };
  });

  // Keep the bottom pinned when the frame resizes (theater mode, window resize, input panel growing).
  $effect(() => {
    const observer = new ResizeObserver(() => {
      if (atBottom) scrollToBottom();
    });
    observer.observe(scroller);
    return () => observer.disconnect();
  });
</script>

<div class="scroller" bind:this={scroller} {onscroll}>
  <div class="items" role="list">
    {#each store.items as item (item.id)}
      {@const quick = moderating && isAuthored(item) && item.quickActions.length > 0}
      <div class="slot" class:quick role="presentation">
        {#if item.kind === 'text'}
          <TextMessage {item} viewerName={store.viewerName} menuOpen={item.id === menuItemId} {onmenu} />
        {:else if item.kind === 'automod'}
          <AutoModMessage {item} viewerName={store.viewerName} menuOpen={item.id === menuItemId} {onmenu} />
        {:else if item.kind === 'paid'}
          <PaidMessage {item} viewerName={store.viewerName} menuOpen={item.id === menuItemId} {onmenu} />
        {:else if item.kind === 'sticker'}
          <PaidSticker {item} menuOpen={item.id === menuItemId} {onmenu} />
        {:else if item.kind === 'membership'}
          <MembershipItem {item} viewerName={store.viewerName} menuOpen={item.id === menuItemId} {onmenu} />
        {:else if item.kind === 'gift'}
          <GiftMessage {item} />
        {:else if item.kind === 'donation'}
          <DonationMessage {item} />
        {:else if item.kind === 'engagement'}
          <EngagementMessage {item} />
        {:else if item.kind === 'mode-change'}
          <ModeChangeMessage {item} />
        {/if}
        {#if quick && isAuthored(item)}<QuickActions actions={item.quickActions} />{/if}
      </div>
    {/each}
  </div>
</div>

{#if !atBottom}
  <button type="button" class="jump" aria-label="Scroll to the latest messages" onclick={scrollToBottom}>
    <Icon name="ARROW_DOWNWARD" />
  </button>
{/if}

<style>
  .scroller {
    height: 100%;
    overflow-x: hidden;
    overflow-y: auto;
    overflow-anchor: none;
    /* Like YouTube, always keep 12px for the scrollbar, so rows are as wide as YouTube's (and text
       wraps at the same place) whether or not the list scrolls. */
    scrollbar-gutter: stable;
  }
  .scroller::-webkit-scrollbar {
    width: 12px;
  }
  .scroller::-webkit-scrollbar-track {
    background: transparent;
  }
  .scroller::-webkit-scrollbar-thumb {
    min-height: 30px;
    border: 2px solid transparent;
    background-clip: padding-box;
    background-color: transparent;
  }
  .scroller:hover::-webkit-scrollbar-thumb {
    background-color: var(--bytc-scrollbar);
  }
  .slot {
    position: relative;
  }
  .slot.quick:hover > :global(.quick-actions) {
    display: flex;
  }
  .slot.quick:hover :global(.menu-button) {
    visibility: hidden;
  }
  .items {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    min-height: 100%;
    padding: 8px 0;
    box-sizing: border-box;
  }
  .jump {
    all: unset;
    position: absolute;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--bytc-raised-bg);
    color: var(--bytc-text);
    box-shadow: var(--bytc-shadow);
    cursor: pointer;
  }
  .jump:hover {
    background: var(--bytc-raised-hover);
  }
</style>
