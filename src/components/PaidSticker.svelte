<script lang="ts">
  import type { StickerChatItem } from '@/lib/chat/model';
  import { menuHandlers, type OpenMenu } from '@/lib/chat/menu';
  import Badges from './Badges.svelte';
  import BumperNote from './Bumper.svelte';
  import DeletedText from './DeletedText.svelte';
  import MenuButton from './MenuButton.svelte';

  let { item, menuOpen = false, onmenu }: { item: StickerChatItem; menuOpen?: boolean; onmenu: OpenMenu } = $props();

  const menu = menuHandlers(() => item, (target) => onmenu(target));
  let revealed = $state(false);
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
  <div class="card" class:v2={item.v2} style:background-color={item.colors.background}>
    {#if item.author.photo}<img class="avatar" src={item.author.photo} alt="" loading="lazy" draggable="false" />{/if}
    <div class="info">
      <span class="name" style:color={item.colors.authorName}
        ><button type="button" class="author" onclick={menu.author}>{item.author.name}</button><Badges
          badges={item.author.badges}
        /></span
      >
      <span class="amount" style:color={item.colors.amount}>{item.amount}</span>
      {#if item.deleted && !revealed}
        <span><DeletedText deleted={item.deleted} onreveal={() => (revealed = true)} /></span>
      {/if}
    </div>
    {#if !item.deleted || revealed}
      <img
        class="sticker"
        src={item.sticker.src}
        alt={item.sticker.label}
        title={item.sticker.label}
        width={item.sticker.width}
        height={item.sticker.height}
        draggable="false"
      />
    {/if}
    {#if item.overlay}<img class="overlay" src={item.overlay} alt="" draggable="false" />{/if}
    <MenuButton onclick={menu.button} />
  </div>
  {#if item.bumper}<BumperNote bumper={item.bumper} />{/if}
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
    align-items: flex-start;
    padding: 8px 8px 8px 16px;
    border-radius: 4px;
    color: #fff;
    font-size: 14px;
    box-shadow: var(--bytc-card-shadow);
  }
  .card.v2 {
    border-radius: 12px;
  }
  /* Like YouTube: the avatar at the top, the name and amount centered on a 40px line beside it. */
  .avatar {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    margin-right: 16px;
    border-radius: 50%;
  }
  .info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-width: 0;
    min-height: 40px;
  }
  .name {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .author {
    all: unset;
    cursor: pointer;
  }
  .author:focus-visible {
    outline: 2px solid currentColor;
  }
  .amount {
    font-size: 15px;
    font-weight: 500;
    line-height: 18px;
  }
  .sticker {
    flex-shrink: 0;
    margin-left: auto;
    padding-left: 8px;
    object-fit: contain;
  }
  .overlay {
    position: absolute;
    top: 0;
    right: 0;
    width: 146px;
    pointer-events: none;
  }
</style>
