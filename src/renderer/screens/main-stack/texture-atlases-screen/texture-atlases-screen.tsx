import { type FC, useEffect, useMemo, useState } from "react";
import { Eye, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/layout/section";
import { AtlasEntryRow } from "@/screens/main-stack/texture-atlases-screen/atlas-entry-row";
import { ImportAtlasImageButton } from "@/screens/main-stack/texture-atlases-screen/import-atlas-image-button";
import useListAssetsQuery from "@/hooks/use-list-assets-query";
import textureAtlasService from "@/services/texture-atlas-service";
import type { Asset, TextureAtlasBuildResult, TextureAtlasDocument, TextureAtlasEntry } from "../../../../shared/schemas";
import { AssetCategoryEnum } from "../../../../shared/types";

const supportedImageExtensions = new Set(["png", "jpg", "jpeg", "webp", "gif", "tif", "tiff"]);

function createDocument(id = "UI_ATLAS", name = "UI Atlas"): TextureAtlasDocument {
  return {
    schemaVersion: 1,
    id,
    name,
    settings: {
      maxPageWidth: 2048,
      maxPageHeight: 2048,
      padding: 2,
      extrusion: 1,
      powerOfTwo: true,
      allowRotation: false
    },
    entries: []
  };
}

function createEntry(assetId: string): TextureAtlasEntry {
  return {
    assetId,
    resizeMode: "native",
    outputWidth: null,
    outputHeight: null,
    scale: 1,
    trim: false,
    tintMode: "none",
    tint: "#FFFFFFFF",
    pivotX: 0.5,
    pivotY: 0.5
  };
}

export const TextureAtlasesScreen: FC = () => {
  const { assets } = useListAssetsQuery();
  const [documents, setDocuments] = useState<TextureAtlasDocument[]>([]);
  const [document, setDocument] = useState<TextureAtlasDocument>(() => createDocument());
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [buildResult, setBuildResult] = useState<TextureAtlasBuildResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const imageAssets = useMemo(
    () =>
      assets.filter(
        (asset) =>
          (asset.category === AssetCategoryEnum.image || asset.category === AssetCategoryEnum.ui) &&
          supportedImageExtensions.has(asset.extension.toLowerCase())
      ),
    [assets]
  );
  const assetsById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const availableAssets = imageAssets.filter((asset) => !document.entries.some((entry) => entry.assetId === asset.id));

  useEffect(() => {
    let active = true;
    textureAtlasService
      .list()
      .then((savedDocuments) => {
        if (active) {
          setDocuments(savedDocuments);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : String(reason));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function clearFeedback(): void {
    setMessage("");
    setError("");
  }

  function selectDocument(id: string): void {
    clearFeedback();
    setBuildResult(null);
    const selected = documents.find((candidate) => candidate.id === id);
    setDocument(selected ? structuredClone(selected) : createDocument());
  }

  function updateEntry(index: number, entry: TextureAtlasEntry): void {
    setDocument((current) => ({
      ...current,
      entries: current.entries.map((candidate, candidateIndex) => (candidateIndex === index ? entry : candidate))
    }));
    setBuildResult(null);
  }

  function removeEntry(index: number): void {
    setDocument((current) => ({
      ...current,
      entries: current.entries.filter((_, candidateIndex) => candidateIndex !== index)
    }));
    setBuildResult(null);
  }

  function addEntry(): void {
    const assetId = selectedAssetId || availableAssets[0]?.id;
    if (!assetId) {
      return;
    }
    setDocument((current) => ({ ...current, entries: [...current.entries, createEntry(assetId)] }));
    setSelectedAssetId("");
    setBuildResult(null);
  }

  function addImportedAsset(asset: Asset): void {
    clearFeedback();
    setDocument((current) => {
      if (current.entries.some((entry) => entry.assetId === asset.id)) {
        return current;
      }
      return { ...current, entries: [...current.entries, createEntry(asset.id)] };
    });
    setMessage("Imported and added " + asset.id + ".");
    setBuildResult(null);
  }

  async function saveDocument(): Promise<void> {
    clearFeedback();
    setIsBusy(true);
    try {
      const saved = await textureAtlasService.save(document);
      const next = [...documents.filter((candidate) => candidate.id !== saved.id), saved].sort((left, right) =>
        left.id.localeCompare(right.id)
      );
      setDocuments(next);
      setDocument(structuredClone(saved));
      setMessage(`Saved ${saved.id}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsBusy(false);
    }
  }

  async function buildDocument(): Promise<void> {
    clearFeedback();
    setIsBusy(true);
    try {
      const result = await textureAtlasService.build(document);
      setBuildResult(result);
      setMessage(`Built ${result.pages.length} page(s) with ${Object.keys(result.sprites).length} sprite(s).`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsBusy(false);
    }
  }

  async function deleteDocument(): Promise<void> {
    clearFeedback();
    setIsBusy(true);
    try {
      await textureAtlasService.delete(document.id);
      const next = documents.filter((candidate) => candidate.id !== document.id);
      setDocuments(next);
      setDocument(next[0] ? structuredClone(next[0]) : createDocument());
      setBuildResult(null);
      setMessage("Deleted atlas.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setIsBusy(false);
    }
  }

  const actions = [
    <Button disabled={isBusy} key="new" onClick={() => selectDocument("")} type="button" variant="outline">
      <Plus />
      New
    </Button>,
    <Button disabled={isBusy} key="save" onClick={saveDocument} type="button" variant="outline">
      <Save />
      Save
    </Button>,
    <Button disabled={isBusy || document.entries.length === 0} key="preview" onClick={buildDocument} type="button">
      <Eye />
      Build preview
    </Button>
  ];

  return (
    <Section
      actions={actions}
      copy="Deterministic sprite atlases with stable asset slugs, explicit sizing, and runtime-ready metadata."
      title="Texture Atlases"
    >
      <div className="grid grid-cols-[20rem_minmax(0,1fr)] gap-4 max-[1120px]:grid-cols-1">
        <aside className="grid content-start gap-4 rounded-md border border-border bg-card p-4">
          <label className="grid gap-1 text-xs font-medium">
            Saved atlas
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              disabled={isBusy}
              onChange={(event) => selectDocument(event.target.value)}
              value={documents.some((candidate) => candidate.id === document.id) ? document.id : ""}
            >
              <option value="">Unsaved atlas</option>
              {documents.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.id}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Stable atlas slug
            <Input
              disabled={isBusy || documents.some((candidate) => candidate.id === document.id)}
              onChange={(event) => setDocument((current) => ({ ...current, id: event.target.value }))}
              value={document.id}
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Display name
            <Input
              disabled={isBusy}
              onChange={(event) => setDocument((current) => ({ ...current, name: event.target.value }))}
              value={document.name}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-xs font-medium">
              Page width
              <Input
                disabled={isBusy}
                min={64}
                onChange={(event) =>
                  setDocument((current) => ({
                    ...current,
                    settings: { ...current.settings, maxPageWidth: Number(event.target.value) }
                  }))
                }
                type="number"
                value={document.settings.maxPageWidth}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Page height
              <Input
                disabled={isBusy}
                min={64}
                onChange={(event) =>
                  setDocument((current) => ({
                    ...current,
                    settings: { ...current.settings, maxPageHeight: Number(event.target.value) }
                  }))
                }
                type="number"
                value={document.settings.maxPageHeight}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Padding
              <Input
                disabled={isBusy}
                min={0}
                onChange={(event) =>
                  setDocument((current) => ({ ...current, settings: { ...current.settings, padding: Number(event.target.value) } }))
                }
                type="number"
                value={document.settings.padding}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium">
              Extrusion
              <Input
                disabled={isBusy}
                min={0}
                onChange={(event) =>
                  setDocument((current) => ({ ...current, settings: { ...current.settings, extrusion: Number(event.target.value) } }))
                }
                type="number"
                value={document.settings.extrusion}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs font-medium">
            <input
              checked={document.settings.powerOfTwo}
              disabled={isBusy}
              onChange={(event) =>
                setDocument((current) => ({ ...current, settings: { ...current.settings, powerOfTwo: event.target.checked } }))
              }
              type="checkbox"
            />
            Power-of-two pages
          </label>
          {documents.some((candidate) => candidate.id === document.id) && (
            <Button disabled={isBusy} onClick={deleteDocument} type="button" variant="destructive">
              <Trash2 />
              Delete atlas
            </Button>
          )}
        </aside>

        <div className="grid min-w-0 content-start gap-4">
          <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-card p-3">
            <label className="grid min-w-0 flex-1 gap-1 text-xs font-medium">
              Managed image asset
              <select
                className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                disabled={isBusy || availableAssets.length === 0}
                onChange={(event) => setSelectedAssetId(event.target.value)}
                value={selectedAssetId}
              >
                <option value="">Select asset</option>
                {availableAssets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.id}
                  </option>
                ))}
              </select>
            </label>
            <Button disabled={isBusy || availableAssets.length === 0} onClick={addEntry} type="button" variant="outline">
              <Plus />
              Add sprite
            </Button>
            <ImportAtlasImageButton disabled={isBusy} onError={setError} onImported={addImportedAsset} />
          </div>

          {document.entries.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Import an image here or add an existing managed image asset.
            </div>
          )}
          {document.entries.map((entry, index) => (
            <AtlasEntryRow
              asset={assetsById.get(entry.assetId)}
              disabled={isBusy}
              entry={entry}
              key={entry.assetId}
              onChange={(nextEntry) => updateEntry(index, nextEntry)}
              onRemove={() => removeEntry(index)}
            />
          ))}
        </div>
      </div>

      {(message || error) && <p className={error ? "text-sm text-destructive" : "text-sm text-emerald-600"}>{error || message}</p>}

      {buildResult && (
        <div className="grid gap-4">
          <h2 className="text-sm font-semibold">Preview</h2>
          <div className="grid grid-cols-2 gap-4 max-[1120px]:grid-cols-1">
            {buildResult.pages.map((page) => (
              <figure
                className="grid gap-2 rounded-md border border-border bg-[linear-gradient(45deg,#222_25%,transparent_25%),linear-gradient(-45deg,#222_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#222_75%),linear-gradient(-45deg,transparent_75%,#222_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0px] p-3"
                key={page.file}
              >
                <img alt={page.file} className="max-h-[32rem] max-w-full object-contain [image-rendering:pixelated]" src={page.dataUrl} />
                <figcaption className="text-xs text-muted-foreground">
                  {page.file} - {page.width} x {page.height}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
};
