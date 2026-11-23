# Zora PBR texture packages (.zpbr)

ZPBR v1 packs the maps for opaque ship materials into two RGBA8 PNGs in one
`.zpbr` file. It replaces the restored GPPT format; its new magic prevents old
height/normal payloads from being interpreted with the new channel layout.
Readers accept ZPBR v1 only. Existing source maps must be repacked.

Tools → Material Packing takes five same-size, 8-bit PNGs: albedo, metallic,
normal, roughness and an emissive mask. It creates a managed `TERRAIN_TEXTURE`
asset at `.chisel/assets/TERRAIN_TEXTURE/<SLUG>.zpbr`. Source images are untouched;
duplicate slugs fail. Import and replacement also accept existing ZPBR packages.
The retained asset category is storage organization, not a terrain-only material.

## Channel layout

| Texture             | R (X)    | G (Y)     | B (Z)    | A (W)         | Runtime sampling       |
| ------------------- | -------- | --------- | -------- | ------------- | ---------------------- |
| T1: Albedo-metallic | Albedo R | Albedo G  | Albedo B | Metallic      | sRGB RGB, linear alpha |
| T2: Surface         | Normal X | Roughness | Normal Y | Emissive mask | Linear RGBA            |

Metallic, roughness and emissive-mask values come from their source PNG's red
channel. Grayscale maps work. Source alpha is discarded. Packing preserves
these bytes without gamma conversion, resampling or roughness inversion.
No texture stores height, opacity or ambient occlusion.

T2's **R/B texture channels** carry the normal vector's **X/Y components**.
Source normals must be unit tangent-space normals in the +Y (OpenGL/glTF)
convention with nonnegative Z. Negative-Z source normals are rejected because
the omitted component's sign cannot be recovered. No Y flip is applied.
The shader reconstructs Z; channel quantization can slightly change direction:

```glsl
vec2 normalXY = surface.rb * 2.0 - 1.0;
float normalZ = sqrt(max(0.0, 1.0 - dot(normalXY, normalXY)));
vec3 normalTS = normalize(vec3(normalXY, normalZ));
float roughness = surface.g;
vec3 emission = surface.a * glowTint;
```

The emissive mask controls where/how strongly the shader's uniform glow tint
appears. Glow color is universal for that shader setting, independent of albedo.
The mask contains no RGB emission color. `glowTint` is linear RGB and may include
HDR intensity. Its value belongs to the runtime material/shader configuration,
not the texture package. Zora's shader implementation is separate work.

The asset preview displays opaque albedo; metallicness is never shown as opacity.

## File layout

All header integers are unsigned 32-bit little-endian. PNG integers retain
PNG's normal big-endian representation.

| Offset | Size | Meaning                            |
| ------ | ---- | ---------------------------------- |
| 0      | 4    | ASCII `ZPBR`                       |
| 4      | 4    | Version: `1`                       |
| 8      | 4    | Width in pixels                    |
| 12     | 4    | Height in pixels                   |
| 16     | 4    | T1 PNG byte count: `A`             |
| 20     | 4    | T2 PNG byte count: `S`             |
| 24     | A    | Complete RGBA8 albedo-metallic PNG |
| 24 + A | S    | Complete RGBA8 surface PNG         |

File size is exactly `24 + A + S`. Both images match the positive header
dimensions. Readers reject unknown magic/versions, truncated/trailing data and
mismatched PNG headers. Import decodes both PNGs to reject corrupt compressed
data. Native image work runs in the existing Sharp worker.

The container provides lossless PNG storage; dropping normal Z is a separate,
intentional material encoding choice. There is no GPU compression or mip chain.
Mrak owns content authoring/packing; Zora's decoder and GPU upload are separate
work. Game settings remain game-owned.

## History

The initial implementation was recovered from Chisel's `texture-packing.ts` at
`0299fa0`, before deletion in `5de2b55` (earlier restoration: `daac11a`). GPPT v1
stored albedo-height and normal-roughness. ZPBR deliberately replaces that
contract rather than silently repurposing its channels or retaining a legacy loader.
