import {
  AUTH_CLOSE_CODE,
  MAX_RETRIES,
  backoffDelay,
} from "./socket";

export interface Participant {
  id: number;
  email: string;
  online: boolean;
}

export interface RoomEvents {
  onSnapshot(remaining: number, participants: Participant[]): void;
  onTick(serverRemaining: number): void;
  onPresence(participants: Participant[]): void;
  onFinalized(): void;
  onAuthFailure(): void;
  onGaveUp(): void;
}

export type SocketFactory = (url: string) => WebSocket;
export type DelayFn = (ms: number) => Promise<void>;

const defaultDelay: DelayFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

type Incoming =
  | { type: "state_snapshot"; remaining_s: number; participants: Participant[] }
  | { type: "tick"; remaining_s: number }
  | { type: "presence"; participants: Participant[] }
  | { type: "finalized" }
  | { type: string };

/**
 * Framework-free live-room socket: join-on-open, message dispatch,
 * exponential-backoff reconnect, 4401 short-circuit. The hook owns UI
 * state (countdown, drift snap); this class owns the wire.
 */
export class RoomSocketClient {
  private ws: WebSocket | null = null;
  private retries = 0;
  private closed = false;

  constructor(
    private url: string,
    private events: RoomEvents,
    private factory: SocketFactory = (url) => new WebSocket(url),
    private delay: DelayFn = defaultDelay,
  ) {}

  connect(): void {
    this.closed = false;
    const ws = this.factory(this.url);
    this.ws = ws;
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: "join" }));
    };
    ws.onmessage = (event: MessageEvent) => {
      this.dispatch(JSON.parse(event.data as string) as Incoming);
    };
    ws.onclose = (event: CloseEvent) => {
      void this.handleClose(event.code);
    };
  }

  private dispatch(msg: Incoming): void {
    const handlers: Record<string, (m: Incoming) => void> = {
      state_snapshot: (m) => {
        // A snapshot proves the connection is useful: restart the backoff.
        this.retries = 0;
        const s = m as { remaining_s: number; participants: Participant[] };
        this.events.onSnapshot(s.remaining_s, s.participants);
      },
      tick: (m) => this.events.onTick((m as { remaining_s: number }).remaining_s),
      presence: (m) =>
        this.events.onPresence((m as { participants: Participant[] }).participants),
      finalized: () => this.events.onFinalized(),
    };
    handlers[msg.type]?.(msg);
  }

  private async handleClose(code: number): Promise<void> {
    if (this.closed) return;
    if (code === AUTH_CLOSE_CODE) {
      this.events.onAuthFailure();
      return;
    }
    if (this.retries < MAX_RETRIES) {
      const wait = backoffDelay(this.retries);
      this.retries += 1;
      await this.delay(wait);
      if (!this.closed) this.connect();
    } else {
      this.events.onGaveUp();
    }
  }

  heartbeat(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "heartbeat" }));
    }
  }

  finalizeRoom(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "complete" }));
    }
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
  }
}
