import type {
  PrimitiveType,
  ModifierType,
  PBRMaterial,
  Vector3,
  Vector4
} from "./types.ts";

export class BpyGenerator {
  /**
   * Generates Python code for resetting the default scene (deleting default cube/light/camera if requested)
   */
  public static generateCleanScene(): string {
    return `import bpy

# Clean existing mesh objects
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
`;
  }

  /**
   * Generates Python code to add a 3D primitive in Blender
   */
  public static generateCreatePrimitive(
    type: PrimitiveType,
    name: string,
    options?: {
      location?: Vector3;
      rotation?: Vector3;
      scale?: Vector3;
      size?: number;
    }
  ): string {
    const loc = options?.location ?? [0, 0, 0];
    const rot = options?.rotation ?? [0, 0, 0];
    const scale = options?.scale ?? [1, 1, 1];
    const size = options?.size ?? 2.0;

    let opCall = "";
    switch (type) {
      case "cube":
        opCall = `bpy.ops.mesh.primitive_cube_add(size=${size}, location=(${loc.join(", ")}), rotation=(${rot.join(", ")}), scale=(${scale.join(", ")}))`;
        break;
      case "sphere":
        opCall = `bpy.ops.mesh.primitive_uv_sphere_add(radius=${size / 2}, location=(${loc.join(", ")}), rotation=(${rot.join(", ")}), scale=(${scale.join(", ")}))`;
        break;
      case "cylinder":
        opCall = `bpy.ops.mesh.primitive_cylinder_add(radius=${size / 2}, depth=${size}, location=(${loc.join(", ")}), rotation=(${rot.join(", ")}), scale=(${scale.join(", ")}))`;
        break;
      case "torus":
        opCall = `bpy.ops.mesh.primitive_torus_add(major_radius=${size / 2}, minor_radius=${size / 8}, location=(${loc.join(", ")}), rotation=(${rot.join(", ")}), scale=(${scale.join(", ")}))`;
        break;
      case "plane":
        opCall = `bpy.ops.mesh.primitive_plane_add(size=${size}, location=(${loc.join(", ")}), rotation=(${rot.join(", ")}), scale=(${scale.join(", ")}))`;
        break;
      case "cone":
        opCall = `bpy.ops.mesh.primitive_cone_add(radius1=${size / 2}, depth=${size}, location=(${loc.join(", ")}), rotation=(${rot.join(", ")}), scale=(${scale.join(", ")}))`;
        break;
      case "monkey":
        opCall = `bpy.ops.mesh.primitive_monkey_add(size=${size}, location=(${loc.join(", ")}), rotation=(${rot.join(", ")}), scale=(${scale.join(", ")}))`;
        break;
    }

    return `
${opCall}
obj = bpy.context.active_object
if obj:
    obj.name = "${name}"
`;
  }

  /**
   * Generates Python code to apply a modifier
   */
  public static generateApplyModifier(
    objectName: string,
    modifierType: ModifierType,
    params: Record<string, unknown>
  ): string {
    const modName = `${modifierType}_mod`;
    let typeEnum = "";
    let propSetters = "";

    switch (modifierType) {
      case "subsurf":
        typeEnum = "SUBSURF";
        const levels = params.levels ?? 1;
        const renderLevels = params.renderLevels ?? levels;
        propSetters = `
mod.levels = ${levels}
mod.render_levels = ${renderLevels}
`;
        break;
      case "bevel":
        typeEnum = "BEVEL";
        const width = params.width ?? 0.1;
        const segments = params.segments ?? 3;
        propSetters = `
mod.width = ${width}
mod.segments = ${segments}
`;
        break;
      case "solidify":
        typeEnum = "SOLIDIFY";
        const thickness = params.thickness ?? 0.05;
        propSetters = `
mod.thickness = ${thickness}
`;
        break;
      case "mirror":
        typeEnum = "MIRROR";
        const axis = (params.useAxis as [boolean, boolean, boolean]) ?? [true, false, false];
        propSetters = `
mod.use_axis = (${axis[0] ? "True" : "False"}, ${axis[1] ? "True" : "False"}, ${axis[2] ? "True" : "False"})
`;
        break;
      case "array":
        typeEnum = "ARRAY";
        const count = params.count ?? 2;
        const offset = (params.relativeOffset as Vector3) ?? [1, 0, 0];
        propSetters = `
mod.count = ${count}
mod.relative_offset_displace = (${offset.join(", ")})
`;
        break;
      default:
        typeEnum = modifierType.toUpperCase();
        break;
    }

    return `
target_obj = bpy.data.objects.get("${objectName}")
if not target_obj:
    raise ValueError('Object "${objectName}" does not exist in Blender scene')

mod = target_obj.modifiers.new(name="${modName}", type='${typeEnum}')
${propSetters}
`;
  }

  /**
   * Generates Python code to create and assign a Principled BSDF material
   */
  public static generatePBRMaterial(
    objectName: string,
    material: PBRMaterial
  ): string {
    const color = material.baseColor;
    const metallic = material.metallic ?? 0.0;
    const roughness = material.roughness ?? 0.5;
    const transmission = material.transmission ?? 0.0;
    const emission = material.emission ?? [0, 0, 0];
    const emissionStrength = material.emissionStrength ?? 1.0;

    return `
target_obj = bpy.data.objects.get("${objectName}")
if not target_obj:
    raise ValueError('Object "${objectName}" does not exist in Blender scene')

mat = bpy.data.materials.get("${material.name}")
if not mat:
    mat = bpy.data.materials.new(name="${material.name}")
    mat.use_nodes = True

nodes = mat.node_tree.nodes
principled = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)

if principled:
    # Set Base Color
    principled.inputs['Base Color'].default_value = (${color.join(", ")})
    # Set Metallic
    principled.inputs['Metallic'].default_value = ${metallic}
    # Set Roughness
    principled.inputs['Roughness'].default_value = ${roughness}
    
    # Transmission (Glass) if supported
    if 'Transmission Weight' in principled.inputs:
        principled.inputs['Transmission Weight'].default_value = ${transmission}
    elif 'Transmission' in principled.inputs:
        principled.inputs['Transmission'].default_value = ${transmission}
        
    # Emission
    if 'Emission Color' in principled.inputs:
        principled.inputs['Emission Color'].default_value = (${emission[0]}, ${emission[1]}, ${emission[2]}, 1.0)
    if 'Emission Strength' in principled.inputs:
        principled.inputs['Emission Strength'].default_value = ${emissionStrength}

if target_obj.data.materials:
    target_obj.data.materials[0] = mat
else:
    target_obj.data.materials.append(mat)
`;
  }

  /**
   * Generates Python code to export the active scene
   */
  public static generateExport(
    format: "glb" | "gltf" | "obj" | "stl" | "fbx",
    outputPath: string
  ): string {
    const sanitizedPath = outputPath.replace(/\\/g, "/");
    switch (format) {
      case "glb":
      case "gltf":
        return `
bpy.ops.export_scene.gltf(
    filepath="${sanitizedPath}",
    export_format='GLB' if "${format}" == 'glb' else 'GLTF_SEPARATE',
    export_apply=True
)
`;
      case "obj":
        return `
try:
    bpy.ops.wm.obj_export(filepath="${sanitizedPath}", export_selected_objects=False)
except Exception:
    bpy.ops.export_scene.obj(filepath="${sanitizedPath}", use_selection=False)
`;
      case "stl":
        return `
try:
    bpy.ops.wm.stl_export(filepath="${sanitizedPath}")
except Exception:
    bpy.ops.export_mesh.stl(filepath="${sanitizedPath}")
`;
      case "fbx":
        return `
bpy.ops.export_scene.fbx(filepath="${sanitizedPath}", use_selection=False)
`;
    }
  }

  /**
   * Generates Python code to create or configure a Light source
   */
  public static generateLighting(
    name: string,
    type: "SUN" | "POINT" | "SPOT" | "AREA",
    options?: {
      location?: Vector3;
      energy?: number;
      color?: [number, number, number];
      size?: number;
    }
  ): string {
    const loc = options?.location ?? [4, -4, 5];
    const energy = options?.energy ?? 1000.0;
    const color = options?.color ?? [1.0, 1.0, 1.0];
    const size = options?.size ?? 1.0;

    return `
light_data = bpy.data.lights.get("${name}")
if not light_data:
    light_data = bpy.data.lights.new(name="${name}", type='${type}')

light_data.energy = ${energy}
light_data.color = (${color.join(", ")})
if hasattr(light_data, 'size'):
    light_data.size = ${size}

light_obj = bpy.data.objects.get("${name}")
if not light_obj:
    light_obj = bpy.data.objects.new(name="${name}", object_data=light_data)
    bpy.context.collection.objects.link(light_obj)

light_obj.location = (${loc.join(", ")})
`;
  }

  /**
   * Generates Python code to position and configure the Camera with look-at targeting
   */
  public static generateCamera(
    name: string,
    options?: {
      location?: Vector3;
      lookAt?: Vector3;
      focalLength?: number;
    }
  ): string {
    const loc = options?.location ?? [7.3, -6.9, 4.9];
    const target = options?.lookAt ?? [0, 0, 0];
    const focal = options?.focalLength ?? 50.0;

    return `
cam_data = bpy.data.cameras.get("${name}")
if not cam_data:
    cam_data = bpy.data.cameras.new(name="${name}")

cam_data.lens = ${focal}

cam_obj = bpy.data.objects.get("${name}")
if not cam_obj:
    cam_obj = bpy.data.objects.new(name="${name}", object_data=cam_data)
    bpy.context.collection.objects.link(cam_obj)

cam_obj.location = (${loc.join(", ")})

# Point camera to target
import mathutils
direction = mathutils.Vector((${target.join(", ")})) - mathutils.Vector((${loc.join(", ")}))
rot_quat = direction.to_track_quat('-Z', 'Y')
cam_obj.rotation_euler = rot_quat.to_euler()

bpy.context.scene.camera = cam_obj
`;
  }
}

