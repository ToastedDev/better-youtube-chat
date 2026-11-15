<script lang="ts">
  import type { Badge } from '@/lib/chat/model';
  import { ICONS } from '@/lib/icons';
  import Icon from './Icon.svelte';

  let { badges }: { badges: Badge[] } = $props();
  // Badges without a drawable icon (e.g. OWNER, shown by the name chip instead) would leave a gap.
  const visible = $derived(badges.filter((b) => b.kind === 'image' || b.icon in ICONS));
</script>

{#each visible as badge, i (i)}<span class="badge" class:moderator={badge.kind === 'icon' && badge.icon === 'MODERATOR'} title={badge.label}
    >{#if badge.kind === 'image'}<img src={badge.src} alt={badge.label} />{:else}<Icon name={badge.icon} size={16} />{/if}</span
  >{/each}

<style>
  .badge {
    display: inline-flex;
    margin-left: 2px;
    vertical-align: middle;
    position: relative;
    top: -1px;
  }
  .badge img {
    width: 16px;
    height: 16px;
  }
</style>
