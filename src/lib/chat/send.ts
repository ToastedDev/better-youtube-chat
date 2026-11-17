import type { ChatAction } from '../youtube/types';

/**
 * Whether the viewer's message with this client id went through, from YouTube's send_message
 * response. Only a response with the real message for the local copy (`addChatItemAction` with
 * that `clientId`) counts. A refused send still answers 200, e.g. for a viewer in a timeout:
 * `{ actions: [{ dimChatItemAction: { clientAssignedId } }], timeoutDurationUsec, errorMessage }`.
 */
export function wasSent(response: { actions?: unknown } | undefined, clientId: string): boolean {
  const actions = Array.isArray(response?.actions) ? (response.actions as ChatAction[]) : [];
  return actions.some((a) => a?.addChatItemAction?.clientId === clientId);
}
