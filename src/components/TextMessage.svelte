<script lang="ts">
  import type { TextChatItem } from '@/lib/chat/model';
  import { menuHandlers, type OpenMenu } from '@/lib/chat/menu';
  import { ICONS } from '@/lib/icons';
  import Chip from './Chip.svelte';
  import Icon from './Icon.svelte';
  import Segments from './Segments.svelte';

  let {
    item,
    viewerName,
    menuOpen = false,
    onmenu,
  }: {
    item: TextChatItem;
    viewerName?: string;
    menuOpen?: boolean;
    onmenu: OpenMenu;
  } = $props();

  const author = $derived(item.author);
  const time = $derived(
    new Date(Number(item.timestampUsec) / 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
  );
  /** Moderators can reveal a deleted message's original text, like YouTube's "View deleted message". */
  let revealed = $state(false);
  // Badges without a drawable icon (e.g. OWNER, shown by the name chip instead) would leave a gap.
  const badges = $derived(author.badges.filter((b) => b.kind === 'image' || b.icon in ICONS));

  const menu = menuHandlers(() => item, (target) => onmenu(target));
</script>

<!-- Row click is a mouse shortcut for moderators; the ⋮ button is the keyboard path. -->
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<div
  class="message"
  class:menu-open={menuOpen}
  class:deleted={!!item.deleted}
  class:clickable={item.canModerate}
  class:bar={!!item.deleted?.showOriginalLabel}
  class:system={item.system}
  role="listitem"
  onclick={menu.click}
  oncontextmenu={menu.contextmenu}
>
  {#if author.photo}
    <img class="avatar" src={author.photo} alt="" loading="lazy" draggable="false" />
  {:else}
    <span class="avatar"></span>
  {/if}
  <div class="content">
    <span class="timestamp">{time}</span><button
      type="button"
      class="author"
      class:owner={author.isOwner}
      class:moderator={author.isModerator}
      class:member={author.isMember}
      class:verified={author.isVerified}
      onclick={menu.author}>{author.name}</button
    >{#each badges as badge, i (i)}<span class="badge" class:moderator={badge.kind === 'icon' && badge.icon === 'MODERATOR'} title={badge.label}
        >{#if badge.kind === 'image'}<img src={badge.src} alt={badge.label} />{:else}<Icon name={badge.icon} size={16} />{/if}</span
      >{/each}{#each item.chips as chip, i (i)}<Chip {chip} />{/each}<!-- No whitespace before the text: spacing comes from the margins, like YouTube. -->{#if item.deleted && !revealed}<span
        class="text">{item.deleted.text}</span
      >{#if item.deleted.showOriginalLabel}<button
          type="button"
          class="show-original"
          onclick={() => (revealed = true)}>{item.deleted.showOriginalLabel}</button
        >{/if}{:else}<span class="text"><Segments segments={item.message} {viewerName} /></span>{/if}
  </div>
  <button type="button" class="menu-button" aria-label="Chat actions" onclick={menu.button}>
    <Icon name="MORE_VERT" />
  </button>
</div>

<style>
  .message {
    position: relative;
    display: flex;
    align-items: flex-start;
    padding: 4px 24px;
    font-size: 14px;
  }
  .message.clickable {
    cursor: pointer;
  }
  .message.clickable:hover,
  .message.clickable.menu-open {
    background: var(--bytc-row-hover);
  }
  /* Moderator view of a deleted message gets a bar on the left, like YouTube. */
  .message.bar::before {
    content: '';
    position: absolute;
    top: 4px;
    bottom: 4px;
    left: 8px;
    width: 4px;
    border-radius: 2px;
    background: var(--bytc-deleted-bar);
  }
  .timestamp {
    display: none;
    margin-right: 8px;
    font-size: 11px;
    color: var(--bytc-text-2);
  }
  :global(:host([show-timestamps])) .timestamp {
    display: inline;
  }
  .avatar {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    margin-right: 16px;
    border-radius: 50%;
    background: var(--bytc-avatar-placeholder);
  }
  .content {
    flex: 1;
    min-width: 0;
    line-height: 20px;
    overflow-wrap: anywhere;
    color: var(--bytc-text);
  }
  .author {
    all: unset;
    cursor: pointer;
    margin-right: 8px;
    font-weight: 500;
    color: var(--bytc-text-2);
  }
  .author:focus-visible {
    outline: 2px solid var(--bytc-link);
  }
  .author.member {
    color: var(--bytc-member);
  }
  .author.moderator {
    color: var(--bytc-moderator);
  }
  .author.verified {
    color: var(--bytc-verified);
  }
  /* Sampled from YouTube's own list when available (see native-theme.ts). */
  .author.owner {
    padding: var(--bytc-owner-padding, 2px 4px);
    border-radius: var(--bytc-owner-radius, 2px);
    line-height: var(--bytc-owner-line-height, normal);
    background: var(--bytc-owner-bg);
    color: var(--bytc-owner-fg);
  }
  .author:has(+ .badge) {
    margin-right: 0;
  }
  .badge {
    display: inline-flex;
    margin: 0 4px 0 2px;
    vertical-align: middle;
    position: relative;
    top: -1px;
    color: var(--bytc-text-2);
  }
  .badge:last-of-type {
    margin-right: 8px;
  }
  .badge.moderator {
    color: var(--bytc-moderator);
  }
  .badge img {
    width: 16px;
    height: 16px;
  }
  /* "received a gift membership by @x" */
  .system .text {
    color: var(--bytc-text-2);
  }
  .deleted .text {
    font-style: italic;
    color: var(--bytc-deleted);
  }
  .show-original {
    all: unset;
    margin-left: 2px;
    font-style: italic;
    text-decoration: underline;
    color: var(--bytc-deleted);
    cursor: pointer;
  }
  .menu-button {
    all: unset;
    position: absolute;
    top: 2px;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 28px;
    color: var(--bytc-icon);
    cursor: pointer;
    opacity: 0;
  }
  .message:hover .menu-button,
  .menu-open .menu-button,
  .menu-button:focus-visible {
    opacity: 1;
  }
</style>
