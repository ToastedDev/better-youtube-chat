<script lang="ts">
  import type { DonationChatItem } from '@/lib/chat/model';
  import Segments from './Segments.svelte';

  let { item }: { item: DonationChatItem } = $props();
</script>

<div class="row" role="listitem">
  <div class="card">
    {#if item.photo}<img class="avatar" src={item.photo} alt="" loading="lazy" draggable="false" />{/if}
    <div class="content">
      <div class="text"><Segments segments={item.text} /></div>
      {#if item.subtext.length}<div class="subtext"><Segments segments={item.subtext} /></div>{/if}
    </div>
  </div>
</div>

<style>
  .row {
    padding: 4px 24px;
  }
  .card {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-radius: 4px;
    background: var(--bytc-donation-bg);
    color: var(--bytc-text);
  }
  .avatar {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    margin-right: 16px;
    border-radius: 50%;
  }
  .content {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .text {
    margin-bottom: 4px;
    font-size: 14px;
    line-height: 20px;
  }
  .subtext {
    font-size: 12px;
    line-height: 18px;
  }
</style>
