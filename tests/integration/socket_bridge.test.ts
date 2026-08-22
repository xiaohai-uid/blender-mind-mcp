import assert from "node:assert/strict";
import * as net from "node:net";
import { BlenderSocketClient } from "../../src/bridge/socket_client.ts";
import { LiveSocketAdapter } from "../../src/adapters/live_socket.adapter.ts";

export async function runSocketBridgeTests() {
  console.log("▶ [L3-Integration] Testing Live Socket Client & Bridge Protocol (TCP 127.0.0.1:9899)...");

  const TEST_PORT = 9899;

  // 1. Spin up a Mock Blender Socket Server simulating the Python Addon
  const mockServer = net.createServer((sock) => {
    let buf = "";
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      while (buf.includes("\n")) {
        const idx = buf.indexOf("\n");
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line) continue;

        const req = JSON.parse(line);
        let resp: any = { id: req.id, status: "ok" };

        if (req.action === "ping") {
          resp.result = {
            status: "online",
            blender_version: "4.2.0",
            active_scene: "MockScene",
            object_count: 3
          };
        } else if (req.action === "execute_code") {
          resp.result = {
            success: true,
            stdout: "Mock bpy executed successfully",
            stderr: ""
          };
        } else if (req.action === "get_scene_hierarchy") {
          resp.result = {
            blender_version: "4.2.0",
            scene_name: "MockScene",
            active_object: "HeroMesh",
            total_polygons: 1024,
            total_vertices: 1026,
            objects: [
              {
                name: "HeroMesh",
                type: "MESH",
                location: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
                poly_count: 1024,
                vertex_count: 1026,
                materials: ["PBR_Gold"],
                modifiers: [{ name: "Subsurf", type: "SUBSURF" }]
              }
            ]
          };
        } else if (req.action === "capture_viewport") {
          resp.result = {
            success: true,
            image_base64: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            mime_type: "image/png",
            width: 1920,
            height: 1080
          };
        } else if (req.action === "export_asset") {
          resp.result = {
            success: true,
            filepath: req.payload.filepath,
            format: req.payload.format
          };
        }

        sock.write(JSON.stringify(resp) + "\n");
      }
    });
  });

  await new Promise<void>((resolve) => mockServer.listen(TEST_PORT, "127.0.0.1", () => resolve()));

  try {
    const client = new BlenderSocketClient("127.0.0.1", TEST_PORT);

    // Test 1: Ping handshake
    const pingRes = await client.ping();
    assert.equal(pingRes.status, "online");
    assert.equal(pingRes.blender_version, "4.2.0");

    // Test 2: Execute code
    const execRes = await client.executeCode("import bpy\nprint('hello')");
    assert.ok(execRes.success);
    assert.equal(execRes.stdout, "Mock bpy executed successfully");

    // Test 3: Hierarchy inspection
    const hierarchy = await client.getSceneHierarchy();
    assert.equal(hierarchy.total_polygons, 1024);
    assert.equal(hierarchy.objects[0].name, "HeroMesh");

    // Test 4: Viewport capture
    const viewport = await client.captureViewport();
    assert.ok(viewport.success);
    assert.equal(viewport.mime_type, "image/png");

    // Test 5: LiveSocketAdapter integration
    const adapter = new LiveSocketAdapter("127.0.0.1", TEST_PORT);
    const health = await adapter.getHealth();
    assert.equal(health.status, "healthy");
    assert.equal(health.driverType, "blender_socket");

    const sceneInspection = await adapter.inspectScene();
    assert.equal(sceneInspection.objects.length, 1);
    assert.equal(sceneInspection.objects[0].name, "HeroMesh");

    client.disconnect();
    console.log("  ✔ Live TCP Socket Bridge protocol verified across all 5 endpoints.");
  } finally {
    mockServer.close();
  }
}
