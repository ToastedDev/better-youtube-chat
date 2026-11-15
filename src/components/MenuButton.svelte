<script lang="ts">
  import Icon from './Icon.svelte';

  let { onclick }: { onclick: (event: MouseEvent) => void } = $props();
</script>

<!-- Shown on hover of the card it sits in (see `.card:hover` in the parent). -->
<button type="button" class="menu-button" aria-label="Chat actions" {onclick}>
  <Icon name="MORE_VERT" />
</button>

<style>
  .menu-button {
    all: unset;
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    color: inherit;
    cursor: pointer;
    opacity: 0;
  }
  .menu-button:focus-visible,
  :global(.card:hover) .menu-button,
  :global(.menu-open) .menu-button {
    opacity: 1;
  }
</style>
