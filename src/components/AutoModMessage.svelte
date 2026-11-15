<script lang="ts">
  import type { AutoModChatItem } from '@/lib/chat/model';
  import type { OpenMenu } from '@/lib/chat/menu';
  import { getAppContext } from '@/lib/context';
  import type { InnertubeCommand } from '@/lib/youtube/types';
  import Icon from './Icon.svelte';
  import Segments from './Segments.svelte';
  import TextMessage from './TextMessage.svelte';

  let {
    item,
    viewerName,
    menuOpen = false,
    onmenu,
  }: {
    item: AutoModChatItem;
    viewerName?: string;
    menuOpen?: boolean;
    onmenu: OpenMenu;
  } = $props();

  const app = getAppContext();
  /** Show / Hide was clicked; YouTube replaces this item once the moderate call returns. */
  let busy = $state(false);

  function run(command: InnertubeCommand, moderate = false) {
    if (moderate) busy = true;
    app.bridge.call('runCommand', { command }).catch((err) => {
      busy = false;
      console.warn('[better-yt-chat] AutoMod action failed', err);
    });
  }
</script>

<div class="automod" role="listitem">
  <div class="explanation">
    {#if item.info}
      {@const info = item.info}
      <button type="button" class="info" aria-label={info.label} title={info.label} onclick={() => run(info.command)}>
        <Icon name="WARNING" />
      </button>
    {:else}
      <span class="info"><Icon name="WARNING" /></span>
    {/if}
    <span class="header"><Segments segments={item.header} /></span>
  </div>
  <TextMessage {item} {viewerName} {menuOpen} {onmenu} />
  {#if item.actions.length}
    <div class="actions">
      {#each item.actions as action, i (i)}
        <button type="button" disabled={busy} onclick={() => run(action.command, true)}>{action.label}</button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .automod {
    position: relative;
    padding-bottom: 4px;
  }
  /* The bar YouTube draws down the left of the whole card. */
  .automod::before {
    content: '';
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 8px;
    width: 4px;
    border-radius: 2px;
    background: var(--bytc-deleted-bar);
  }
  .explanation {
    display: flex;
    align-items: center;
    margin: 4px 0 4px 16px;
    font-size: 12px;
    line-height: 18px;
    color: var(--bytc-text);
  }
  .info {
    all: unset;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    margin-right: 3px;
    border-radius: 50%;
    color: var(--bytc-text);
  }
  button.info {
    cursor: pointer;
  }
  button.info:hover {
    background: var(--bytc-row-hover);
  }
  .info:focus-visible,
  .actions button:focus-visible {
    outline: 2px solid var(--bytc-link);
  }
  .actions {
    display: flex;
    gap: 8px;
    margin: 8px 0 4px 64px;
  }
  .actions button {
    all: unset;
    height: 40px;
    padding: 0 16px;
    border-radius: 20px;
    background: var(--bytc-tonal-bg);
    color: var(--bytc-text);
    font-size: 14px;
    font-weight: 500;
    line-height: 40px;
    cursor: pointer;
  }
  .actions button:hover {
    background: var(--bytc-tonal-hover);
  }
  .actions button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
