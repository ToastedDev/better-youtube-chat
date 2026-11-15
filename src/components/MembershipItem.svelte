<script lang="ts">
  import type { MembershipChatItem } from '@/lib/chat/model';
  import { menuHandlers, type OpenMenu } from '@/lib/chat/menu';
  import Badges from './Badges.svelte';
  import DeletedText from './DeletedText.svelte';
  import MenuButton from './MenuButton.svelte';
  import Segments from './Segments.svelte';

  let {
    item,
    viewerName,
    menuOpen = false,
    onmenu,
  }: { item: MembershipChatItem; viewerName?: string; menuOpen?: boolean; onmenu: OpenMenu } = $props();

  const menu = menuHandlers(() => item, (target) => onmenu(target));
  let revealed = $state(false);
  const hasContent = $derived(item.message.length > 0 || !!item.deleted);
  // Milestones ("Member for 6 months") shrink the name and subtext around the primary line.
  const hasPrimary = $derived(item.primary.length > 0);
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
  <div class="card">
    <div class="header" class:only={!hasContent}>
      {#if item.author.photo}<img class="avatar" src={item.author.photo} alt="" loading="lazy" draggable="false" />{/if}
      <div class="header-content" class:small={hasPrimary}>
        <span class="name"
          ><button type="button" class="author" onclick={menu.author}>{item.author.name}</button><Badges
            badges={item.author.badges}
          /></span
        >
        {#if hasPrimary}<span class="primary"><Segments segments={item.primary} /></span>{/if}
        {#if item.subtext.length}<span class="subtext"><Segments segments={item.subtext} /></span>{/if}
      </div>
      {#if item.image}<img class="image" src={item.image} alt="" draggable="false" />{/if}
      <MenuButton onclick={menu.button} />
    </div>
    {#if hasContent}
      <div class="content">
        {#if item.deleted && !revealed}<DeletedText
            deleted={item.deleted}
            onreveal={() => (revealed = true)}
          />{:else}<Segments segments={item.message} {viewerName} />{/if}
      </div>
    {/if}
  </div>
</div>

<style>
  /* YouTube's membership colors; the same in light and dark themes. */
  .row {
    --sponsor: #0f9d58;
    --sponsor-header: #0a8043;
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
    color: #fff;
    font-size: 14px;
    box-shadow: var(--bytc-card-shadow);
  }
  .header {
    display: flex;
    align-items: center;
    min-height: 20px;
    padding: 8px 40px 8px 16px;
    background: var(--sponsor-header);
  }
  .header.only {
    background: var(--sponsor);
  }
  .avatar {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    margin-right: 16px;
    border-radius: 50%;
  }
  .header-content {
    display: flex;
    flex-direction: column;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .name,
  .primary {
    font-weight: 500;
  }
  .author {
    all: unset;
    cursor: pointer;
  }
  .author:focus-visible {
    outline: 2px solid currentColor;
  }
  .subtext {
    margin-top: 2px;
    font-size: 15px;
    font-weight: 500;
    line-height: 18px;
    color: rgba(255, 255, 255, 0.7);
  }
  .small .name,
  .small .subtext {
    font-size: 12px;
  }
  .image {
    flex-shrink: 0;
    height: 40px;
    margin-left: auto;
    padding-left: 8px;
  }
  .content {
    padding: 8px 16px;
    background: var(--sponsor);
    font-size: 15px;
    line-height: 20px;
    overflow-wrap: anywhere;
  }
</style>
