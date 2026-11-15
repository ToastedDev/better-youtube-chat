<script lang="ts">
  import type { PageBridge } from '@/lib/bridge';
  import type { MenuState } from '@/lib/chat/menu-state.svelte';
  import type { ChatStore } from '@/lib/chat/store.svelte';
  import { setAppContext } from '@/lib/context';
  import ChatList from './ChatList.svelte';
  import ContextMenu from './ContextMenu.svelte';

  let { store, bridge, menu }: { store: ChatStore; bridge: PageBridge; menu: MenuState } = $props();

  setAppContext({
    get store() {
      return store;
    },
    get bridge() {
      return bridge;
    },
  });
</script>

<div class="app">
  <ChatList {store} menuItemId={menu.target?.fromBanner ? undefined : menu.target?.item.id} onmenu={(target) => (menu.target = target)} />
  {#if menu.target}
    {#key menu.target}
      <ContextMenu target={menu.target} {bridge} onclose={() => (menu.target = null)} />
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
