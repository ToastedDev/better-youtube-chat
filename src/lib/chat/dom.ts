/** Helpers that touch YouTube's native live chat DOM (safe from the isolated world). */

function chatInput(): HTMLElement | null {
  return document.querySelector<HTMLElement>('yt-live-chat-text-input-field-renderer #input[contenteditable]');
}

export function canMention(): boolean {
  return chatInput() != null;
}

/** Appends `@name ` to the native chat input and focuses it. */
export function insertMention(name: string): boolean {
  const input = chatInput();
  if (!input) return false;
  input.focus();
  const selection = window.getSelection();
  if (selection) {
    selection.selectAllChildren(input);
    selection.collapseToEnd();
  }
  const current = input.textContent ?? '';
  const prefix = current && !/\s$/.test(current) ? ' ' : '';
  const mention = name.startsWith('@') ? name : `@${name}`;
  // execCommand fires the input events YouTube's input field listens for.
  document.execCommand('insertText', false, `${prefix}${mention} `);
  return true;
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}
