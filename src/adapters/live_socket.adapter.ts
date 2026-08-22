import type { BlenderDriverPort } from "../ports/driver.port.ts";
import { BlenderSocketClient } from "../bridge/socket_client.ts";
import { BpyGenerator } from "../core/domain/bpy_generator.ts";
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

export class LiveSocketAdapter implements BlenderDriverPort {
  private client: BlenderSocketClient;

  constructor(host = "127.0.0.1", port = 9876) {
    this.client = new BlenderSocketClient(host, port);
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
    const py = BpyGenerator.generateCreatePrimitive(type, name, options);
    const res = await this.client.executeCode(py);
    if (!res.success) {
      throw new Error(`Failed to create primitive via live socket: ${res.stderr}`);
    }
    return { name, polyCount: 0, vertexCount: 0 };
  }

  public async applyModifier(
    objectName: string,
    modifierType: ModifierType,
    params: Record<string, unknown>
  ): Promise<{ name: string; modifierType: ModifierType }> {
    const py = BpyGenerator.generateApplyModifier(objectName, modifierType, params);
    const res = await this.client.executeCode(py);
    if (!res.success) {
      throw new Error(`Failed to apply modifier via live socket: ${res.stderr}`);
    }
    return { name: `${modifierType}_mod`, modifierType };
  }

  public async assignMaterial(
    objectName: string,
    material: PBRMaterial
  ): Promise<{ objectName: string; materialName: string }> {
    const py = BpyGenerator.generatePBRMaterial(objectName, material);
    const res = await this.client.executeCode(py);
    if (!res.success) {
      throw new Error(`Failed to assign material via live socket: ${res.stderr}`);
    }
    return { objectName, materialName: material.name };
  }

  public async inspectScene(): Promise<SceneInspection> {
    const data = await this.client.getSceneHierarchy();
    return {
      engine: "Blender Live GUI (Interactive Bridge)",
      blenderVersion: data.blender_version,
      objects: data.objects.map((o: any) => ({
        name: o.name,
        location: o.location,
        rotation: o.rotation,
        scale: o.scale,
        polyCount: o.poly_count || 0,
        vertexCount: o.vertex_count || 0,
        materials: o.materials || [],
        modifiers: o.modifiers || []
      })),
      totalPolyCount: data.total_polygons || 0,
      totalVertexCount: data.total_vertices || 0,
      activeObjectName: data.active_object
    };
  }

  public async executeScript(
    pythonScript: string
  ): Promise<{ stdout: string; stderr: string; success: boolean }> {
    return this.client.executeCode(pythonScript);
  }

  public async exportScene(
    format: ExportFormat,
    outputPath: string
  ): Promise<ExportResult> {
    const res = await this.client.exportAsset(format, outputPath);
    if (!res.success) {
      throw new Error(`Failed to export model via live socket.`);
    }

    const stats = await fs.stat(outputPath);
    return {
      success: true,
      filePath: outputPath,
      fileSizeBytes: stats.size,
      format,
      polyCount: 0
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
    const py = BpyGenerator.generateLighting(name, type, options);
    const res = await this.client.executeCode(py);
    if (!res.success) {
      throw new Error(`Failed to configure lighting via live socket: ${res.stderr}`);
    }
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
    const py = BpyGenerator.generateCamera(name, options);
    const res = await this.client.executeCode(py);
    if (!res.success) {
      throw new Error(`Failed to configure camera via live socket: ${res.stderr}`);
    }
    return { name, focalLength: options?.focalLength ?? 50.0 };
  }

  public async captureViewport(): Promise<{ image_base64: string; mime_type: string; width: number; height: number }> {
    const res = await this.client.captureViewport();
    if (!res.success) {
      throw new Error("Failed to capture viewport snapshot.");
    }
    return {
      image_base64: res.image_base64,
      mime_type: res.mime_type,
      width: res.width,
      height: res.height
    };
  }

  public async getHealth(): Promise<DriverHealth> {
    try {
      const pingRes = await this.client.ping();
      return {
        status: "healthy",
        driverType: "blender_socket",
        blenderVersion: pingRes.blender_version,
        message: `Live Blender GUI connected on 127.0.0.1:9876 (Active Scene: ${pingRes.active_scene}).`
      };
    } catch (e: any) {
      return {
        status: "offline",
        driverType: "blender_socket",
        message: "Blender Live Socket offline (Addon not running or Blender closed)."
      };
    }
  }
}
