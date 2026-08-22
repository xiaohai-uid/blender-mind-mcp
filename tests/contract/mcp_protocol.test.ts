import assert from "node:assert/strict";
import { BlenderToolRegistry } from "../../src/tools/index.ts";

export async function runMcpContractTests() {
  console.log("▶ [L2-Contract] Testing MCP Tool Registry & Protocol Contract...");

  const registry = new BlenderToolRegistry();
  const tools = registry.getToolDefinitions();

  // Test 1: Validate tool counts
  assert.equal(tools.length, 10, "Registry must expose exactly 10 MCP tools");

  const toolNames = tools.map((t) => t.name);
  assert.ok(toolNames.includes("blender_create_primitive"));
  assert.ok(toolNames.includes("blender_apply_modifier"));
  assert.ok(toolNames.includes("blender_procedural_material"));
  assert.ok(toolNames.includes("blender_setup_lighting"));
  assert.ok(toolNames.includes("blender_setup_camera"));
  assert.ok(toolNames.includes("blender_capture_viewport"));
  assert.ok(toolNames.includes("blender_export_asset"));
  assert.ok(toolNames.includes("blender_inspect_scene"));
  assert.ok(toolNames.includes("blender_execute_bpy"));
  assert.ok(toolNames.includes("blender_health"));

  // Test 2: Tool execution - create primitive
  const createRes = await registry.handleToolCall("blender_create_primitive", {
    type: "cylinder",
    name: "Column",
    location: [0, 0, 0],
    size: 2.0
  });
  assert.ok(createRes.content[0].text.includes("Successfully created primitive"));

  // Test 3: Tool execution - modifier
  const modRes = await registry.handleToolCall("blender_apply_modifier", {
    object_name: "Column",
    modifier_type: "bevel",
    params: { width: 0.05, segments: 2 }
  });
  assert.ok(modRes.content[0].text.includes("Successfully attached modifier"));

  // Test 4: Tool execution - lighting
  const lightRes = await registry.handleToolCall("blender_setup_lighting", {
    name: "KeySun",
    type: "SUN",
    energy: 2000
  });
  assert.ok(lightRes.content[0].text.includes("Successfully configured SUN light"));

  // Test 5: Tool execution - camera
  const camRes = await registry.handleToolCall("blender_setup_camera", {
    name: "HeroCam",
    focal_length: 50
  });
  assert.ok(camRes.content[0].text.includes("Successfully positioned camera"));

  // Test 6: Tool execution - viewport snapshot
  const viewRes = await registry.handleToolCall("blender_capture_viewport", {});
  assert.equal(viewRes.content[0].type, "image");
  assert.ok(viewRes.content[0].data.length > 0);

  // Test 7: Tool execution - inspect scene
  const inspectRes = await registry.handleToolCall("blender_inspect_scene", {});
  const parsedScene = JSON.parse(inspectRes.content[0].text);
  assert.equal(parsedScene.objects.length, 1);
  assert.equal(parsedScene.objects[0].name, "Column");

  // Test 8: Health check tool
  const healthRes = await registry.handleToolCall("blender_health", {});
  const healthData = JSON.parse(healthRes.content[0].text);
  assert.ok(healthData.status === "healthy" || healthData.status === "offline");

  console.log("  ✔ MCP Tool Contract tests passed (8 assertions).");
}

