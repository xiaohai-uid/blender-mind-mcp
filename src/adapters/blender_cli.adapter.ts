import type { BlenderDriverPort } from "../ports/driver.port.ts";
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
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

const execFileAsync = promisify(execFile);

export class BlenderCliAdapter implements BlenderDriverPort {
  private blenderExecutable?: string;

  constructor(customPath?: string) {
    this.blenderExecutable = customPath || process.env.BLENDER_PATH;
  }

  public async findBlenderPath(): Promise<string | undefined> {
    if (this.blenderExecutable) return this.blenderExecutable;

    const candidatePaths = [
      "blender",
      "C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe",
      "C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe",
      "C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe",
      "C:\\Program Files\\Blender Foundation\\Blender 3.6\\blender.exe"
    ];

    for (const p of candidatePaths) {
      try {
        await execFileAsync(p, ["--version"]);
        this.blenderExecutable = p;
        return p;
      } catch {
        // try next
      }
    }
    return undefined;
  }

  public async executeScript(
    pythonScript: string
  ): Promise<{ stdout: string; stderr: string; success: boolean }> {
    const blender = await this.findBlenderPath();
    if (!blender) {
      throw new Error(
        "Blender executable not found on system. Please install Blender or set BLENDER_PATH environment variable."
      );
    }

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "blender-mcp-"));
    const scriptPath = path.join(tempDir, "execute.py");
    await fs.writeFile(scriptPath, pythonScript, "utf8");

    try {
      const { stdout, stderr } = await execFileAsync(blender, [
        "-b",
        "--python",
        scriptPath
      ]);
      return { stdout, stderr, success: true };
    } catch (err: any) {
      return {
        stdout: err.stdout ?? "",
        stderr: err.stderr ?? err.message,
        success: false
      };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
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
    const result = await this.executeScript(py);
    if (!result.success) {
      throw new Error(`Failed to create primitive in Blender: ${result.stderr}`);
    }
    return { name, polyCount: 0, vertexCount: 0 };
  }

  public async applyModifier(
    objectName: string,
    modifierType: ModifierType,
    params: Record<string, unknown>
  ): Promise<{ name: string; modifierType: ModifierType }> {
    const py = BpyGenerator.generateApplyModifier(objectName, modifierType, params);
    const result = await this.executeScript(py);
    if (!result.success) {
      throw new Error(`Failed to apply modifier in Blender: ${result.stderr}`);
    }
    return { name: `${modifierType}_mod`, modifierType };
  }

  public async assignMaterial(
    objectName: string,
    material: PBRMaterial
  ): Promise<{ objectName: string; materialName: string }> {
    const py = BpyGenerator.generatePBRMaterial(objectName, material);
    const result = await this.executeScript(py);
    if (!result.success) {
      throw new Error(`Failed to assign material in Blender: ${result.stderr}`);
    }
    return { objectName, materialName: material.name };
  }

  public async inspectScene(): Promise<SceneInspection> {
    const py = `
import bpy, json

objects_data = []
total_poly = 0
total_verts = 0

for obj in bpy.data.objects:
    if obj.type == 'MESH' and obj.data:
        poly_count = len(obj.data.polygons)
        vert_count = len(obj.data.vertices)
        total_poly += poly_count
        total_verts += vert_count
        objects_data.append({
            "name": obj.name,
            "location": list(obj.location),
            "rotation": list(obj.rotation_euler),
            "scale": list(obj.scale),
            "polyCount": poly_count,
            "vertexCount": vert_count,
            "materials": [m.name for m in obj.data.materials if m],
            "modifiers": [{"name": m.name, "type": m.type.lower(), "params": {}} for m in obj.modifiers]
        })

inspection = {
    "engine": "Blender Native CLI",
    "blenderVersion": bpy.app.version_string,
    "objects": objects_data,
    "totalPolyCount": total_poly,
    "totalVertexCount": total_verts,
    "activeObjectName": bpy.context.active_object.name if bpy.context.active_object else None
}

print("JSON_INSPECTION_START")
print(json.dumps(inspection))
print("JSON_INSPECTION_END")
`;
    const res = await this.executeScript(py);
    if (!res.success) {
      throw new Error(`Failed to inspect scene in Blender: ${res.stderr}`);
    }

    const match = res.stdout.match(/JSON_INSPECTION_START\r?\n([\s\S]*?)\r?\nJSON_INSPECTION_END/);
    if (!match) {
      throw new Error("Failed to parse inspection JSON from Blender output.");
    }
    return JSON.parse(match[1]);
  }

  public async exportScene(
    format: ExportFormat,
    outputPath: string
  ): Promise<ExportResult> {
    const py = BpyGenerator.generateExport(format, outputPath);
    const res = await this.executeScript(py);
    if (!res.success) {
      throw new Error(`Failed to export model in Blender: ${res.stderr}`);
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
    const res = await this.executeScript(py);
    if (!res.success) {
      throw new Error(`Failed to configure lighting in Blender: ${res.stderr}`);
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
    const res = await this.executeScript(py);
    if (!res.success) {
      throw new Error(`Failed to configure camera in Blender: ${res.stderr}`);
    }
    return { name, focalLength: options?.focalLength ?? 50.0 };
  }

  public async getHealth(): Promise<DriverHealth> {
    const p = await this.findBlenderPath();
    if (!p) {
      return {
        status: "offline",
        driverType: "blender_cli",
        message: "Blender binary not found on PATH or standard directories."
      };
    }

    try {
      const { stdout } = await execFileAsync(p, ["--version"]);
      return {
        status: "healthy",
        driverType: "blender_cli",
        blenderPath: p,
        blenderVersion: stdout.trim().split("\n")[0],
        message: "Blender CLI is responsive and available for headless jobs."
      };
    } catch (err: any) {
      return {
        status: "degraded",
        driverType: "blender_cli",
        blenderPath: p,
        message: `Blender found but returned error: ${err.message}`
      };
    }
  }
}
