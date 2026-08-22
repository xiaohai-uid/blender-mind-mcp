import assert from "node:assert/strict";
import { BpyGenerator } from "../../src/core/domain/bpy_generator.ts";

export async function runBpyGeneratorTests() {
  console.log("▶ [L1-Unit] Testing BpyGenerator code synthesis...");

  // Test 1: Clean scene python syntax
  const cleanCode = BpyGenerator.generateCleanScene();
  assert.match(cleanCode, /bpy\.ops\.object\.delete/);

  // Test 2: Primitive generation
  const cubeCode = BpyGenerator.generateCreatePrimitive("cube", "HeroCube", {
    location: [0, 0, 1],
    size: 3.5
  });
  assert.match(cubeCode, /primitive_cube_add\(size=3\.5, location=\(0, 0, 1\)/);
  assert.match(cubeCode, /obj\.name = "HeroCube"/);

  // Test 3: Modifier generation
  const bevelCode = BpyGenerator.generateApplyModifier("HeroCube", "bevel", {
    width: 0.25,
    segments: 5
  });
  assert.match(bevelCode, /type='BEVEL'/);
  assert.match(bevelCode, /mod\.width = 0\.25/);
  assert.match(bevelCode, /mod\.segments = 5/);

  // Test 4: PBR Material generation
  const matCode = BpyGenerator.generatePBRMaterial("HeroCube", {
    name: "GoldMetal",
    baseColor: [1.0, 0.84, 0.0, 1.0],
    metallic: 1.0,
    roughness: 0.15
  });
  assert.match(matCode, /BSDF_PRINCIPLED/);
  assert.match(matCode, /inputs\['Metallic'\]\.default_value = 1/);
  assert.match(matCode, /inputs\['Roughness'\]\.default_value = 0\.15/);

  // Test 5: GLTF export generation
  const exportCode = BpyGenerator.generateExport("glb", "C:/assets/hero.glb");
  assert.match(exportCode, /bpy\.ops\.export_scene\.gltf/);
  assert.match(exportCode, /export_format='GLB'/);

  // Test 6: Lighting generation
  const lightCode = BpyGenerator.generateLighting("KeySun", "SUN", {
    energy: 5000,
    color: [1.0, 0.95, 0.8]
  });
  assert.match(lightCode, /bpy\.data\.lights\.new\(name="KeySun", type='SUN'\)/);
  assert.match(lightCode, /light_data\.energy = 5000/);

  // Test 7: Camera generation with target tracking
  const camCode = BpyGenerator.generateCamera("MainCam", {
    location: [10, -10, 8],
    lookAt: [0, 0, 1],
    focalLength: 85
  });
  assert.match(camCode, /cam_data\.lens = 85/);
  assert.match(camCode, /to_track_quat\('-Z', 'Y'\)/);

  console.log("  ✔ BpyGenerator code synthesis passed (7 assertions).");
}

