<script lang="ts">
  import { ICONS } from '@/lib/icons';

  let { name, size = 24 }: { name?: string; size?: number } = $props();
  const path = $derived(name ? ICONS[name] : undefined);
</script>

<svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
  {#if path}<path d={path} />{/if}
</svg>

<style>
  svg {
    display: inline-block;
    flex-shrink: 0;
    fill: currentColor;
    vertical-align: middle;
  }
</style>
