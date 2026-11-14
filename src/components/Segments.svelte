<script lang="ts">
  import type { Segment } from '@/lib/chat/model';

  let { segments, viewerName }: { segments: Segment[]; viewerName?: string } = $props();

  // Highlight mentions of the signed-in viewer, like YouTube does.
  const mentionRe = $derived.by(() => {
    const name = viewerName?.replace(/^@/, '').trim();
    if (!name) return null;
    return new RegExp(`(@?${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?![\\w.-])`, 'gi');
  });

  function split(text: string): { text: string; mention: boolean }[] {
    if (!mentionRe) return [{ text, mention: false }];
    // split() with one capture group puts the matches at odd indices.
    return text
      .split(mentionRe)
      .map((part, i) => ({ text: part, mention: i % 2 === 1 }))
      .filter((part) => part.text);
  }
</script>

{#each segments as s, i (i)}{#if s.type === 'emoji'}<img class="emoji" class:custom={s.custom} src={s.src} alt={s.alt} title={s.label} draggable="false" />{:else if s.href}<a href={s.href} target="_blank" rel="noopener noreferrer" class:bold={s.bold} class:italic={s.italic}>{s.text}</a>{:else}<span class:bold={s.bold} class:italic={s.italic}>{#each split(s.text) as part, j (j)}{#if part.mention}<span class="mention">{part.text}</span>{:else}{part.text}{/if}{/each}</span>{/if}{/each}

<style>
  .emoji {
    width: 24px;
    height: 24px;
    margin: -1px 2px 1px;
    vertical-align: middle;
  }
  a {
    color: var(--bytc-link);
    text-decoration: none;
  }
  a:hover {
    text-decoration: underline;
  }
  .bold {
    font-weight: 500;
  }
  .italic {
    font-style: italic;
  }
  .mention {
    padding: 1px 4px;
    border-radius: 2px;
    background: var(--bytc-mention-bg);
    color: var(--bytc-mention-fg);
  }
</style>
