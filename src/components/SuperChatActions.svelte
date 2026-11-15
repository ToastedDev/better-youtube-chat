<script lang="ts">
  import type { LikeButton, ReplyButton } from '@/lib/chat/model';
  import { getAppContext } from '@/lib/context';
  import type {
    AttributedString,
    EngagementToolbarState,
    LikeCountEntity,
    ReplyCountEntity,
  } from '@/lib/youtube/types';
  import Icon from './Icon.svelte';

  let { like, reply }: { like?: LikeButton; reply?: ReplyButton } = $props();

  const app = getAppContext();

  /**
   * The viewer's click, until YouTube says otherwise: it sends the like state with the item and on
   * reload, but not in reply to the like itself.
   */
  let override = $state<boolean | null>(null);
  let pending = $state(false);

  const likeState = $derived(
    app.store.entity(like?.stateKey)?.engagementToolbarStateEntityPayload as EngagementToolbarState | undefined,
  );
  const liked = $derived(override ?? likeState?.likeState === 'TOOLBAR_LIKE_STATE_LIKED');

  const likeEntity = $derived(app.store.entity(like?.countKey)?.likeCountEntity as LikeCountEntity | undefined);
  const replyEntity = $derived(app.store.entity(reply?.countKey)?.replyCountEntity as ReplyCountEntity | undefined);

  /** YouTube shows the placeholder ("Like", "Reply") instead of a zero count. */
  function countOr(count: AttributedString | undefined, placeholder: string): string {
    const text = count?.content;
    return text && text !== '0' ? text : placeholder;
  }

  const likeLabel = $derived(
    like ? countOr(liked ? likeEntity?.likeCountIfLiked : likeEntity?.likeCountIfIndifferent, like.placeholder) : '',
  );
  const replyLabel = $derived(reply ? countOr(replyEntity?.replyCount, reply.placeholder) : '');

  async function toggleLike() {
    if (!like || pending) return;
    const before = override;
    const wasLiked = liked;
    override = !wasLiked; // Optimistic, like YouTube.
    pending = true;
    try {
      await app.bridge.call('runCommand', { command: wasLiked ? like.unlike : like.like });
    } catch (err) {
      override = before;
      console.warn('[better-yt-chat] like failed', err);
    } finally {
      pending = false;
    }
  }

  function openReplies() {
    if (!reply) return;
    app.bridge.call('runCommand', { command: reply.command }).catch((err) => {
      console.warn('[better-yt-chat] failed to open replies', err);
    });
  }
</script>

{#if like || reply}
  <div class="actions">
    {#if like}
      <button
        type="button"
        class="action"
        aria-pressed={liked}
        aria-label={liked ? 'Unlike' : (likeEntity?.likeButtonA11yText?.content ?? 'Like')}
        style:background-color={like.background}
        style:color={like.color}
        onclick={toggleLike}
      >
        <Icon name={liked ? 'THUMB_UP_FILLED' : 'THUMB_UP'} size={14} />{likeLabel}
      </button>
    {/if}
    {#if reply}
      <button
        type="button"
        class="action"
        aria-label={replyEntity?.replyButtonAccessibilityText ?? 'Reply'}
        style:background-color={reply.background}
        style:color={reply.color}
        onclick={openReplies}
      >
        <Icon name="CHAT_BUBBLE" size={14} />{replyLabel}
      </button>
    {/if}
  </div>
{/if}

<style>
  .actions {
    display: flex;
    flex-wrap: wrap;
  }
  .action {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    margin: 4px 8px 0 0;
    padding: 0 8px;
    border-radius: 12px;
    background-color: rgba(0, 0, 0, 0.05);
    font-size: 12px;
    font-weight: 500;
    line-height: 24px;
    cursor: pointer;
  }
  .action:hover {
    filter: brightness(0.92);
  }
  .action:focus-visible {
    outline: 2px solid currentColor;
  }
</style>
