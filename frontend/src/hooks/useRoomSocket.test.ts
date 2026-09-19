import { describe, it, expect, beforeEach } from "vitest";
import { RoomSocketClient, type RoomEvents } from "../lib/roomSocket";
import { needsSnap, backoffDelay, MAX_RETRIES } from "../lib/socket";
import { todayLocal } from "../routes/Room";

class MockWebSocket {
  static OPEN = 1;
  static instances: MockWebSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  closes = 0;
  onopen: ((e: unknown) => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closes += 1;
    this.readyState = 3;
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({});
  }

  receive(msg: unknown): void {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }

  drop(code = 1006): void {
    this.onclose?.({ code });
  }
}

const factory = (url: string): WebSocket => new MockWebSocket(url) as unknown as WebSocket;

function events(overrides: Partial<RoomEvents> = {}): RoomEvents & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    onSnapshot: () => void calls.push("snapshot"),
    onTick: () => void calls.push("tick"),
    onPresence: () => void calls.push("presence"),
    onFinalized: () => void calls.push("finalized"),
    onAuthFailure: () => void calls.push("auth"),
    onGaveUp: () => void calls.push("gaveup"),
    ...overrides,
  };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  MockWebSocket.instances = [];
  (globalThis as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
});

describe("useRoomSocket", () => {
  it("snaps to server tick on drift >2s", () => {
    expect(needsSnap(100, 97)).toBe(true);
    expect(needsSnap(100, 99)).toBe(false);
    expect(needsSnap(100, 100)).toBe(false);
  });

  it("retries with exponential backoff, then gives up", () => {
    expect(backoffDelay(0)).toBe(1000);
    expect(backoffDelay(1)).toBe(2000);
    expect(backoffDelay(2)).toBe(4000);
    expect(MAX_RETRIES).toBe(3);
  });

  it("sends join on open and dispatches room messages", () => {
    const ev = events();
    const client = new RoomSocketClient("ws://x", ev, factory);
    client.connect();
    const ws = MockWebSocket.instances[0];
    ws.open();
    expect(ws.sent).toEqual([JSON.stringify({ type: "join" })]);
    ws.receive({ type: "state_snapshot", remaining_s: 100, participants: [] });
    ws.receive({ type: "tick", remaining_s: 90 });
    ws.receive({ type: "presence", participants: [] });
    ws.receive({ type: "finalized" });
    ws.receive({ type: "bogus" });
    expect(ev.calls).toEqual(["snapshot", "tick", "presence", "finalized"]);
    client.close();
  });

  it("short-circuits on 4401 with no reconnect", async () => {
    const ev = events();
    const client = new RoomSocketClient("ws://x", ev, factory);
    client.connect();
    MockWebSocket.instances[0].open();
    MockWebSocket.instances[0].drop(4401);
    await flush();
    expect(ev.calls).toEqual(["auth"]);
    expect(MockWebSocket.instances).toHaveLength(1);
    client.close();
  });

  it("reconnects 3x on abnormal close, then gives up", async () => {
    const waits: number[] = [];
    const ev = events();
    const client = new RoomSocketClient(
      "ws://x",
      ev,
      factory,
      (ms) => {
        waits.push(ms);
        return Promise.resolve();
      },
    );
    client.connect();
    for (let i = 0; i < 4; i++) {
      MockWebSocket.instances[i].open();
      MockWebSocket.instances[i].drop(1006);
      await flush();
    }
    expect(waits).toEqual([1000, 2000, 4000]);
    expect(MockWebSocket.instances).toHaveLength(4);
    expect(ev.calls).toEqual(["gaveup"]);
    client.close();
  });

  it("never reconnects after explicit close", async () => {
    const ev = events();
    const client = new RoomSocketClient("ws://x", ev, factory);
    client.connect();
    const ws = MockWebSocket.instances[0];
    ws.open();
    client.close();
    ws.drop(1006);
    await flush();
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(ev.calls).toEqual([]);
  });

  it("only sends heartbeat/complete on an open socket", () => {
    const ev = events();
    const client = new RoomSocketClient("ws://x", ev, factory);
    client.connect();
    const ws = MockWebSocket.instances[0];
    client.heartbeat();
    expect(ws.sent).toEqual([]);
    ws.open();
    client.heartbeat();
    client.finalizeRoom();
    expect(ws.sent).toEqual([
      JSON.stringify({ type: "join" }),
      JSON.stringify({ type: "heartbeat" }),
      JSON.stringify({ type: "complete" }),
    ]);
    client.close();
  });
});

describe("todayLocal", () => {
  it("uses the local calendar date, not UTC", () => {
    process.env.TZ = "Pacific/Kiritimati"; // UTC+14
    // 10:00 UTC on the 18th is already the 19th in Kiritimati.
    expect(todayLocal(new Date("2026-09-18T10:00:00Z"))).toBe("2026-09-19");
    expect(new Date("2026-09-18T10:00:00Z").toISOString().slice(0, 10)).toBe("2026-09-18");
  });
});
