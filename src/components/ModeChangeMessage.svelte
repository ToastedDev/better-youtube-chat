<script lang="ts">
  import type { ModeChangeChatItem } from '@/lib/chat/model';
  import Segments from './Segments.svelte';

  let { item }: { item: ModeChangeChatItem } = $props();
</script>

<!-- YouTube's current style hides the mode icon, so we don't draw it either. -->
<div class="row" role="listitem">
  <div class="card">
    <div class="text"><Segments segments={item.text} /></div>
    {#if item.subtext.length}<div class="subtext"><Segments segments={item.subtext} /></div>{/if}
  </div>
</div>

<style>
  .row {
    padding: 4px 16px;
  }
  .card {
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--bytc-vem-bg);
    color: var(--bytc-text);
    font-size: 12px;
    line-height: 18px;
    overflow-wrap: anywhere;
  }
  .subtext {
    margin-top: 4px;
    color: var(--bytc-text-2);
  }
</style>
