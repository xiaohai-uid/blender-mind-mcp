export type Vector3 = [number, number, number];
export type Vector4 = [number, number, number, number];

export type PrimitiveType =
  | "cube"
  | "sphere"
  | "cylinder"
  | "torus"
  | "plane"
  | "cone"
  | "monkey";

export type ModifierType =
  | "subsurf"
  | "bevel"
  | "boolean"
  | "mirror"
  | "array"
  | "solidify"
  | "wireframe";

export interface SubsurfParams {
  levels: number;
  renderLevels?: number;
  quality?: number;
}

export interface BevelParams {
  width: number;
  segments: number;
  profile?: number;
}

export interface BooleanParams {
  operation: "DIFFERENCE" | "UNION" | "INTERSECT";
  targetObject: string;
}

export interface MirrorParams {
  useAxis: [boolean, boolean, boolean];
}

export interface ArrayParams {
  count: number;
  relativeOffset: Vector3;
}

export interface SolidifyParams {
  thickness: number;
  offset?: number;
}

export type ModifierParams =
  | SubsurfParams
  | BevelParams
  | BooleanParams
  | MirrorParams
  | ArrayParams
  | SolidifyParams
  | Record<string, unknown>;

export interface ModifierSpec {
  name: string;
  type: ModifierType;
  params: ModifierParams;
}

export interface PBRMaterial {
  name: string;
  baseColor: Vector4; // [r, g, b, a], 0.0 - 1.0
  metallic: number;   // 0.0 - 1.0
  roughness: number;  // 0.0 - 1.0
  transmission?: number; // 0.0 - 1.0 (Glass)
  emission?: Vector3;    // [r, g, b]
  emissionStrength?: number;
}

export interface SceneObject {
  name: string;
  primitiveType?: PrimitiveType;
  location: Vector3;
  rotation: Vector3; // Euler angles in radians
  scale: Vector3;
  polyCount: number;
  vertexCount: number;
  materials: string[];
  modifiers: ModifierSpec[];
}

export interface SceneInspection {
  engine: string;
  blenderVersion?: string;
  objects: SceneObject[];
  totalPolyCount: number;
  totalVertexCount: number;
  activeObjectName?: string;
}

export type ExportFormat = "glb" | "gltf" | "obj" | "stl" | "fbx";

export interface ExportResult {
  success: boolean;
  filePath: string;
  fileSizeBytes: number;
  format: ExportFormat;
  polyCount: number;
}

export interface DriverHealth {
  status: "healthy" | "degraded" | "offline";
  driverType: "blender_cli" | "blender_socket" | "mock_simulation";
  blenderPath?: string;
  blenderVersion?: string;
  message: string;
}
