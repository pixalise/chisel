import { type FC, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ControlledImageInput from "@/components/controls/controlled-image-input";
import ControlledInput from "@/components/controls/controlled-input";
import ControlledTextarea from "@/components/controls/controlled-textarea";
import ImagePreview from "@/components/image-preview";
import { Section } from "@/components/layout/section";
import PageHeader from "@/components/page-header";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import terrainService from "@/services/terrain-service";
import CacheUtils from "@/utils/cache-utils";
import { packTerrainTextureSchema, type PackTerrainTexture } from "../../../../../shared/schemas";

export const TexturePackingScreen: FC = () => {
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const form = useForm<Omit<PackTerrainTexture, "projectPath">>({
    defaultValues: {
      aoValue: 255,
      name: "",
      normalZChannel: "green",
      note: "",
      roughnessValue: 192
    },
    mode: "onChange",
    resolver: zodResolver(packTerrainTextureSchema.omit({ projectPath: true }))
  });
  const albedoPath = useWatch({ control: form.control, name: "albedo" });
  const heightPath = useWatch({ control: form.control, name: "height" });
  const normalPath = useWatch({ control: form.control, name: "normal" });
  const aoPath = useWatch({ control: form.control, name: "ao" });
  const roughnessPath = useWatch({ control: form.control, name: "roughness" });

  async function onSubmit(input: Omit<PackTerrainTexture, "projectPath">): Promise<void> {
    setIsSaving(true);
    setMessage("");
    try {
      const asset = await terrainService.packTerrainTexture(input);
      await CacheUtils.invalidateQueries([[HookKeysEnum.listAssetsQuery]]);
      setMessage(`Created ${asset.name}.gttp in the asset library.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create terrain texture.");
    } finally {
      setIsSaving(false);
    }
  }

  const canSave = form.formState.isValid && !isSaving;

  return (
    <section className="space-y-4">
      <PageHeader
        title="Texture Packer"
        description="Create one Graphite Terrain Texture package (.gttp) from terrain source maps and save it directly into the asset library."
      />

      <Section title="Terrain Texture" copy="GTTP stores packed base and surface PNG payloads in one engine-owned asset file.">
        <form className="grid gap-4" onSubmit={form.handleSubmit(onSubmit)}>
          <div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
            <ControlledInput control={form.control} disabled={isSaving} label="Name" name="name" />
            <ControlledTextarea
              control={form.control}
              disabled={isSaving}
              label="Note"
              name="note"
              placeholder="Optional usage notes for artists and generation rules."
              rows={1}
            />
          </div>

          <div className="grid grid-cols-3 gap-3 max-[1100px]:grid-cols-1">
            <ControlledImageInput control={form.control} label="Albedo" name="albedo" />
            <ControlledImageInput control={form.control} label="Height" name="height" />
            <ControlledImageInput control={form.control} label="Normal" name="normal" />
          </div>

          <div className="grid grid-cols-3 gap-2.5 max-[1100px]:grid-cols-1">
            <ImagePreview path={albedoPath} />
            <ImagePreview path={heightPath} />
            <ImagePreview path={normalPath} />
          </div>

          <div className="grid grid-cols-2 gap-3 max-[900px]:grid-cols-1">
            <ControlledImageInput control={form.control} label="AO optional" name="ao" />
            <ControlledImageInput control={form.control} label="Roughness optional" name="roughness" />
          </div>

          <div className="grid grid-cols-2 gap-2.5 max-[900px]:grid-cols-1">
            <ImagePreview path={aoPath} />
            <ImagePreview path={roughnessPath} />
          </div>

          <div className="grid grid-cols-3 gap-3 max-[900px]:grid-cols-1">
            <div className="grid gap-2">
              <Label>Normal Z channel</Label>
              <Controller
                control={form.control}
                name="normalZChannel"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="red">Red</SelectItem>
                      <SelectItem value="green">Green</SelectItem>
                      <SelectItem value="blue">Blue</SelectItem>
                      <SelectItem value="alpha">Alpha</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="terrain-ao-value">AO fallback</Label>
              <Input
                disabled={isSaving}
                id="terrain-ao-value"
                max={255}
                min={0}
                type="number"
                {...form.register("aoValue", { valueAsNumber: true })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="terrain-roughness-value">Roughness fallback</Label>
              <Input
                disabled={isSaving}
                id="terrain-roughness-value"
                max={255}
                min={0}
                type="number"
                {...form.register("roughnessValue", { valueAsNumber: true })}
              />
            </div>
          </div>

          {form.formState.errors.root && <FieldError errors={[form.formState.errors.root]} />}
          {message && <p className="text-sm text-muted-foreground">{message}</p>}

          <Button disabled={!canSave} type="submit">
            Create Terrain Texture
          </Button>
        </form>
      </Section>
    </section>
  );
};
