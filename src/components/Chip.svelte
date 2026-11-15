<script lang="ts">
  import type { Chip } from '@/lib/chat/model';
  import { getAppContext } from '@/lib/context';
  import { ICONS } from '@/lib/icons';
  import Icon from './Icon.svelte';

  let { chip }: { chip: Chip } = $props();

  const app = getAppContext();
  // An unknown icon would leave an empty gap.
  const icon = $derived(chip.icon && chip.icon in ICONS ? chip.icon : undefined);

  function onclick() {
    if (!chip.command) return;
    app.bridge.call('runCommand', { command: chip.command }).catch((err) => {
      console.warn('[better-yt-chat] chip action failed', err);
    });
  }
</script>

<!-- No whitespace inside: the chip sits inline right before the message text. -->
{#if chip.command}<button
    type="button"
    class="chip button"
    style:background={chip.background}
    style:color={chip.color}
    {onclick}
    >{#if icon && !chip.iconTrailing}<Icon name={icon} size={12} />{/if}{chip.label}{#if icon && chip.iconTrailing}<Icon
        name={icon}
        size={12}
      />{/if}</button
  >{:else}<span class="chip" style:background={chip.background} style:color={chip.color}
    >{#if icon && !chip.iconTrailing}<Icon name={icon} size={14} />{/if}{chip.label}{#if icon && chip.iconTrailing}<Icon
        name={icon}
        size={14}
      />{/if}</span
  >{/if}

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 20px;
    margin-right: 8px;
    padding: 0 6px;
    border-radius: 10px;
    font-size: 12px;
    font-weight: 500;
    line-height: 20px;
    vertical-align: top;
    background: var(--bytc-chip-bg);
    color: var(--bytc-text);
  }
  /* Tappable chips are YouTube's extra-small buttons, e.g. the "@name" on Super Chat replies. */
  .button {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 24px;
    margin: -2px 8px -2px 0;
    padding: 0 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    line-height: 24px;
    vertical-align: top;
    cursor: pointer;
  }
  .button:hover {
    filter: brightness(0.92);
  }
  .button:focus-visible {
    outline: 2px solid currentColor;
  }
</style>
