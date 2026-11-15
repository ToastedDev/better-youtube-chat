/** Normalized chat model rendered by the UI. */
import type { InnertubeCommand } from '../youtube/types';

export type Segment =
  | { type: 'text'; text: string; bold?: boolean; italic?: boolean; href?: string }
  | { type: 'emoji'; src: string; alt: string; label: string; custom: boolean };

export type Badge =
  | { kind: 'image'; src: string; label: string }
  | { kind: 'icon'; icon: string; label: string };

/** Pills shown before the message, e.g. the viewer leaderboard rank ("👑 #2"). */
export interface Chip {
  label: string;
  icon?: string;
  /** Icon after the label, e.g. the speech bubble on a Super Chat reply's "@name" chip. */
  iconTrailing?: boolean;
  background?: string;
  color?: string;
  /** Run on click, e.g. opening the Super Chat's reply thread. */
  command?: InnertubeCommand;
}

export interface Author {
  name: string;
  channelId: string;
  photo?: string;
  badges: Badge[];
  isOwner: boolean;
  isModerator: boolean;
  isMember: boolean;
  isVerified: boolean;
}

export interface DeletedState {
  /** E.g. "Message deleted by @mod." or "[message retracted]". */
  text: string;
  /** Moderators only: label of the toggle that reveals the original, e.g. "View deleted message". */
  showOriginalLabel?: string;
}

/** Fields shared by every item that has an author (and so a context menu). */
interface AuthoredBase {
  id: string;
  timestampUsec: string;
  /** Chat replay: the video time it was sent at, shown instead of the clock time. */
  timestampText?: string;
  author: Author;
  /** The text "Copy message" copies; may be empty (e.g. a new member announcement). */
  message: Segment[];
  menuParams?: string;
  /** The viewer can moderate this message: clicking anywhere on it opens the menu, like YouTube. */
  canModerate: boolean;
  /** Set when the message was deleted by a moderator or retracted by its author. */
  deleted?: DeletedState;
}

export interface TextChatItem extends AuthoredBase {
  kind: 'text';
  chips: Chip[];
  /** A system line from the author's point of view, e.g. "received a gift membership by @x". */
  system?: boolean;
  /** The viewer's own message that couldn't be sent. */
  sendFailed?: boolean;
}

/** Moderators only: a message AutoMod held for review. */
export interface AutoModChatItem extends AuthoredBase {
  kind: 'automod';
  chips: Chip[];
  /** "This message is held for review." */
  header: Segment[];
  /** The warning icon button, which opens YouTube's explanation dialog. */
  info?: { label: string; command: InnertubeCommand };
  /** Show / Hide. */
  actions: { label: string; command: InnertubeCommand }[];
}

/** A Super Chat. Colors come from the payload (they depend on the amount tier, not the theme). */
export interface PaidChatItem extends AuthoredBase {
  kind: 'paid';
  amount: string;
  /** YouTube's newer single-color card with rounder corners. */
  v2: boolean;
  colors: { header?: string; headerText?: string; body?: string; bodyText?: string; authorName?: string };
  like?: LikeButton;
  reply?: ReplyButton;
  heart?: CreatorHeart;
}

/** Shown when the creator hearted the Super Chat (an entity keyed by `stateKey` says so). */
export interface CreatorHeart {
  stateKey: string;
  thumbnail?: string;
  /** E.g. "❤ by @channel". */
  label?: string;
}

/** Counts come from the store's entities (see `ChatStore.entities`), keyed by `countKey`. */
export interface LikeButton {
  countKey: string;
  /** Entity with the viewer's like state. */
  stateKey?: string;
  /** Shown instead of a zero count, e.g. "Like". */
  placeholder: string;
  like: InnertubeCommand;
  unlike: InnertubeCommand;
  /** Button colors from the payload. */
  background?: string;
  color?: string;
}

export interface ReplyButton {
  countKey: string;
  placeholder: string;
  /** Opens YouTube's reply thread dialog for this Super Chat. */
  command: InnertubeCommand;
  background?: string;
  color?: string;
}

export interface StickerChatItem extends AuthoredBase {
  kind: 'sticker';
  amount: string;
  sticker: { src: string; label: string; width: number; height: number };
  v2: boolean;
  colors: { background?: string; amount?: string; authorName?: string };
}

/** New member, membership milestone, or gifted memberships ("Gifted 5 memberships"). */
export interface MembershipChatItem extends AuthoredBase {
  kind: 'membership';
  /** E.g. "Member for 6 months" or "Sent 5 gift memberships". */
  primary: Segment[];
  /** E.g. "Welcome to <level>!" or the membership level name. */
  subtext: Segment[];
  /** Picture on the right of gifted-membership announcements. */
  image?: string;
}

/** A Jewels gift ("sent Star"). The payload has no channel id, so there's no context menu. */
export interface GiftChatItem {
  kind: 'gift';
  id: string;
  authorName: string;
  photo?: string;
  text: string;
  image?: string;
  imageLabel?: string;
}

/** A fundraiser donation ("Anonymous donated $50.00 to …"). */
export interface DonationChatItem {
  kind: 'donation';
  id: string;
  photo?: string;
  text: Segment[];
  subtext: Segment[];
}

/** YouTube's notices: the welcome message, poll results, etc. */
export interface EngagementChatItem {
  kind: 'engagement';
  id: string;
  message: Segment[];
  /** E.g. POLL. YouTube hides some (the welcome message's YOUTUBE_ROUND); we draw the ones we know. */
  icon?: string;
}

/** Chat mode changes: "Slow mode is on" / "Send a message every 1 minute". */
export interface ModeChangeChatItem {
  kind: 'mode-change';
  id: string;
  text: Segment[];
  subtext: Segment[];
}

/**
 * An empty slot YouTube may later fill in place with `replaceChatItemAction`. Not rendered,
 * but kept so the replacement lands in the right position.
 */
export interface PlaceholderChatItem {
  kind: 'placeholder';
  id: string;
}

export type AuthoredChatItem = TextChatItem | AutoModChatItem | PaidChatItem | StickerChatItem | MembershipChatItem;
export type ChatItem =
  | AuthoredChatItem
  | GiftChatItem
  | DonationChatItem
  | EngagementChatItem
  | ModeChangeChatItem
  | PlaceholderChatItem;

export function isAuthored(item: ChatItem): item is AuthoredChatItem {
  return 'author' in item;
}

/** Where to open the context menu. */
export interface MenuTarget {
  item: AuthoredChatItem;
  /** Viewport point the menu is anchored to. */
  x: number;
  y: number;
  /** Anchor the menu's right edge to `x` (opening from the ⋮ button). */
  alignRight?: boolean;
  /** Y to flip above when there's no room below (top of the ⋮ button). */
  flipY?: number;
}
