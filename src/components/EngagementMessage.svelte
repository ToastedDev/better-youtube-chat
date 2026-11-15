<script lang="ts">
  import type { EngagementChatItem } from '@/lib/chat/model';
  import { ICONS } from '@/lib/icons';
  import Icon from './Icon.svelte';
  import Segments from './Segments.svelte';

  let { item }: { item: EngagementChatItem } = $props();
  const icon = $derived(item.icon && item.icon in ICONS ? item.icon : undefined);
</script>

<div class="row" role="listitem">
  <div class="card">
    {#if icon}<span class="icon"><Icon name={icon} /></span>{/if}
    <!-- pre-wrap: poll results put each option on its own line with "\n" runs. -->
    <div class="message"><Segments segments={item.message} /></div>
  </div>
</div>

<style>
  .row {
    padding: 4px 16px;
  }
  .card {
    display: flex;
    align-items: flex-start;
    padding: 8px 12px;
    border-radius: 8px;
    background: var(--bytc-vem-bg);
    color: var(--bytc-text);
    font-size: 12px;
    line-height: 18px;
  }
  .icon {
    display: flex;
    flex-shrink: 0;
    margin-right: 12px;
  }
  .message {
    min-width: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
</style>
