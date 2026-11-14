<script lang="ts">
  import type { EngagementChatItem } from '@/lib/chat/model';
  import Segments from './Segments.svelte';

  let { item }: { item: EngagementChatItem } = $props();
</script>

<div class="engagement" role="listitem">
  <Segments segments={item.message} />
</div>

<style>
  .engagement {
    margin: 8px 24px;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--bytc-vem-bg);
    color: var(--bytc-text-2);
    font-size: 12px;
    line-height: 18px;
  }
</style>
