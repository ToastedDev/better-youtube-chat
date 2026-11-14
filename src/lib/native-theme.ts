/**
 * Copies author styles from YouTube's own (hidden) message list onto our host as CSS variables.
 *
 * YouTube runs style experiments (e.g. `enable-improved-visibility-style`) whose colors live in
 * hashed, build-specific custom properties, so they can't be referenced by name. The native list
 * keeps rendering behind ours, so we read the computed styles of its elements instead.
 */

interface Sample {
  selector: string;
  /** Our custom property → computed CSS property to copy. */
  props: Record<string, string>;
}

const SAMPLES: Sample[] = [
  {
    selector: 'yt-live-chat-author-chip #author-name.owner',
    props: {
      '--bytc-owner-bg': 'background-color',
      '--bytc-owner-fg': 'color',
      '--bytc-owner-padding': 'padding',
      '--bytc-owner-radius': 'border-radius',
      '--bytc-owner-line-height': 'line-height',
    },
  },
  { selector: 'yt-live-chat-author-chip #author-name.moderator', props: { '--bytc-moderator': 'color' } },
  { selector: 'yt-live-chat-author-chip #author-name.member', props: { '--bytc-member': 'color' } },
  { selector: 'yt-live-chat-author-chip[is-verified] #author-name', props: { '--bytc-verified': 'color' } },
];

export class NativeThemeSampler {
  #sampled = new Set<Sample>();
  #values = new Map<string, string>();
  #host?: HTMLElement;

  /** Re-apply known values to a (re)mounted host. */
  attach(host: HTMLElement): void {
    this.#host = host;
    for (const [name, value] of this.#values) host.style.setProperty(name, value);
    this.update();
  }

  /** Theme changed: everything must be sampled again. */
  reset(): void {
    for (const name of this.#values.keys()) this.#host?.style.removeProperty(name);
    this.#values.clear();
    this.#sampled.clear();
    this.update();
  }

  /** Cheap: only looks for roles that haven't been sampled yet. */
  update(): void {
    if (this.#sampled.size === SAMPLES.length) return;
    for (const sample of SAMPLES) {
      if (this.#sampled.has(sample)) continue;
      const el = document.querySelector(`yt-live-chat-item-list-renderer ${sample.selector}`);
      if (!el) continue;
      const style = getComputedStyle(el);
      for (const [name, prop] of Object.entries(sample.props)) {
        const value = style.getPropertyValue(prop);
        if (!value) continue;
        this.#values.set(name, value);
        this.#host?.style.setProperty(name, value);
      }
      this.#sampled.add(sample);
    }
  }
}
