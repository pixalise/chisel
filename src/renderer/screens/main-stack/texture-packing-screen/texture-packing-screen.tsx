import { type FC, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Eye, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import ControlledImageInput from "@/components/controls/controlled-image-input";
import ControlledSlugInput from "@/components/controls/controlled-slug-input";
import ControlledTextarea from "@/components/controls/controlled-textarea";
import ImagePreview from "@/components/image-preview";
import { Section } from "@/components/layout/section";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import texturePackingService from "@/services/texture-packing-service";
import CacheUtils from "@/utils/cache-utils";
import { packTexturePackageSchema, type PackTexturePackage } from "../../../../shared/schemas";

interface PackedPreviews {
  albedoHeight: string;
  normalRoughness: string;
}

const texturePackingFormSchema = packTexturePackageSchema.omit({ projectPath: true });

export const TexturePackingScreen: FC = () => {
  const [message, setMessage] = useState("");
  const [packedPreviews, setPackedPreviews] = useState<PackedPreviews | null>(null);
  const form = useForm<Omit<PackTexturePackage, "projectPath">>({
    defaultValues: {
      albedo: "",
      height: "",
      name: "",
      normal: "",
      note: "",
      roughness: ""
    },
    mode: "onChange",
    resolver: zodResolver(texturePackingFormSchema)
  });
  const albedoPath = useWatch({ control: form.control, name: "albedo" });
  const heightPath = useWatch({ control: form.control, name: "height" });
  const normalPath = useWatch({ control: form.control, name: "normal" });
  const roughnessPath = useWatch({ control: form.control, name: "roughness" });

  async function createPreviews(input: Omit<PackTexturePackage, "projectPath">): Promise<void> {
    setMessage("");
    setPackedPreviews(null);
    form.clearErrors("root");
    try {
      const [albedoHeight, normalRoughness] = await Promise.all([
        texturePackingService.packAlbedoHeight({ albedo: input.albedo, height: input.height }),
        texturePackingService.packNormalRoughness({ normal: input.normal, roughness: input.roughness })
      ]);
      setPackedPreviews({ albedoHeight, normalRoughness });
    } catch (error) {
      form.setError("root", { message: error instanceof Error ? error.message : String(error) });
    }
  }

  async function createPackage(input: Omit<PackTexturePackage, "projectPath">): Promise<void> {
    setMessage("");
    form.clearErrors("root");
    try {
      const asset = await texturePackingService.packPackage(input);
      await CacheUtils.invalidateQueries([[HookKeysEnum.listAssetsQuery]]);
      setMessage(`Created ${asset.name}.gppt in the asset library.`);
    } catch (error) {
      form.setError("root", { message: error instanceof Error ? error.message : String(error) });
    }
  }

  const isBusy = form.formState.isSubmitting;
  const canRun = form.formState.isValid && !isBusy;

  return (
    <Section title="Material Packing" copy="Creates GPPT material assets from albedo, height, normal, and roughness channels.">
      <form className="grid gap-5" onSubmit={form.handleSubmit(createPackage)}>
        <div className="grid gap-3 grid-cols-1">
          <ControlledSlugInput control={form.control} disabled={isBusy} label="Slug" name="name" />
          <ControlledTextarea control={form.control} disabled={isBusy} label="Note" name="note" rows={1} />
        </div>

        <div className="grid grid-cols-2 gap-4 max-[960px]:grid-cols-1">
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
              <ControlledImageInput control={form.control} label="Albedo" name="albedo" />
              <ControlledImageInput control={form.control} label="Height" name="height" />
            </div>
            <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
              <ImagePreview path={albedoPath} />
              <ImagePreview path={heightPath} />
            </div>
          </div>

          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
              <ControlledImageInput control={form.control} label="Normal" name="normal" />
              <ControlledImageInput control={form.control} label="Roughness" name="roughness" />
            </div>
            <div className="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
              <ImagePreview path={normalPath} />
              <ImagePreview path={roughnessPath} />
            </div>
          </div>
        </div>

        {packedPreviews && (
          <div className="grid grid-cols-2 gap-3 max-[760px]:grid-cols-1">
            <div className="grid gap-2">
              <span className="text-sm font-medium">Albedo + Height</span>
              <ImagePreview path={packedPreviews.albedoHeight} />
            </div>
            <div className="grid gap-2">
              <span className="text-sm font-medium">Normal + Roughness</span>
              <ImagePreview path={packedPreviews.normalRoughness} />
            </div>
          </div>
        )}

        {form.formState.errors.root && <FieldError errors={[form.formState.errors.root]} />}
        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={!canRun} onClick={form.handleSubmit(createPreviews)} type="button" variant="outline">
            <Eye />
            Preview Packed Textures
          </Button>
          <Button disabled={!canRun} type="submit">
            <PackagePlus />
            Create GPPT Package
          </Button>
        </div>
      </form>
    </Section>
  );
};
