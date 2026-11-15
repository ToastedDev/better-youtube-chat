<script lang="ts">
  import type { PaidChatItem } from '@/lib/chat/model';
  import { menuHandlers, type OpenMenu } from '@/lib/chat/menu';
  import { getAppContext } from '@/lib/context';
  import type { EngagementToolbarState } from '@/lib/youtube/types';
  import Badges from './Badges.svelte';
  import DeletedText from './DeletedText.svelte';
  import Icon from './Icon.svelte';
  import MenuButton from './MenuButton.svelte';
  import Segments from './Segments.svelte';
  import SuperChatActions from './SuperChatActions.svelte';

  let {
    item,
    viewerName,
    menuOpen = false,
    onmenu,
  }: { item: PaidChatItem; viewerName?: string; menuOpen?: boolean; onmenu: OpenMenu } = $props();

  const menu = menuHandlers(() => item, (target) => onmenu(target));
  let revealed = $state(false);
  const hasContent = $derived(item.message.length > 0 || !!item.deleted || !!item.like || !!item.reply);

  const app = getAppContext();
  const hearted = $derived(
    (app.store.entity(item.heart?.stateKey)?.engagementToolbarStateEntityPayload as EngagementToolbarState | undefined)
      ?.heartState === 'TOOLBAR_HEART_STATE_HEARTED',
  );
</script>

<!-- Row click is a mouse shortcut for moderators; the ⋮ button is the keyboard path. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div
  class="row"
  class:menu-open={menuOpen}
  class:clickable={item.canModerate}
  role="listitem"
  onclick={menu.click}
  oncontextmenu={menu.contextmenu}
>
  <div class="card" class:v2={item.v2} style:background-color={item.colors.body}>
    <div
      class="header"
      style:background-color={item.v2 ? undefined : item.colors.header}
      style:color={item.colors.headerText}
    >
      {#if item.author.photo}<img class="avatar" src={item.author.photo} alt="" loading="lazy" draggable="false" />{/if}
      <div class="header-content">
        <span class="name"
          ><button type="button" class="author" style:color={item.colors.authorName} onclick={menu.author}
            >{item.author.name}</button
          ><Badges badges={item.author.badges} /></span
        >
        <span class="amount">{item.amount}</span>
      </div>
      {#if hearted && item.heart}
        <span class="heart" title={item.heart.label}>
          {#if item.heart.thumbnail}<img src={item.heart.thumbnail} alt="" draggable="false" />{/if}<Icon
            name="FAVORITE"
            size={12}
          />
        </span>
      {/if}
      <MenuButton onclick={menu.button} />
    </div>
    {#if hasContent}
      <div class="content" style:color={item.colors.bodyText}>
        {#if item.deleted && !revealed}<DeletedText
            deleted={item.deleted}
            onreveal={() => (revealed = true)}
          />{:else}<Segments segments={item.message} {viewerName} />{/if}
        {#if !item.deleted}<SuperChatActions like={item.like} reply={item.reply} />{/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .row {
    padding: 4px 24px;
  }
  .row.clickable {
    cursor: pointer;
  }
  .row.clickable:hover,
  .row.clickable.menu-open {
    background: var(--bytc-row-hover);
  }
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    border-radius: 4px;
    overflow: hidden;
    background-color: #1565c0;
    color: #fff;
    font-size: 14px;
    line-height: 20px;
    box-shadow: var(--bytc-card-shadow);
  }
  .card.v2 {
    border-radius: 12px;
  }
  .header {
    display: flex;
    align-items: center;
    min-height: 20px;
    padding: 8px 40px 8px 16px;
    font-weight: 500;
  }
  .avatar {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    margin-right: 16px;
    border-radius: 50%;
  }
  .header-content {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    min-width: 0;
  }
  .name {
    margin-right: 8px;
    overflow-wrap: anywhere;
  }
  .author {
    all: unset;
    cursor: pointer;
  }
  .author:focus-visible {
    outline: 2px solid currentColor;
  }
  /* The creator's avatar with a small heart, at the end of the header. */
  .heart {
    position: relative;
    flex-shrink: 0;
    margin-left: auto;
    padding-left: 8px;
    line-height: 0;
    color: #ff0033;
  }
  .heart img {
    width: 24px;
    height: 24px;
    border-radius: 50%;
  }
  .heart :global(svg) {
    position: absolute;
    right: -4px;
    bottom: -2px;
    filter: drop-shadow(0 0 1px #fff);
  }
  .content {
    padding: 0 16px 8px;
    overflow-wrap: anywhere;
  }
  /* Older two-tone cards: the header has its own color, so the body needs its own top padding. */
  .card:not(.v2) .content {
    padding-top: 8px;
  }
</style>
