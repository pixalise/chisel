import { type LocalizationDocument, localizationKeyConstant, localizationPlaceholdersForKey } from "./localization";
import { LUAU_HEADER, luauValue, type LuauExportFile } from "./luau-serialization";
import type { Asset } from "./schemas";

function tokens(text: string): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = [];
  const pattern =
    /\{(int|float|string):([a-z][a-z0-9_]*)\}|<style:([A-Z0-9_]+)>|<\/style>|<tooltip:([A-Z0-9_]+)>|<\/tooltip>|<icon:([A-Z0-9_]+)\s*\/>|<br\s*\/>/g;
  let offset = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > offset) result.push({ kind: "text", text: text.slice(offset, match.index) });
    if (match[1]) result.push({ kind: "placeholder", type: match[1], name: match[2] });
    else if (match[3]) result.push({ kind: "styleStart", slug: match[3] });
    else if (match[4]) result.push({ kind: "tooltipStart", slug: match[4] });
    else if (match[5]) result.push({ kind: "icon", slug: match[5] });
    else if (match[0] === "</style>") result.push({ kind: "styleEnd" });
    else if (match[0] === "</tooltip>") result.push({ kind: "tooltipEnd" });
    else result.push({ kind: "text", text: "\n" });
    offset = match.index + match[0].length;
  }
  if (offset < text.length) result.push({ kind: "text", text: text.slice(offset) });
  return result;
}

export function renderRobloxLocalization(document: LocalizationDocument, assets: Asset[], root: string): LuauExportFile {
  const ids = Object.fromEntries(document.keys.map((key, index) => [localizationKeyConstant(key.path), index + 1]));
  const translations = Object.fromEntries(
    document.locales.map((locale) => [locale, document.keys.map((key) => tokens(key.values[locale]))])
  );
  const iconAssets = Object.fromEntries(
    assets.map((asset, index) => [asset.id, { id: index + 1, contentId: `rbxassetid://${asset.robloxAssetId}` }])
  );
  const styles = Object.fromEntries(document.styles.map((style) => [style.slug, style]));
  const keyIds = new Map(document.keys.map((key, index) => [key.path, index + 1]));
  const tooltips = Object.fromEntries(
    document.tooltips.map((tooltip) => [
      tooltip.slug,
      {
        titleId: keyIds.get(tooltip.titleKey),
        descriptionId: keyIds.get(tooltip.descriptionKey),
        icon: tooltip.iconAssetId ? iconAssets[tooltip.iconAssetId] : false
      }
    ])
  );
  return {
    path: `${root}/localization.luau`,
    content: `${LUAU_HEADER}
export type Segment = { [string]: any }
-- Authored literals are validated by Chisel; widen frozen records for dynamic ID access.
local translations: { [string]: { { Segment } } } = ${luauValue(translations)} :: any
local icons: { [string]: Segment } = ${luauValue(iconAssets)} :: any
local styles: { [string]: Segment } = ${luauValue(styles)} :: any
local tooltips: { [string]: Segment } = ${luauValue(tooltips)} :: any
local names: { string } = ${luauValue(document.keys.map((key) => key.path))} :: any
local placeholders = ${luauValue(document.keys.map((key) => localizationPlaceholdersForKey(key, document.defaultLocale)))}
local localization = {
    ID = ${luauValue({ INVALID: 0, ...ids })},
    KEYS = names,
    DEFAULT_LOCALE = ${luauValue(document.defaultLocale)},
    LOCALES = ${luauValue(document.locales)},
    STYLES = styles,
    TOOLTIPS = tooltips,
    PLACEHOLDERS = placeholders,
}

local function checkedId(id: number): number
    assert(id % 1 == 0 and id >= 1 and id <= #names, "Invalid Chisel translation ID")
    return id
end

local function escape(text: string): string
    local result = text:gsub("&", "&amp;"):gsub("<", "&lt;"):gsub(">", "&gt;"):gsub('"', "&quot;"):gsub("'", "&apos;")
    return result
end

function localization.segments(id: number, locale: string?, parameters: { [string]: any }?): { Segment }
    local index = checkedId(id)
    local language = locale or localization.DEFAULT_LOCALE
    local entries = translations[language]
    assert(entries, "Unknown Chisel locale: " .. language)
    local args = parameters or {}
    local result: { Segment } = {}
    for _, token in entries[index] do
        local segment: Segment = table.clone(token)
        if token.kind == "placeholder" then
            local value = args[token.name]
            if token.type == "string" then
                assert(type(value) == "string", "Expected string placeholder: " .. token.name)
            else
                assert(type(value) == "number" and value == value and math.abs(value) < math.huge, "Expected finite number: " .. token.name)
                if token.type == "int" then assert(value % 1 == 0, "Expected integer: " .. token.name) end
            end
            segment = { kind = "text", text = tostring(value) }
        elseif token.kind == "icon" then
            local icon = icons[token.slug]
            assert(icon, "Unknown Chisel icon: " .. token.slug)
            segment.assetId = icon.id
            segment.contentId = icon.contentId
        elseif token.kind == "styleStart" then
            segment.style = assert(styles[token.slug], "Unknown Chisel style: " .. token.slug)
        elseif token.kind == "tooltipStart" then
            segment.tooltip = assert(tooltips[token.slug], "Unknown Chisel tooltip: " .. token.slug)
        end
        table.freeze(segment)
        table.insert(result, segment)
    end
    return table.freeze(result)
end

function localization.text(id: number, locale: string?, parameters: { [string]: any }?): string
    local result: { string } = {}
    for _, segment in localization.segments(id, locale, parameters) do
        assert(segment.kind ~= "icon", "Inline icons require localization.segments() and an ImageLabel")
        if segment.kind == "text" then table.insert(result, segment.text) end
    end
    return table.concat(result)
end

function localization.richText(id: number, locale: string?, parameters: { [string]: any }?): string
    local result: { string } = {}
    local closes: { string } = {}
    for _, segment in localization.segments(id, locale, parameters) do
        assert(segment.kind ~= "icon", "Inline icons require localization.segments() and an ImageLabel")
        if segment.kind == "text" then
            table.insert(result, escape(segment.text))
        elseif segment.kind == "styleStart" then
            local style = segment.style
            local closing = ""
            if style.color then table.insert(result, '<font color="' .. style.color .. '">'); closing = "</font>" .. closing end
            if style.bold then table.insert(result, "<b>"); closing = "</b>" .. closing end
            if style.italic then table.insert(result, "<i>"); closing = "</i>" .. closing end
            if style.underline then table.insert(result, "<u>"); closing = "</u>" .. closing end
            table.insert(closes, closing)
        elseif segment.kind == "styleEnd" then
            local closing = assert(table.remove(closes), "Unmatched Chisel style close")
            table.insert(result, closing)
        end
    end
    assert(#closes == 0, "Unclosed Chisel style")
    return table.concat(result)
end

return table.freeze(localization)
`
  };
}
