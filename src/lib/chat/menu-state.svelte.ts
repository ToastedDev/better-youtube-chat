import type { MenuTarget } from './model';

/** The open context menu, shared by our list and YouTube's pinned message banner (see `PageBridge`). */
export class MenuState {
  target = $state.raw<MenuTarget | null>(null);
}
