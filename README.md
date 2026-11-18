# Blender-Mind-MCP (Production AI 3D Modeling & Blender Bridge)

A production-grade Model Context Protocol (MCP) server and Blender Addon ecosystem for automated 3D modeling, procedural asset generation, shader authoring, and multimodal viewport inspection.

---

## 🏗️ Prior Art & Architectural Inspiration

This project incorporates architectural lessons and benchmarks from leading GitHub Blender AI projects (such as `ahujasid/blender-mcp` and `djeada/blender-mcp-server`):

1. **Thread-Safe Main-Thread Dispatching**: Blender’s Python C-API (`bpy`) is not thread-safe. As discovered in community issue audits, executing `bpy` calls inside raw socket listener threads triggers memory corruptions and segmentation faults. Our Blender Addon uses a thread-safe `queue.Queue` coupled with `bpy.app.timers` to ensure all scene modifications execute strictly in Blender’s main render/GUI loop.
2. **Undo Step Isolation**: Every AI code execution is bracketed with `bpy.ops.ed.undo_push()`, enabling seamless `Ctrl+Z` rollbacks inside Blender.
3. **Multimodal Viewport Capture**: Uses offscreen OpenGL rendering (`bpy.ops.render.opengl`) to return Base64-encoded PNG screenshots of the 3D viewport directly to multimodal vision models.
4. **Hexagonal Architecture (Ports & Adapters)**: Decouples pure 3D geometry generation from physical drivers, supporting both Live Socket connections (`127.0.0.1:9876`), headless CLI batching (`blender -b`), and offline procedural glTF binary simulation.

---

## 📦 Project Structure

```
blender-mind-mcp/
├── addon/
│   └── blender_mcp_addon.py       # Full Blender 3.x/4.x Addon (UI Sidebar Panel, Socket Server, Viewport Capture)
├── src/
│   ├── index.ts                   # stdio JSON-RPC MCP Server entry point
│   ├── bridge/
│   │   └── socket_client.ts       # Robust TCP Socket Client with reconnect & timeout handling
│   ├── core/
│   │   └── domain/
│   │       ├── types.ts           # 3D Domain Types (Scene, Mesh, Material, Modifier, Transform)
│   │       ├── scene.ts           # Pure in-memory 3D scene graph & polygon math
│   │       └── bpy_generator.ts   # Modern Blender 4.x/3.x Python code synthesizer
│   ├── ports/
│   │   └── driver.port.ts         # BlenderDriverPort interface specification
│   ├── adapters/
│   │   ├── live_socket.adapter.ts # Live Socket Adapter (talks to active Blender GUI)
│   │   ├── blender_cli.adapter.ts # Headless CLI Adapter (talks to blender.exe)
│   │   └── mock_geometry.adapter.ts # Offline Simulation Adapter (glTF & OBJ binary synthesis)
│   └── tools/
│       └── index.ts               # 10 MCP Tools registry & dispatcher
├── tests/
│   ├── unit/                      # L1: Domain math & Python code generation
│   ├── contract/                  # L2: MCP tool schemas & argument contracts
│   ├── integration/               # L3: Binary glTF headers & TCP Socket Bridge
│   └── run_tests.ts               # Complete Truth Ladder test runner
├── package.json
└── tsconfig.json
```

---

## 🚀 Quick Start

### 1. Install Addon in Blender
1. Open Blender (3.6+ or 4.x).
2. Go to **Edit > Preferences > Add-ons > Install...** (or the Install from Disk arrow in 4.2+).
3. Select `addon/blender_mcp_addon.py`.
4. Enable **Development: Blender MCP Bridge**.
5. In the 3D Viewport, press `N` to open the sidebar, click the **Blender MCP** tab, and click **Start MCP Server**.

### 2. Configure MCP Client (Antigravity / Claude / Codex)
Clone the repository, then run `npm test` from its root with Node.js 24. For the client configuration below, replace the example path with the absolute path to `src/index.ts` in your clone. On Windows, `Resolve-Path src/index.ts` prints it.

Add to your project or global MCP configuration (`.mcp.json`):

```json
{
  "mcpServers": {
    "blender": {
      "command": "node",
      "args": [
        "--disable-warning=ExperimentalWarning",
        "--experimental-strip-types",
        "/absolute/path/to/blender-mind-mcp/src/index.ts"
      ]
    }
  }
}
```

---

With the add-on running, ask your MCP client to call `blender_inspect_scene` and list the objects. Compare the names with the Outliner in the open Blender file before asking it to edit the scene.

## 🛠️ 10 Core MCP Tools

| Tool Name | Description | Key Capabilities |
| :--- | :--- | :--- |
| `blender_create_primitive` | Create procedural 3D mesh | `cube`, `sphere`, `cylinder`, `torus`, `plane`, `cone`, `monkey` |
| `blender_apply_modifier` | Attach procedural modifiers | `subsurf`, `bevel`, `boolean`, `mirror`, `array`, `solidify` |
| `blender_procedural_material` | PBR Principled BSDF shader | `base_color`, `metallic`, `roughness`, `transmission` (glass), `emission` |
| `blender_setup_lighting` | Position & tune light sources | `SUN`, `POINT`, `SPOT`, `AREA` (wattage, radius, color tint) |
| `blender_setup_camera` | Camera framing & lens | `location`, `look_at` tracking, `focal_length` in mm |
| `blender_capture_viewport` | Visual viewport snapshot | Returns Base64 PNG image directly to multimodal LLMs |
| `blender_export_asset` | 3D model baking & export | `.glb`, `.gltf`, `.obj`, `.stl`, `.fbx` |
| `blender_inspect_scene` | Topology & scene tree inspection | Hierarchical object list, polycount, vertex count, modifiers |
| `blender_execute_bpy` | Raw parameter Python execution | Sandboxed execution with stdout/stderr capture |
| `blender_health` | System diagnostics | Reports active driver, port status, and Blender build |

---

## 🧪 Truth Ladder Verification

```bash
npm test
```

Executes all 6 test suites across the 4-level Truth Ladder:
- **L1 Unit**: 100% pure domain modeling & Python code synthesizer AST checks.
- **L2 Contract**: Schema definitions and dispatch verification for all 10 tools.
- **L3 Integration**: Binary glTF v2 Header (`0x46546C67`) & OBJ structure validation.
- **L3 Integration**: Live TCP Socket Client-Server loopback test on `127.0.0.1:9899`.
- **L4 E2E**: Live stdio JSON-RPC pipe roundtrip.
