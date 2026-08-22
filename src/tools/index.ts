import type { BlenderDriverPort } from "../ports/driver.port.ts";
import { MockGeometryAdapter } from "../adapters/mock_geometry.adapter.ts";
import { BlenderCliAdapter } from "../adapters/blender_cli.adapter.ts";
import { LiveSocketAdapter } from "../adapters/live_socket.adapter.ts";
import type {
  PrimitiveType,
  ModifierType,
  PBRMaterial,
  ExportFormat,
  Vector3,
  Vector4
} from "../core/domain/types.ts";
import * as path from "node:path";

export class BlenderToolRegistry {
  private activeDriver: BlenderDriverPort;
  private socketDriver: LiveSocketAdapter;
  private cliDriver: BlenderCliAdapter;
  private mockDriver: MockGeometryAdapter;

  constructor() {
    this.socketDriver = new LiveSocketAdapter();
    this.cliDriver = new BlenderCliAdapter();
    this.mockDriver = new MockGeometryAdapter();
    // Default to mock/simulation unless Live Socket or CLI is active
    this.activeDriver = this.mockDriver;
  }

  public async autoDetectDriver(): Promise<BlenderDriverPort> {
    // 1. Try Live Socket (Interactive GUI)
    const socketHealth = await this.socketDriver.getHealth();
    if (socketHealth.status === "healthy") {
      this.activeDriver = this.socketDriver;
      return this.activeDriver;
    }

    // 2. Try CLI (Headless Binary)
    const cliHealth = await this.cliDriver.getHealth();
    if (cliHealth.status === "healthy") {
      this.activeDriver = this.cliDriver;
      return this.activeDriver;
    }

    // 3. Fallback to Offline Procedural Simulation
    this.activeDriver = this.mockDriver;
    return this.activeDriver;
  }

  public setDriver(driver: BlenderDriverPort) {
    this.activeDriver = driver;
  }

  public getActiveDriver(): BlenderDriverPort {
    return this.activeDriver;
  }

  public getToolDefinitions() {
    return [
      {
        name: "blender_create_primitive",
        description: "Creates a 3D procedural primitive (cube, sphere, cylinder, torus, plane, cone, monkey) in the 3D scene.",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["cube", "sphere", "cylinder", "torus", "plane", "cone", "monkey"],
              description: "Type of primitive mesh to create"
            },
            name: {
              type: "string",
              description: "Unique name for the object in the scene"
            },
            location: {
              type: "array",
              items: { type: "number" },
              description: "[x, y, z] location coordinates"
            },
            rotation: {
              type: "array",
              items: { type: "number" },
              description: "[rx, ry, rz] Euler rotation angles in radians"
            },
            scale: {
              type: "array",
              items: { type: "number" },
              description: "[sx, sy, sz] scale multipliers"
            },
            size: {
              type: "number",
              description: "Overall dimension size (default: 2.0)"
            }
          },
          required: ["type", "name"]
        }
      },
      {
        name: "blender_apply_modifier",
        description: "Attaches and configures a procedural modifier (subsurf, bevel, boolean, mirror, array, solidify) to a target mesh object.",
        inputSchema: {
          type: "object",
          properties: {
            object_name: {
              type: "string",
              description: "Name of the target mesh object"
            },
            modifier_type: {
              type: "string",
              enum: ["subsurf", "bevel", "boolean", "mirror", "array", "solidify"],
              description: "Type of geometric modifier"
            },
            params: {
              type: "object",
              description: "Modifier configuration parameters (e.g. { levels: 2 }, { width: 0.1, segments: 3 }, { thickness: 0.05 })"
            }
          },
          required: ["object_name", "modifier_type"]
        }
      },
      {
        name: "blender_procedural_material",
        description: "Creates a physically-based (PBR Principled BSDF) material with metallic, roughness, glass transmission, or emission, and binds it to an object.",
        inputSchema: {
          type: "object",
          properties: {
            object_name: {
              type: "string",
              description: "Target object to receive the material"
            },
            material_name: {
              type: "string",
              description: "Name of the material"
            },
            base_color: {
              type: "array",
              items: { type: "number" },
              description: "RGBA base color values (0.0 to 1.0), e.g. [0.8, 0.2, 0.2, 1.0] for red"
            },
            metallic: {
              type: "number",
              description: "Metallic factor (0.0 for dielectric/plastic, 1.0 for metal)"
            },
            roughness: {
              type: "number",
              description: "Surface roughness (0.0 for glossy mirror, 1.0 for diffuse matte)"
            },
            transmission: {
              type: "number",
              description: "Transmission weight for glass/transparent materials (0.0 to 1.0)"
            },
            emission: {
              type: "array",
              items: { type: "number" },
              description: "RGB emission color [r, g, b]"
            },
            emission_strength: {
              type: "number",
              description: "Emission multiplier strength"
            }
          },
          required: ["object_name", "material_name", "base_color"]
        }
      },
      {
        name: "blender_setup_lighting",
        description: "Creates or configures a 3D light source (Sun, Point, Spot, Area) in the scene with position, energy wattage, and color tint.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the light" },
            type: {
              type: "string",
              enum: ["SUN", "POINT", "SPOT", "AREA"],
              description: "Light emission type"
            },
            location: {
              type: "array",
              items: { type: "number" },
              description: "[x, y, z] light position"
            },
            energy: { type: "number", description: "Light intensity/wattage (default: 1000W)" },
            color: {
              type: "array",
              items: { type: "number" },
              description: "[r, g, b] color tint"
            },
            size: { type: "number", description: "Light radius/area dimension" }
          },
          required: ["name", "type"]
        }
      },
      {
        name: "blender_setup_camera",
        description: "Creates and positions the scene camera with look-at target tracking and focal length lens adjustments.",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the camera" },
            location: {
              type: "array",
              items: { type: "number" },
              description: "[x, y, z] camera placement coordinates"
            },
            look_at: {
              type: "array",
              items: { type: "number" },
              description: "[x, y, z] focus target coordinate to aim at"
            },
            focal_length: { type: "number", description: "Focal length in mm (default: 50mm)" }
          },
          required: ["name"]
        }
      },
      {
        name: "blender_capture_viewport",
        description: "Captures an instantaneous OpenGL screenshot of the 3D viewport and returns it as a Base64-encoded PNG image for multimodal visual inspection.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "blender_export_asset",
        description: "Bakes and exports the current 3D scene into standard 3D formats (.glb, .gltf, .obj, .stl, .fbx).",
        inputSchema: {
          type: "object",
          properties: {
            format: {
              type: "string",
              enum: ["glb", "gltf", "obj", "stl", "fbx"],
              description: "Target 3D file format"
            },
            output_path: {
              type: "string",
              description: "Absolute or relative file path for the exported asset"
            }
          },
          required: ["format", "output_path"]
        }
      },
      {
        name: "blender_inspect_scene",
        description: "Retrieves complete inspection metadata from the 3D scene, including all mesh objects, transform coordinates, polygon counts, vertex counts, materials, and modifier stacks.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "blender_execute_bpy",
        description: "Directly runs custom Blender Python (bpy) scripts with full error containment and return value capture.",
        inputSchema: {
          type: "object",
          properties: {
            code: {
              type: "string",
              description: "Python script utilizing the bpy API"
            }
          },
          required: ["code"]
        }
      },
      {
        name: "blender_health",
        description: "Reports connection status, detected Blender binary version, active simulation engine, and system readiness.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ];
  }

  public async handleToolCall(name: string, args: Record<string, any>): Promise<any> {
    switch (name) {
      case "blender_create_primitive": {
        const type = args.type as PrimitiveType;
        const objName = args.name as string;
        const options = {
          location: args.location as Vector3,
          rotation: args.rotation as Vector3,
          scale: args.scale as Vector3,
          size: args.size as number
        };
        const res = await this.activeDriver.createPrimitive(type, objName, options);
        return {
          content: [
            {
              type: "text",
              text: `Successfully created primitive "${type}" with name "${res.name}". Polycount: ${res.polyCount}, Vertices: ${res.vertexCount}`
            }
          ]
        };
      }

      case "blender_apply_modifier": {
        const objName = args.object_name as string;
        const modType = args.modifier_type as ModifierType;
        const params = (args.params as Record<string, unknown>) ?? {};
        const res = await this.activeDriver.applyModifier(objName, modType, params);
        return {
          content: [
            {
              type: "text",
              text: `Successfully attached modifier "${res.name}" (${res.modifierType}) to object "${objName}".`
            }
          ]
        };
      }

      case "blender_procedural_material": {
        const objName = args.object_name as string;
        const mat: PBRMaterial = {
          name: args.material_name as string,
          baseColor: args.base_color as Vector4,
          metallic: (args.metallic as number) ?? 0.0,
          roughness: (args.roughness as number) ?? 0.5,
          transmission: args.transmission as number,
          emission: args.emission as Vector3,
          emissionStrength: args.emission_strength as number
        };
        const res = await this.activeDriver.assignMaterial(objName, mat);
        return {
          content: [
            {
              type: "text",
              text: `Successfully assigned PBR material "${res.materialName}" to object "${res.objectName}".`
            }
          ]
        };
      }

      case "blender_setup_lighting": {
        const res = await this.activeDriver.setupLighting(
          args.name as string,
          args.type as any,
          {
            location: args.location as Vector3,
            energy: args.energy as number,
            color: args.color as [number, number, number],
            size: args.size as number
          }
        );
        return {
          content: [
            {
              type: "text",
              text: `Successfully configured ${res.type} light source "${res.name}".`
            }
          ]
        };
      }

      case "blender_setup_camera": {
        const res = await this.activeDriver.setupCamera(
          args.name as string,
          {
            location: args.location as Vector3,
            lookAt: args.look_at as Vector3,
            focalLength: args.focal_length as number
          }
        );
        return {
          content: [
            {
              type: "text",
              text: `Successfully positioned camera "${res.name}" (Focal length: ${res.focalLength}mm).`
            }
          ]
        };
      }

      case "blender_capture_viewport": {
        if (!this.activeDriver.captureViewport) {
          throw new Error("Viewport capture is not supported by the currently active driver.");
        }
        const res = await this.activeDriver.captureViewport();
        return {
          content: [
            {
              type: "image",
              data: res.image_base64,
              mimeType: res.mime_type
            },
            {
              type: "text",
              text: `Viewport snapshot captured (${res.width}x${res.height} ${res.mime_type}).`
            }
          ]
        };
      }

      case "blender_export_asset": {
        const format = args.format as ExportFormat;
        const outputPath = path.resolve(process.cwd(), args.output_path as string);
        const res = await this.activeDriver.exportScene(format, outputPath);
        return {
          content: [
            {
              type: "text",
              text: `Successfully exported 3D asset to "${res.filePath}" (${res.fileSizeBytes} bytes, format: ${res.format.toUpperCase()}, total polygons: ${res.polyCount}).`
            }
          ]
        };
      }

      case "blender_inspect_scene": {
        const inspection = await this.activeDriver.inspectScene();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(inspection, null, 2)
            }
          ]
        };
      }

      case "blender_execute_bpy": {
        const code = args.code as string;
        const res = await this.activeDriver.executeScript(code);
        return {
          content: [
            {
              type: "text",
              text: res.success
                ? `Execution succeeded.\nStdout:\n${res.stdout}`
                : `Execution failed.\nStderr:\n${res.stderr}\nStdout:\n${res.stdout}`
            }
          ],
          isError: !res.success
        };
      }

      case "blender_health": {
        const health = await this.activeDriver.getHealth();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(health, null, 2)
            }
          ]
        };
      }

      default:
        throw new Error(`Unknown tool "${name}"`);
    }
  }
}
