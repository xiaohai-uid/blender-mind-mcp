#!/usr/bin/env node
import * as readline from "node:readline";
import { BlenderToolRegistry } from "./tools/index.ts";

async function main() {
  const registry = new BlenderToolRegistry();
  await registry.autoDetectDriver();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  const sendResponse = (id: string | number | null, result?: any, error?: any) => {
    const payload: any = {
      jsonrpc: "2.0",
      id: id ?? null
    };
    if (error) {
      payload.error = error;
    } else {
      payload.result = result ?? {};
    }
    process.stdout.write(JSON.stringify(payload) + "\n");
  };

  process.stderr.write("[blender-mind-mcp] Server initialized and listening on stdio.\n");

  rl.on("line", async (line) => {
    if (!line.trim()) return;

    let req: any;
    try {
      req = JSON.parse(line);
    } catch (e: any) {
      sendResponse(null, undefined, {
        code: -32700,
        message: "Parse error: Invalid JSON received."
      });
      return;
    }

    const { id, method, params } = req;

    try {
      switch (method) {
        case "initialize": {
          sendResponse(id, {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: "blender-mind-mcp",
              version: "1.0.0"
            }
          });
          break;
        }

        case "notifications/initialized": {
          // No response needed for notifications
          break;
        }

        case "ping": {
          sendResponse(id, {});
          break;
        }

        case "tools/list": {
          sendResponse(id, {
            tools: registry.getToolDefinitions()
          });
          break;
        }

        case "tools/call": {
          const toolName = params?.name;
          const args = params?.arguments || {};
          const result = await registry.handleToolCall(toolName, args);
          sendResponse(id, result);
          break;
        }

        default: {
          sendResponse(id, undefined, {
            code: -32601,
            message: `Method not found: ${method}`
          });
          break;
        }
      }
    } catch (err: any) {
      process.stderr.write(`[blender-mind-mcp] Error handling "${method}": ${err.message}\n`);
      sendResponse(id, undefined, {
        code: -32000,
        message: err.message || "Internal tool execution error"
      });
    }
  });

  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
}

main().catch((err) => {
  process.stderr.write(`[blender-mind-mcp] Fatal error: ${err.message}\n`);
  process.exit(1);
});
