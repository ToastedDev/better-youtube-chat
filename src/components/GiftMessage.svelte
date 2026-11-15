<script lang="ts">
  import type { GiftChatItem } from '@/lib/chat/model';

  let { item }: { item: GiftChatItem } = $props();
</script>

<!-- YouTube also plays its own gift animation over the chat; that overlay is outside our list. -->
<div class="gift" role="listitem">
  {#if item.photo}<img class="avatar" src={item.photo} alt="" loading="lazy" draggable="false" />{:else}<span
      class="avatar"
    ></span>{/if}
  <div class="content">
    <span class="author">{item.authorName}</span>
    <span class="text">{item.text}</span>{#if item.image}<img
        class="image"
        src={item.image}
        alt={item.imageLabel ?? ''}
        title={item.imageLabel}
        draggable="false"
      />{/if}
  </div>
</div>

<style>
  .gift {
    display: flex;
    align-items: flex-start;
    padding: 4px 24px;
    font-size: 12px;
    line-height: 24px;
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
    min-width: 0;
    overflow-wrap: anywhere;
    color: var(--bytc-text);
  }
  .author {
    margin-right: 2px;
    font-weight: 500;
    color: var(--bytc-text-2);
  }
  .image {
    width: 24px;
    height: 24px;
    margin-left: 4px;
    vertical-align: top;
  }
</style>
