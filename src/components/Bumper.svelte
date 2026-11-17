<script lang="ts">
  import type { Bumper } from '@/lib/chat/model';
  import Icon from './Icon.svelte';

  let { bumper }: { bumper: Bumper } = $props();
</script>

<div class="bumper">
  {#if bumper.icon}<span class="icon" style:color={bumper.iconColor}><Icon name={bumper.icon} /></span>{/if}
  <span class="text">{bumper.text}</span>
</div>

<style>
  .bumper {
    display: flex;
    align-items: center;
    margin-top: 8px;
    padding: 12px 16px;
    border-radius: 4px;
    background: var(--bytc-chip-bg);
    color: var(--bytc-text);
    font-size: 12px;
    line-height: 18px;
  }
  .icon {
    display: flex;
    margin-right: 16px;
  }
</style>
