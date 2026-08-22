import * as net from "node:net";

export interface SocketResponse<T = any> {
  id?: number | string;
  status: "ok" | "error";
  result?: T;
  error?: string;
}

export class BlenderSocketClient {
  private host: string;
  private port: number;
  private client: net.Socket | null = null;
  private pendingRequests: Map<number, (res: SocketResponse) => void> = new Map();
  private reqIdCounter = 1;
  private buffer = "";
  private isConnected = false;

  constructor(host = "127.0.0.1", port = 9876) {
    this.host = host;
    this.port = port;
  }

  public async connect(): Promise<boolean> {
    if (this.isConnected && this.client && !this.client.destroyed) {
      return true;
    }

    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(2000);

      socket.connect(this.port, this.host, () => {
        this.client = socket;
        this.isConnected = true;
        this.setupListeners();
        resolve(true);
      });

      socket.on("error", () => {
        this.isConnected = false;
        socket.destroy();
        resolve(false);
      });

      socket.on("timeout", () => {
        this.isConnected = false;
        socket.destroy();
        resolve(false);
      });
    });
  }

  private setupListeners() {
    if (!this.client) return;

    this.client.on("data", (data) => {
      this.buffer += data.toString("utf8");
      while (this.buffer.includes("\n")) {
        const idx = this.buffer.indexOf("\n");
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);

        if (!line) continue;

        try {
          const resp: SocketResponse = JSON.parse(line);
          const id = Number(resp.id);
          if (id && this.pendingRequests.has(id)) {
            const resolver = this.pendingRequests.get(id)!;
            this.pendingRequests.delete(id);
            resolver(resp);
          }
        } catch {
          // Ignore invalid chunk
        }
      }
    });

    this.client.on("close", () => {
      this.isConnected = false;
      this.client = null;
    });

    this.client.on("error", () => {
      this.isConnected = false;
    });
  }

  public async sendCommand<T = any>(
    action: string,
    payload: Record<string, any> = {},
    timeoutMs = 15000
  ): Promise<T> {
    const connected = await this.connect();
    if (!connected || !this.client) {
      throw new Error(
        `Cannot connect to Blender MCP Addon at ${this.host}:${this.port}. Please ensure Blender is open and "Start MCP Bridge" is active in the 3D Viewport sidebar.`
      );
    }

    const id = this.reqIdCounter++;
    const message = JSON.stringify({ id, action, payload }) + "\n";

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Blender socket command '${action}' timed out after ${timeoutMs}ms.`));
      }, timeoutMs);

      this.pendingRequests.set(id, (res) => {
        clearTimeout(timer);
        if (res.status === "ok") {
          resolve(res.result as T);
        } else {
          reject(new Error(res.error || `Blender execution error for action '${action}'`));
        }
      });

      this.client!.write(message);
    });
  }

  public async ping(): Promise<{ status: string; blender_version: string; active_scene: string }> {
    return this.sendCommand("ping", {});
  }

  public async executeCode(code: string): Promise<{ success: boolean; stdout: string; stderr: string }> {
    return this.sendCommand("execute_code", { code });
  }

  public async getSceneHierarchy(): Promise<any> {
    return this.sendCommand("get_scene_hierarchy", {});
  }

  public async captureViewport(): Promise<{ success: boolean; image_base64: string; mime_type: string; width: number; height: number }> {
    return this.sendCommand("capture_viewport", {});
  }

  public async exportAsset(format: string, filepath: string): Promise<{ success: boolean; filepath: string; format: string }> {
    return this.sendCommand("export_asset", { format, filepath });
  }

  public disconnect() {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      this.isConnected = false;
    }
  }
}
