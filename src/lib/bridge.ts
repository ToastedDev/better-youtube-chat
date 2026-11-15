/** ISOLATED-world side of the bridge: receives chat payloads and calls page RPCs. */
import { listen, post, type ChatPayload, type RpcMap, type RpcMethod } from './protocol';

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class PageBridge {
  #nextId = 1;
  #pending = new Map<number, Pending>();

  constructor(onChat: (payload: ChatPayload) => void, onProgress: (seconds: number) => void) {
    listen('page', (msg) => {
      switch (msg.type) {
        case 'ready':
          post('ext', { type: 'hello' });
          break;
        case 'chat':
          onChat(msg.payload);
          break;
        case 'progress':
          onProgress(msg.seconds);
          break;
        case 'rpc-result': {
          const pending = this.#pending.get(msg.id);
          if (!pending) return;
          this.#pending.delete(msg.id);
          clearTimeout(pending.timer);
          if (msg.ok) pending.resolve(msg.result);
          else pending.reject(new Error(msg.error));
          break;
        }
      }
    });
    post('ext', { type: 'hello' });
  }

  call<M extends RpcMethod>(method: M, args: RpcMap[M]['args'], timeoutMs = 15_000): Promise<RpcMap[M]['result']> {
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error(`RPC ${method} timed out`));
      }, timeoutMs);
      this.#pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
      post('ext', { type: 'rpc', id, method, args });
    });
  }
}
