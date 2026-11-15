import type { ChatAction } from '../youtube/types';

interface Entry {
  offsetMs: number;
  action: ChatAction;
  id: string;
}

/**
 * A past stream's chat, by video time. YouTube sends it in overlapping chunks of
 * `replayChatItemAction { actions, videoOffsetTimeMsec }`: every few seconds while playing, and a
 * window around the new time after a seek. We keep each action once, sorted by offset, and the
 * store shows the ones at or before the current video time.
 */
export class ReplayTimeline {
  #entries: Entry[] = [];
  #ids = new Set<string>();

  get size(): number {
    return this.#entries.length;
  }

  clear(): void {
    this.#entries = [];
    this.#ids.clear();
  }

  /**
   * Adds the replay actions among `actions`. Returns the offset range they span, and the earliest
   * offset among the ones that were new.
   */
  add(actions: ChatAction[]): { earliestNew?: number; range?: { minMs: number; maxMs: number } } {
    let earliest: number | undefined;
    let chunk: { minMs: number; maxMs: number } | undefined;
    for (const outer of actions) {
      const replay = outer.replayChatItemAction;
      if (!replay) continue;
      const offsetMs = Number(replay.videoOffsetTimeMsec);
      if (!Number.isFinite(offsetMs)) continue;
      chunk = { minMs: Math.min(chunk?.minMs ?? offsetMs, offsetMs), maxMs: Math.max(chunk?.maxMs ?? offsetMs, offsetMs) };
      for (const action of replay.actions ?? []) {
        const id = actionId(action, offsetMs);
        if (this.#ids.has(id)) continue;
        this.#ids.add(id);
        // Chunks mostly arrive in order, so this usually appends.
        this.#entries.splice(this.#upperBound(offsetMs), 0, { offsetMs, action, id });
        if (earliest === undefined || offsetMs < earliest) earliest = offsetMs;
      }
    }
    return { earliestNew: earliest, range: chunk };
  }

  /** Actions with `fromMs < offset <= toMs`, in order. */
  between(fromMs: number, toMs: number): ChatAction[] {
    return this.#entries.slice(this.#upperBound(fromMs), this.#upperBound(toMs)).map((e) => e.action);
  }

  /** The last `count` actions with `sinceMs < offset <= ms`. */
  lastUpTo(ms: number, count: number, sinceMs: number): ChatAction[] {
    const end = this.#upperBound(ms);
    const start = Math.max(this.#upperBound(sinceMs), end - count);
    return this.#entries.slice(start, end).map((e) => e.action);
  }

  /**
   * Forgets what's far from `ms`, keeping at least `keepBefore` actions before it plus everything
   * within `windowMs` on either side. YouTube fetches a fresh window after a seek, so a seek back
   * still fills in.
   */
  prune(ms: number, keepBefore: number, windowMs: number): void {
    const end = this.#upperBound(ms);
    const start = Math.min(Math.max(0, end - keepBefore), this.#upperBound(ms - windowMs));
    const stop = this.#upperBound(ms + windowMs);
    if (start === 0 && stop === this.#entries.length) return;
    for (const e of this.#entries.slice(0, start)) this.#ids.delete(e.id);
    for (const e of this.#entries.slice(stop)) this.#ids.delete(e.id);
    this.#entries = this.#entries.slice(start, stop);
  }

  /** Index of the first entry with an offset greater than `ms`. */
  #upperBound(ms: number): number {
    let lo = 0;
    let hi = this.#entries.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.#entries[mid]!.offsetMs <= ms) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }
}

/** Chunks overlap, so the same action shows up more than once. */
function actionId(action: ChatAction, offsetMs: number): string {
  const item = action.addChatItemAction?.item;
  const renderer = item && (Object.values(item)[0] as { id?: unknown } | undefined);
  if (typeof renderer?.id === 'string') return `add:${renderer.id}`;
  return `${offsetMs}:${JSON.stringify(action)}`;
}
