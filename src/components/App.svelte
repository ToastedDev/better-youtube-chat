<script lang="ts">
  import type { PageBridge } from '@/lib/bridge';
  import type { MenuTarget } from '@/lib/chat/model';
  import type { ChatStore } from '@/lib/chat/store.svelte';
  import { setAppContext } from '@/lib/context';
  import ChatList from './ChatList.svelte';
  import ContextMenu from './ContextMenu.svelte';

  let { store, bridge }: { store: ChatStore; bridge: PageBridge } = $props();

  setAppContext({
    get store() {
      return store;
    },
    get bridge() {
      return bridge;
    },
  });

  let menu = $state.raw<MenuTarget | null>(null);
</script>

<div class="app">
  <ChatList {store} menuItemId={menu?.item.id} onmenu={(target) => (menu = target)} />
  {#if menu}
    {#key menu}
      <ContextMenu target={menu} {bridge} onclose={() => (menu = null)} />
    {/key}
  {/if}
</div>

<style>
  .app {
    position: relative;
    height: 100%;
    font-family: Roboto, Arial, sans-serif;
    color: var(--bytc-text);
    /* Transparent: yt-live-chat-renderer paints the themed background behind us. */
    background: transparent;
  }
</style>
