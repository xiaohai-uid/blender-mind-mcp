import type {
  PrimitiveType,
  ModifierSpec,
  ModifierType,
  PBRMaterial,
  SceneObject,
  SceneInspection,
  Vector3,
  Vector4
} from "./types.ts";

export class ModelingScene {
  private objects: Map<string, SceneObject> = new Map();
  private materials: Map<string, PBRMaterial> = new Map();
  private activeObjectName?: string;

  constructor() {}

  public createPrimitive(
    type: PrimitiveType,
    name: string,
    options?: {
      location?: Vector3;
      rotation?: Vector3;
      scale?: Vector3;
      size?: number;
    }
  ): SceneObject {
    if (this.objects.has(name)) {
      throw new Error(`Object with name "${name}" already exists in scene.`);
    }

    const location: Vector3 = options?.location ?? [0, 0, 0];
    const rotation: Vector3 = options?.rotation ?? [0, 0, 0];
    const scale: Vector3 = options?.scale ?? [1, 1, 1];

    let basePoly = 6;
    let baseVerts = 8;
    if (type === "sphere") {
      basePoly = 512;
      baseVerts = 482;
    } else if (type === "cylinder") {
      basePoly = 64;
      baseVerts = 66;
    } else if (type === "torus") {
      basePoly = 576;
      baseVerts = 576;
    } else if (type === "plane") {
      basePoly = 1;
      baseVerts = 4;
    } else if (type === "cone") {
      basePoly = 33;
      baseVerts = 33;
    } else if (type === "monkey") {
      basePoly = 500;
      baseVerts = 507;
    }

    const obj: SceneObject = {
      name,
      primitiveType: type,
      location,
      rotation,
      scale,
      polyCount: basePoly,
      vertexCount: baseVerts,
      materials: [],
      modifiers: []
    };

    this.objects.set(name, obj);
    this.activeObjectName = name;
    return obj;
  }

  public getObject(name: string): SceneObject | undefined {
    return this.objects.get(name);
  }

  public listObjects(): SceneObject[] {
    return Array.from(this.objects.values());
  }

  public applyModifier(
    objectName: string,
    modifierType: ModifierType,
    params: Record<string, unknown>
  ): ModifierSpec {
    const obj = this.objects.get(objectName);
    if (!obj) {
      throw new Error(`Object "${objectName}" not found.`);
    }

    const modName = `${modifierType}_${obj.modifiers.length + 1}`;
    const modSpec: ModifierSpec = {
      name: modName,
      type: modifierType,
      params
    };

    // Calculate simulated poly count impact
    if (modifierType === "subsurf") {
      const levels = (params.levels as number) || 1;
      obj.polyCount *= Math.pow(4, levels);
      obj.vertexCount *= Math.pow(4, levels);
    } else if (modifierType === "array") {
      const count = (params.count as number) || 2;
      obj.polyCount *= count;
      obj.vertexCount *= count;
    } else if (modifierType === "solidify") {
      obj.polyCount *= 2;
      obj.vertexCount *= 2;
    }

    obj.modifiers.push(modSpec);
    return modSpec;
  }

  public addMaterial(material: PBRMaterial): PBRMaterial {
    this.materials.set(material.name, material);
    return material;
  }

  public assignMaterial(objectName: string, materialName: string): void {
    const obj = this.objects.get(objectName);
    if (!obj) {
      throw new Error(`Object "${objectName}" not found.`);
    }
    if (!this.materials.has(materialName)) {
      throw new Error(`Material "${materialName}" not registered.`);
    }
    if (!obj.materials.includes(materialName)) {
      obj.materials.push(materialName);
    }
  }

  public inspect(engineName: string = "Simulated Engine"): SceneInspection {
    let totalPoly = 0;
    let totalVert = 0;
    for (const obj of this.objects.values()) {
      totalPoly += obj.polyCount;
      totalVert += obj.vertexCount;
    }

    return {
      engine: engineName,
      objects: this.listObjects(),
      totalPolyCount: totalPoly,
      totalVertexCount: totalVert,
      activeObjectName: this.activeObjectName
    };
  }

  public clear(): void {
    this.objects.clear();
    this.materials.clear();
    this.activeObjectName = undefined;
  }
}
