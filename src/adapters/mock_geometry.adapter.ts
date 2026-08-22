import type { BlenderDriverPort } from "../ports/driver.port.ts";
import { ModelingScene } from "../core/domain/scene.ts";
import type {
  PrimitiveType,
  ModifierType,
  PBRMaterial,
  SceneInspection,
  ExportResult,
  DriverHealth,
  ExportFormat,
  Vector3
} from "../core/domain/types.ts";
import * as fs from "node:fs/promises";
import * as path from "node:path";

export class MockGeometryAdapter implements BlenderDriverPort {
  private scene: ModelingScene;

  constructor() {
    this.scene = new ModelingScene();
  }

  public async createPrimitive(
    type: PrimitiveType,
    name: string,
    options?: {
      location?: Vector3;
      rotation?: Vector3;
      scale?: Vector3;
      size?: number;
    }
  ): Promise<{ name: string; polyCount: number; vertexCount: number }> {
    const obj = this.scene.createPrimitive(type, name, options);
    return {
      name: obj.name,
      polyCount: obj.polyCount,
      vertexCount: obj.vertexCount
    };
  }

  public async applyModifier(
    objectName: string,
    modifierType: ModifierType,
    params: Record<string, unknown>
  ): Promise<{ name: string; modifierType: ModifierType }> {
    const mod = this.scene.applyModifier(objectName, modifierType, params);
    return {
      name: mod.name,
      modifierType: mod.type
    };
  }

  public async assignMaterial(
    objectName: string,
    material: PBRMaterial
  ): Promise<{ objectName: string; materialName: string }> {
    this.scene.addMaterial(material);
    this.scene.assignMaterial(objectName, material.name);
    return {
      objectName,
      materialName: material.name
    };
  }

  public async inspectScene(): Promise<SceneInspection> {
    return this.scene.inspect("Offline Geometry Simulation Driver");
  }

  public async executeScript(
    pythonScript: string
  ): Promise<{ stdout: string; stderr: string; success: boolean }> {
    // Check for syntax issues or keywords
    if (pythonScript.includes("raise ValueError")) {
      return {
        stdout: "",
        stderr: "Simulated Python Exception: ValueError in bpy script",
        success: false
      };
    }
    return {
      stdout: "Mock execution successful: 1 object modified in simulated bpy context.",
      stderr: "",
      success: true
    };
  }

  public async exportScene(
    format: ExportFormat,
    outputPath: string
  ): Promise<ExportResult> {
    const inspection = this.scene.inspect();
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    let content: Buffer;
    if (format === "glb") {
      // Create minimal valid GLB v2 header (12-byte header + JSON chunk)
      const gltfJson = JSON.stringify({
        asset: { version: "2.0", generator: "Blender-Mind-MCP Simulation" },
        scenes: [{ nodes: [0] }],
        nodes: [{ name: "SimulatedScene" }]
      });
      const jsonBuffer = Buffer.from(gltfJson, "utf8");
      // Align to 4 bytes
      const padding = (4 - (jsonBuffer.length % 4)) % 4;
      const paddedJson = Buffer.concat([jsonBuffer, Buffer.alloc(padding, 0x20)]);

      const header = Buffer.alloc(12);
      header.writeUInt32LE(0x46546c67, 0); // "glTF"
      header.writeUInt32LE(2, 4);          // version 2
      const totalLength = 12 + 8 + paddedJson.length;
      header.writeUInt32LE(totalLength, 8);

      const chunkHeader = Buffer.alloc(8);
      chunkHeader.writeUInt32LE(paddedJson.length, 0);
      chunkHeader.writeUInt32LE(0x4e4f534a, 4); // "JSON"

      content = Buffer.concat([header, chunkHeader, paddedJson]);
    } else {
      // Standard text OBJ / STL
      const lines = [
        `# Blender-Mind-MCP Offline Export`,
        `# Objects: ${inspection.objects.length}, Polygons: ${inspection.totalPolyCount}`,
        `o SimulatedMesh`,
        `v -1.0 -1.0 1.0`,
        `v 1.0 -1.0 1.0`,
        `v -1.0 1.0 1.0`,
        `v 1.0 1.0 1.0`,
        `f 1 2 4 3`
      ];
      content = Buffer.from(lines.join("\n"), "utf8");
    }

    await fs.writeFile(outputPath, content);

    return {
      success: true,
      filePath: outputPath,
      fileSizeBytes: content.length,
      format,
      polyCount: inspection.totalPolyCount
    };
  }

  public async setupLighting(
    name: string,
    type: "SUN" | "POINT" | "SPOT" | "AREA",
    options?: {
      location?: Vector3;
      energy?: number;
      color?: [number, number, number];
      size?: number;
    }
  ): Promise<{ name: string; type: string }> {
    return { name, type };
  }

  public async setupCamera(
    name: string,
    options?: {
      location?: Vector3;
      lookAt?: Vector3;
      focalLength?: number;
    }
  ): Promise<{ name: string; focalLength: number }> {
    return { name, focalLength: options?.focalLength ?? 50.0 };
  }

  public async captureViewport(): Promise<{ image_base64: string; mime_type: string; width: number; height: number }> {
    // Minimal valid 1x1 transparent PNG binary in base64
    const mockPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    return {
      image_base64: mockPngBase64,
      mime_type: "image/png",
      width: 1920,
      height: 1080
    };
  }

  public async getHealth(): Promise<DriverHealth> {
    return {
      status: "healthy",
      driverType: "mock_simulation",
      message: "Offline Geometry & Procedural Simulation Driver active."
    };
  }
}

