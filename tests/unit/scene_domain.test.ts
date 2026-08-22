import assert from "node:assert/strict";
import { ModelingScene } from "../../src/core/domain/scene.ts";

export async function runSceneDomainTests() {
  console.log("▶ [L1-Unit] Testing ModelingScene domain logic...");

  const scene = new ModelingScene();

  // Test 1: Primitive creation
  const cube = scene.createPrimitive("cube", "TestCube", {
    location: [1, 2, 3],
    scale: [2, 2, 2]
  });
  assert.equal(cube.name, "TestCube");
  assert.equal(cube.polyCount, 6);
  assert.equal(cube.vertexCount, 8);
  assert.deepEqual(cube.location, [1, 2, 3]);

  // Test 2: Name duplication guard
  assert.throws(() => {
    scene.createPrimitive("sphere", "TestCube");
  }, /already exists/);

  // Test 3: Multiple primitives and inspection
  const sphere = scene.createPrimitive("sphere", "TestSphere");
  assert.equal(sphere.polyCount, 512);

  const inspectionBeforeMod = scene.inspect();
  assert.equal(inspectionBeforeMod.objects.length, 2);
  assert.equal(inspectionBeforeMod.totalPolyCount, 6 + 512);

  // Test 4: Modifier stack & polygon scaling
  const subsurf = scene.applyModifier("TestCube", "subsurf", { levels: 2 });
  assert.equal(subsurf.type, "subsurf");
  assert.equal(cube.modifiers.length, 1);
  // 6 * 4^2 = 96 polygons
  assert.equal(cube.polyCount, 96);

  // Test 5: PBR Material creation and assignment
  scene.addMaterial({
    name: "RedGloss",
    baseColor: [0.9, 0.1, 0.1, 1.0],
    metallic: 0.8,
    roughness: 0.2
  });
  scene.assignMaterial("TestCube", "RedGloss");
  assert.deepEqual(cube.materials, ["RedGloss"]);

  console.log("  ✔ ModelingScene domain tests passed (5 assertions).");
}
