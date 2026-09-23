import type { PlayerIntentPacket } from "./NetworkTypes";

export class WebSocketClient {
  socket: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempt = 0;
  private endpoint = "";
  private token = "";
  private closedByUser = false;
  onIntent: ((packet: PlayerIntentPacket) => void) | null = null;
  onState: ((state: "connecting"|"open"|"closed"|"error") => void) | null = null;

  connect(url: string, token: string): WebSocket | null {
    this.close(false);
    this.endpoint = url;
    this.token = token;
    this.closedByUser = false;
    return this.open();
  }

  private open(): WebSocket | null {
    if (!this.endpoint || !this.token) return null;
    this.onState?.("connecting");
    try {
      const socket = new WebSocket(this.endpoint);
      this.socket = socket;
      socket.addEventListener("open", () => {
        this.reconnectAttempt = 0;
        this.onState?.("open");
        socket.send(JSON.stringify({ type: "auth", token: this.token }));
      });
      socket.addEventListener("message", event => {
        try {
          const payload = JSON.parse(String(event.data)) as {type?: string; data?: PlayerIntentPacket};
          if (payload.type !== "intent" || !payload.data) return;
          this.onIntent?.(payload.data);
        } catch {
          // Ignore malformed server frames without breaking the render loop.
        }
      });
      socket.addEventListener("error", () => this.onState?.("error"));
      socket.addEventListener("close", () => {
        if (this.socket === socket) this.socket = null;
        this.onState?.("closed");
        if (!this.closedByUser) this.scheduleReconnect();
      });
      return socket;
    } catch {
      this.onState?.("error");
      this.scheduleReconnect();
      return null;
    }
  }

  private scheduleReconnect(): void {
    if (this.closedByUser || this.reconnectTimer !== null) return;
    const delay = Math.min(8000, 500 * 2 ** Math.min(this.reconnectAttempt, 4));
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  send(data: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  close(userInitiated = true): void {
    this.closedByUser = userInitiated;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    if (socket) socket.close();
    if (userInitiated) this.onState?.("closed");
  }
}
