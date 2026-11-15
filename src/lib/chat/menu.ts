import type { AuthoredChatItem, MenuTarget } from './model';

export type OpenMenu = (target: MenuTarget) => void;

/**
 * Event handlers that open the context menu for an item, shared by every authored item.
 * `getItem` is a getter so the handlers always see the latest (reactive) item.
 */
export function menuHandlers(getItem: () => AuthoredChatItem, onmenu: OpenMenu) {
  function fromElement(event: MouseEvent, alignRight: boolean) {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    onmenu({
      item: getItem(),
      x: alignRight ? rect.right : rect.left,
      y: rect.bottom,
      alignRight,
      flipY: rect.top,
    });
  }

  return {
    /** The ⋮ button: the menu hangs below it, right-aligned. */
    button: (event: MouseEvent) => fromElement(event, true),
    /** Clicking the author's name: the menu hangs below it, left-aligned. */
    author: (event: MouseEvent) => fromElement(event, false),
    /** For moderators YouTube makes the whole message clickable to open the menu. */
    click(event: MouseEvent) {
      const item = getItem();
      if (!item.canModerate) return;
      if ((event.target as Element).closest('a, button')) return;
      if (window.getSelection()?.toString()) return; // Let people select text.
      onmenu({ item, x: event.clientX, y: event.clientY });
    },
    contextmenu(event: MouseEvent) {
      if (event.shiftKey) return; // Shift+right-click keeps the browser menu.
      event.preventDefault();
      onmenu({ item: getItem(), x: event.clientX, y: event.clientY });
    },
  };
}
