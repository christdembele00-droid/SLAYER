export class WebSocketClient {
  socket: WebSocket | null = null;

  connect(url: string, token: string): WebSocket {
    this.close();
    this.socket = new WebSocket(url);
    this.socket.addEventListener("open", () => {
      this.socket?.send(JSON.stringify({ type: "auth", token }));
    });
    return this.socket;
  }

  send(data: unknown): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }
}
