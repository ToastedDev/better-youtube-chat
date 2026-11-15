<script lang="ts">
  import type { DeletedState } from '@/lib/chat/model';

  let { deleted, onreveal }: { deleted: DeletedState; onreveal: () => void } = $props();
</script>

<span class="deleted">{deleted.text}</span>{#if deleted.showOriginalLabel}<button
    type="button"
    class="show-original"
    onclick={onreveal}>{deleted.showOriginalLabel}</button
  >{/if}

<style>
  .deleted,
  .show-original {
    font-style: italic;
    opacity: 0.7;
  }
  .show-original {
    all: unset;
    margin-left: 2px;
    font-style: italic;
    text-decoration: underline;
    cursor: pointer;
  }
</style>
