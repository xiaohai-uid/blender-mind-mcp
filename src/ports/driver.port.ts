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

export interface BlenderDriverPort {
  createPrimitive(
    type: PrimitiveType,
    name: string,
    options?: {
      location?: Vector3;
      rotation?: Vector3;
      scale?: Vector3;
      size?: number;
    }
  ): Promise<{ name: string; polyCount: number; vertexCount: number }>;

  applyModifier(
    objectName: string,
    modifierType: ModifierType,
    params: Record<string, unknown>
  ): Promise<{ name: string; modifierType: ModifierType }>;

  assignMaterial(
    objectName: string,
    material: PBRMaterial
  ): Promise<{ objectName: string; materialName: string }>;

  inspectScene(): Promise<SceneInspection>;

  executeScript(pythonScript: string): Promise<{ stdout: string; stderr: string; success: boolean }>;

  exportScene(
    format: ExportFormat,
    outputPath: string
  ): Promise<ExportResult>;

  setupLighting(
    name: string,
    type: "SUN" | "POINT" | "SPOT" | "AREA",
    options?: {
      location?: Vector3;
      energy?: number;
      color?: [number, number, number];
      size?: number;
    }
  ): Promise<{ name: string; type: string }>;

  setupCamera(
    name: string,
    options?: {
      location?: Vector3;
      lookAt?: Vector3;
      focalLength?: number;
    }
  ): Promise<{ name: string; focalLength: number }>;

  captureViewport?(): Promise<{ image_base64: string; mime_type: string; width: number; height: number }>;

  getHealth(): Promise<DriverHealth>;
}

