interface XmlElement {
  attributes: Record<string, string>;
  children: XmlElement[];
  name: string;
  text: string;
}

type TiledJsonObject = Record<string, unknown>;

function decodeXml(value: string): string {
  return value.replace(/&(?:#(\d+)|#x([0-9A-Fa-f]+)|amp|apos|gt|lt|quot);/g, (entity, decimal: string, hexadecimal: string) => {
    if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
    if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
    const named: Record<string, string> = { "&amp;": "&", "&apos;": "'", "&gt;": ">", "&lt;": "<", "&quot;": '"' };
    return named[entity] ?? entity;
  });
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const matcher = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let match: RegExpExecArray | null;
  let consumed = "";
  while ((match = matcher.exec(source))) {
    attributes[match[1]] = decodeXml(match[2] ?? match[3] ?? "");
    consumed += source.slice(consumed.length, match.index).trim();
    consumed += match[0];
  }
  const remaining = source.replace(matcher, "").trim();
  if (remaining) throw new Error(`Unsupported XML attribute syntax: ${remaining}`);
  return attributes;
}

function parseXml(source: string): XmlElement {
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw new Error("Tiled XML with document types or entities is not supported");
  const document: XmlElement = { attributes: {}, children: [], name: "#document", text: "" };
  const stack = [document];
  const tokens = source.match(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<\/[A-Za-z_][^>]*>|<[A-Za-z_][^>]*>|[^<]+/g) ?? [];
  if (tokens.join("") !== source) throw new Error("Tiled XML contains unsupported markup");
  for (const token of tokens) {
    if (token.startsWith("<!--") || token.startsWith("<?")) continue;
    if (token.startsWith("<![CDATA[")) {
      stack.at(-1)!.text += token.slice(9, -3);
      continue;
    }
    if (token.startsWith("</")) {
      const name = token.slice(2, -1).trim();
      const closed = stack.pop();
      if (!closed || closed.name !== name) throw new Error(`Mismatched Tiled XML closing tag '${name}'`);
      continue;
    }
    if (token.startsWith("<")) {
      const selfClosing = token.endsWith("/>");
      const body = token.slice(1, selfClosing ? -2 : -1).trim();
      const separator = body.search(/\s/);
      const name = separator < 0 ? body : body.slice(0, separator);
      const attributeSource = separator < 0 ? "" : body.slice(separator + 1);
      const element: XmlElement = { attributes: parseAttributes(attributeSource), children: [], name, text: "" };
      stack.at(-1)!.children.push(element);
      if (!selfClosing) stack.push(element);
      continue;
    }
    stack.at(-1)!.text += decodeXml(token);
  }
  if (stack.length !== 1) throw new Error(`Unclosed Tiled XML tag '${stack.at(-1)?.name}'`);
  if (document.children.length !== 1) throw new Error("Tiled XML must contain exactly one root element");
  return document.children[0];
}

function child(element: XmlElement, name: string): XmlElement | undefined {
  return element.children.find((entry) => entry.name === name);
}

function numberAttribute(element: XmlElement, name: string, fallback?: number): number | undefined {
  const value = element.attributes[name];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Tiled XML ${element.name}.${name} must be numeric`);
  return parsed;
}

function booleanAttribute(element: XmlElement, name: string, fallback?: boolean): boolean | undefined {
  const value = element.attributes[name];
  if (value === undefined) return fallback;
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  throw new Error(`Tiled XML ${element.name}.${name} must be boolean`);
}

function layerFromXml(element: XmlElement): TiledJsonObject {
  const typeByName: Record<string, string> = { layer: "tilelayer", objectgroup: "objectgroup", imagelayer: "imagelayer", group: "group" };
  const result: TiledJsonObject = {
    id: numberAttribute(element, "id", 0),
    name: element.attributes.name ?? element.name,
    type: typeByName[element.name] ?? element.name,
    visible: booleanAttribute(element, "visible", true),
    opacity: numberAttribute(element, "opacity", 1),
    x: numberAttribute(element, "x", 0),
    y: numberAttribute(element, "y", 0),
    offsetx: numberAttribute(element, "offsetx", 0),
    offsety: numberAttribute(element, "offsety", 0)
  };
  if (element.name !== "layer") return result;
  result.width = numberAttribute(element, "width");
  result.height = numberAttribute(element, "height");
  const data = child(element, "data");
  if (!data) throw new Error(`Tiled XML layer '${String(result.name)}' is missing its data element`);
  const encoding = data.attributes.encoding;
  if (encoding !== "csv") {
    result.encoding = encoding ?? "xml";
    result.compression = data.attributes.compression;
    result.data = data.text.trim();
    return result;
  }
  if (data.attributes.compression) throw new Error(`Tiled XML layer '${String(result.name)}' uses unsupported compression`);
  result.data = data.text
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => Number(value));
  return result;
}

function mapFromXml(root: XmlElement): TiledJsonObject {
  return {
    type: "map",
    version: root.attributes.version,
    tiledversion: root.attributes.tiledversion,
    orientation: root.attributes.orientation,
    renderorder: root.attributes.renderorder,
    width: numberAttribute(root, "width"),
    height: numberAttribute(root, "height"),
    tilewidth: numberAttribute(root, "tilewidth"),
    tileheight: numberAttribute(root, "tileheight"),
    infinite: booleanAttribute(root, "infinite", false),
    tilesets: root.children
      .filter((entry) => entry.name === "tileset")
      .map((entry) => ({ firstgid: numberAttribute(entry, "firstgid"), source: entry.attributes.source })),
    layers: root.children.filter((entry) => ["layer", "objectgroup", "imagelayer", "group"].includes(entry.name)).map(layerFromXml)
  };
}

function tilesetFromXml(root: XmlElement): TiledJsonObject {
  const image = child(root, "image");
  const tileOffset = child(root, "tileoffset");
  return {
    type: "tileset",
    version: root.attributes.version,
    tiledversion: root.attributes.tiledversion,
    name: root.attributes.name,
    tilewidth: numberAttribute(root, "tilewidth"),
    tileheight: numberAttribute(root, "tileheight"),
    tilecount: numberAttribute(root, "tilecount"),
    columns: numberAttribute(root, "columns"),
    margin: numberAttribute(root, "margin", 0),
    spacing: numberAttribute(root, "spacing", 0),
    image: image?.attributes.source,
    imagewidth: image ? numberAttribute(image, "width") : undefined,
    imageheight: image ? numberAttribute(image, "height") : undefined,
    tileoffset: tileOffset ? { x: numberAttribute(tileOffset, "x", 0), y: numberAttribute(tileOffset, "y", 0) } : undefined,
    tiles: root.children
      .filter((entry) => entry.name === "tile")
      .map((entry) => ({
        id: numberAttribute(entry, "id"),
        animation: child(entry, "animation") ? [] : undefined,
        image: child(entry, "image")?.attributes.source
      }))
  };
}

export function parseTiledXml(source: string): TiledJsonObject {
  const root = parseXml(source);
  if (root.name === "map") return mapFromXml(root);
  if (root.name === "tileset") return tilesetFromXml(root);
  throw new Error(`Expected a Tiled map or tileset XML document, received '${root.name}'`);
}

function escapeXml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (character) => {
    const encoded: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
    return encoded[character];
  });
}

function attributes(values: Record<string, unknown>): string {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => ` ${name}="${escapeXml(typeof value === "boolean" ? (value ? 1 : 0) : value)}"`)
    .join("");
}

export function renderTiledMapXml(raw: TiledJsonObject): string {
  const mapAttributes = attributes({
    version: raw.version,
    tiledversion: raw.tiledversion,
    orientation: raw.orientation,
    renderorder: raw.renderorder,
    width: raw.width,
    height: raw.height,
    tilewidth: raw.tilewidth,
    tileheight: raw.tileheight,
    infinite: raw.infinite
  });
  const tilesets = (raw.tilesets as TiledJsonObject[]).map(
    (tileset) => ` <tileset${attributes({ firstgid: tileset.firstgid, source: tileset.source })}/>`
  );
  const width = Number(raw.width);
  const layers = (raw.layers as TiledJsonObject[]).map((layer) => {
    const data = layer.data as number[];
    const rows = Array.from({ length: Number(layer.height) }, (_, row) => data.slice(row * width, (row + 1) * width).join(","));
    return [
      ` <layer${attributes({
        id: layer.id,
        name: layer.name,
        width: layer.width,
        height: layer.height,
        visible: layer.visible,
        opacity: layer.opacity,
        x: layer.x,
        y: layer.y,
        offsetx: layer.offsetx,
        offsety: layer.offsety
      })}>`,
      '  <data encoding="csv">',
      rows.join(",\n"),
      "</data>",
      " </layer>"
    ].join("\n");
  });
  return ['<?xml version="1.0" encoding="UTF-8"?>', `<map${mapAttributes}>`, ...tilesets, ...layers, "</map>", ""].join("\n");
}

export function renderTiledTilesetXml(raw: TiledJsonObject): string {
  const rootAttributes = attributes({
    version: raw.version,
    tiledversion: raw.tiledversion,
    name: raw.name,
    tilewidth: raw.tilewidth,
    tileheight: raw.tileheight,
    tilecount: raw.tilecount,
    columns: raw.columns,
    margin: raw.margin,
    spacing: raw.spacing
  });
  const children: string[] = [];
  if (raw.tileoffset && typeof raw.tileoffset === "object") {
    const offset = raw.tileoffset as TiledJsonObject;
    children.push(` <tileoffset${attributes({ x: offset.x, y: offset.y })}/>`);
  }
  children.push(` <image${attributes({ source: raw.image, width: raw.imagewidth, height: raw.imageheight })}/>`);
  return ['<?xml version="1.0" encoding="UTF-8"?>', `<tileset${rootAttributes}>`, ...children, "</tileset>", ""].join("\n");
}
