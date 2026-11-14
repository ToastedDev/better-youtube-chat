<script lang="ts">
  import type { MenuTarget, TextChatItem } from '@/lib/chat/model';
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
    onmenu: (target: MenuTarget) => void;
  } = $props();

  const author = $derived(item.author);

  function openFromElement(event: MouseEvent, alignRight: boolean) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    onmenu({
      item,
      x: alignRight ? rect.right : rect.left,
      y: rect.bottom,
      alignRight,
      flipY: rect.top,
    });
  }

  function oncontextmenu(event: MouseEvent) {
    if (event.shiftKey) return; // Shift+right-click keeps the browser menu.
    event.preventDefault();
    onmenu({ item, x: event.clientX, y: event.clientY });
  }
</script>

<div class="message" class:menu-open={menuOpen} class:deleted={!!item.deleted} role="listitem" {oncontextmenu}>
  {#if author.photo}
    <img class="avatar" src={author.photo} alt="" loading="lazy" draggable="false" />
  {:else}
    <span class="avatar"></span>
  {/if}
  <div class="content">
    <button
      type="button"
      class="author"
      class:owner={author.isOwner}
      class:moderator={author.isModerator}
      class:member={author.isMember}
      onclick={(e) => openFromElement(e, false)}>{author.name}</button
    >{#each author.badges as badge, i (i)}<span class="badge" class:moderator={badge.kind === 'icon' && badge.icon === 'MODERATOR'} title={badge.label}
        >{#if badge.kind === 'image'}<img src={badge.src} alt={badge.label} />{:else}<Icon name={badge.icon} size={16} />{/if}</span
      >{/each}{#each item.chips as chip, i (i)}<span class="chip" style:background={chip.background} style:color={chip.color}
        >{#if chip.icon}<Icon name={chip.icon} size={14} />{/if}{chip.label}</span
      >{/each}
    <span class="text"><Segments segments={item.deleted ?? item.message} {viewerName} /></span>
  </div>
  <button type="button" class="menu-button" aria-label="Chat actions" onclick={(e) => openFromElement(e, true)}>
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
  .author:hover {
    text-decoration: underline;
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
  .author.owner {
    padding: 2px 4px;
    border-radius: 2px;
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
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 20px;
    margin-right: 8px;
    padding: 0 6px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 500;
    line-height: 20px;
    vertical-align: top;
    background: var(--bytc-chip-bg);
    color: var(--bytc-text);
  }
  .deleted .text {
    font-style: italic;
    color: var(--bytc-deleted);
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
