import assert from "node:assert/strict";
import { MockGeometryAdapter } from "../../src/adapters/mock_geometry.adapter.ts";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

export async function runExportSimulationTests() {
  console.log("▶ [L3-Integration] Testing 3D Asset Export & Simulation Verification...");

  const adapter = new MockGeometryAdapter();
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "blender-test-export-"));

  try {
    // 1. Build a scene with multiple objects & modifiers
    await adapter.createPrimitive("cube", "BaseCube", { location: [0, 0, 0] });
    await adapter.applyModifier("BaseCube", "bevel", { width: 0.1, segments: 3 });
    await adapter.assignMaterial("BaseCube", {
      name: "CyberBlue",
      baseColor: [0.1, 0.4, 0.9, 1.0],
      metallic: 0.9,
      roughness: 0.1
    });

    // 2. Export GLB Binary
    const glbPath = path.join(tempDir, "cyber_cube.glb");
    const glbResult = await adapter.exportScene("glb", glbPath);

    assert.ok(glbResult.success);
    assert.ok(glbResult.fileSizeBytes > 0);

    const glbBytes = await fs.readFile(glbPath);
    // Assert glTF binary magic number: 0x46546C67 ("glTF")
    const magic = glbBytes.readUInt32LE(0);
    assert.equal(magic, 0x46546c67, "File must have valid glTF binary header magic (0x46546C67)");

    const version = glbBytes.readUInt32LE(4);
    assert.equal(version, 2, "GLB version must be 2");

    // 3. Export OBJ Format
    const objPath = path.join(tempDir, "cyber_cube.obj");
    const objResult = await adapter.exportScene("obj", objPath);
    assert.ok(objResult.success);

    const objText = await fs.readFile(objPath, "utf8");
    assert.match(objText, /o SimulatedMesh/);
    assert.match(objText, /v -1\.0 -1\.0 1\.0/);

    console.log(`  ✔ 3D Asset Export verification passed: GLB (${glbBytes.length} bytes), OBJ (${objText.length} bytes).`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
