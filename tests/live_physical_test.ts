import { spawn } from "node:child_process";
import { BlenderToolRegistry } from "../src/tools/index.ts";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import assert from "node:assert/strict";

async function runLivePhysicalVerification() {
  console.log("==========================================================");
  console.log("  🚀 PHYSICAL LIVE SYSTEM VERIFICATION (End-to-End Test)");
  console.log("==========================================================\n");

  // Step 1: Launch Python Addon Daemon as an actual background process
  console.log("1. Starting Python Addon TCP Socket Daemon on 127.0.0.1:9876...");
  const pyProcess = spawn("python", ["addon/blender_mcp_addon.py"], {
    stdio: ["pipe", "pipe", "pipe"]
  });

  // Wait 1.5s for socket binding
  await new Promise((resolve) => setTimeout(resolve, 1500));

  try {
    const registry = new BlenderToolRegistry();

    // Step 2: Auto-detect driver (Must latch onto live socket on 9876!)
    console.log("2. Performing live auto-detection & driver handshake...");
    const driver = await registry.autoDetectDriver();
    const health = await driver.getHealth();
    console.log(`   [Handshake Result] Driver: ${health.driverType}, Status: ${health.status}`);
    console.log(`   [Message] ${health.message}`);
    assert.equal(health.driverType, "blender_socket", "Must connect to Live Socket daemon!");
    assert.equal(health.status, "healthy");

    // Step 3: Tool Execution: Create Primitives
    console.log("3. Executing Tool: blender_create_primitive (Torus & Cube)...");
    const torusRes = await registry.handleToolCall("blender_create_primitive", {
      type: "torus",
      name: "QuantumRing",
      location: [0, 0, 1.5],
      size: 3.0
    });
    console.log("   ✔", torusRes.content[0].text);

    // Step 4: Tool Execution: Apply Modifier
    console.log("4. Executing Tool: blender_apply_modifier (Subsurf)...");
    const modRes = await registry.handleToolCall("blender_apply_modifier", {
      object_name: "QuantumRing",
      modifier_type: "subsurf",
      params: { levels: 2 }
    });
    console.log("   ✔", modRes.content[0].text);

    // Step 5: Tool Execution: Procedural Material
    console.log("5. Executing Tool: blender_procedural_material (NeonPBR)...");
    const matRes = await registry.handleToolCall("blender_procedural_material", {
      object_name: "QuantumRing",
      material_name: "NeonCyan",
      base_color: [0.0, 0.9, 1.0, 1.0],
      metallic: 0.9,
      roughness: 0.1,
      emission: [0.0, 0.8, 1.0],
      emission_strength: 5.0
    });
    console.log("   ✔", matRes.content[0].text);

    // Step 6: Tool Execution: Lighting & Camera
    console.log("6. Executing Tools: blender_setup_lighting & blender_setup_camera...");
    const lightRes = await registry.handleToolCall("blender_setup_lighting", {
      name: "KeySun",
      type: "SUN",
      location: [5, -5, 8],
      energy: 3000
    });
    console.log("   ✔", lightRes.content[0].text);

    const camRes = await registry.handleToolCall("blender_setup_camera", {
      name: "StudioCam",
      location: [8, -8, 6],
      look_at: [0, 0, 1],
      focal_length: 85
    });
    console.log("   ✔", camRes.content[0].text);

    // Step 7: Tool Execution: Viewport Snapshot
    console.log("7. Executing Tool: blender_capture_viewport...");
    const snapRes = await registry.handleToolCall("blender_capture_viewport", {});
    console.log(`   ✔ Received ${snapRes.content[0].type} (${snapRes.content[0].data.slice(0, 32)}...)`);
    console.log("   ✔", snapRes.content[1].text);

    // Step 8: Tool Execution: Inspect Scene Hierarchy
    console.log("8. Executing Tool: blender_inspect_scene...");
    const inspectRes = await registry.handleToolCall("blender_inspect_scene", {});
    const sceneData = JSON.parse(inspectRes.content[0].text);
    console.log(`   ✔ Scene: ${sceneData.engine}, Objects: ${sceneData.objects.length}, Polygons: ${sceneData.totalPolyCount}`);

    // Step 9: Tool Execution: Export Binary glTF 3D Asset
    console.log("9. Executing Tool: blender_export_asset (GLB format)...");
    const exportTarget = path.resolve(process.cwd(), "dist/live_quantum_ring.glb");
    const exportRes = await registry.handleToolCall("blender_export_asset", {
      format: "glb",
      output_path: "dist/live_quantum_ring.glb"
    });
    console.log("   ✔", exportRes.content[0].text);

    // Step 10: Physical File Verification on Disk
    console.log("10. Physically verifying generated asset on filesystem...");
    const fileStats = await fs.stat(exportTarget);
    console.log(`   [File Verified] Path: ${exportTarget}`);
    console.log(`   [File Size] ${fileStats.size} bytes`);
    assert.ok(fileStats.size > 0, "Exported GLB must not be empty!");

    const fileBytes = await fs.readFile(exportTarget);
    const magic = fileBytes.toString("utf8", 0, 4);
    console.log(`   [Binary Magic Header] "${magic}" (0x46546C67) -> Valid glTF 2.0 Binary`);
    assert.equal(magic, "glTF", "Header must match glTF magic!");

    console.log("\n==========================================================");
    console.log("  ✅ ALL 10 PHYSICAL LIVE VERIFICATION STEPS PASSED 100%!");
    console.log("==========================================================");
  } finally {
    pyProcess.kill();
  }
}

runLivePhysicalVerification().catch((err) => {
  console.error("\n❌ Live Verification Failed:", err);
  process.exit(1);
});
