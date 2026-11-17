<script lang="ts">
  import type { QuickAction } from '@/lib/chat/model';
  import { getAppContext } from '@/lib/context';
  import Icon from './Icon.svelte';

  let { actions }: { actions: QuickAction[] } = $props();

  const app = getAppContext();
  /** A click is on its way; YouTube removes or updates the message once it lands. */
  let busy = $state(false);

  function run(action: QuickAction) {
    busy = true;
    app.bridge
      .call('runCommand', { command: action.command })
      .catch((err) => console.warn('[better-yt-chat] quick action failed', err))
      .finally(() => (busy = false));
  }
</script>

<!-- YouTube's moderation quick actions: shown over the hovered message while Alt is held. -->
<div class="quick-actions">
  {#each actions as action, i (i)}
    <button
      type="button"
      aria-label={action.label}
      title={action.label}
      disabled={busy}
      onclick={(e) => {
        // Don't let the row's own click (open the menu) fire too.
        e.stopPropagation();
        run(action);
      }}
    >
      <Icon name={action.icon} size={12} />
    </button>
  {/each}
</div>

<style>
  .quick-actions {
    position: absolute;
    z-index: 1;
    inset: -4px 0;
    display: none;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background-color: rgba(0, 0, 0, 0.6);
  }
  button {
    all: unset;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 12px;
    background: #fff;
    color: #000;
    cursor: pointer;
  }
  button:hover {
    background: #e5e5e5;
  }
  button:focus-visible {
    outline: 2px solid #fff;
    outline-offset: 2px;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
