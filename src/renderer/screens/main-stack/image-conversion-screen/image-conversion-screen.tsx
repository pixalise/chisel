import { useId, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { FolderOpen, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import PageHeader from "@/components/page-header";
import { Section } from "@/components/layout/section";
import imageConversionService from "@/services/image-conversion-service";
import { convertImagesSchema, type ConvertImages, type ConvertedImage } from "../../../../shared/schemas";

const SOURCE_IMAGE_TYPES = "image/*,.tif,.tiff,.tga,.exr,.avif,.heic,.heif";

interface SourcePreview {
  path: string;
  source?: string | null;
}

export function ImageConversionScreen() {
  const sourceInputId = useId();
  const outputInputId = useId();
  const [converted, setConverted] = useState<ConvertedImage[]>([]);
  const [sourcePreviews, setSourcePreviews] = useState<SourcePreview[]>([]);
  const previewRequest = useRef(0);
  const form = useForm<ConvertImages>({
    resolver: zodResolver(convertImagesSchema),
    defaultValues: { inputPaths: [], outputFolder: "" },
    mode: "onChange"
  });
  const inputPaths = useWatch({ control: form.control, name: "inputPaths" });

  async function chooseOutputFolder() {
    const outputFolder = await imageConversionService.chooseOutputFolder();
    if (outputFolder) {
      form.setValue("outputFolder", outputFolder, { shouldDirty: true, shouldValidate: true });
    }
  }

  async function convert(input: ConvertImages) {
    form.clearErrors("root");
    try {
      setConverted(await imageConversionService.convert(input));
    } catch (error) {
      setConverted([]);
      form.setError("root", { message: error instanceof Error ? error.message : String(error) });
    }
  }

  async function selectSources(files: File[], onChange: (paths: string[]) => void) {
    const paths = files.map((file) => window.electron.getPathForFile(file)).filter(Boolean);
    onChange(paths);
    const request = ++previewRequest.current;
    setSourcePreviews(paths.map((path) => ({ path })));
    const previews = await Promise.all(
      paths.map(async (path) => ({
        path,
        source: await imageConversionService.createPreview(path).catch(() => null)
      }))
    );
    if (request === previewRequest.current) {
      setSourcePreviews(previews);
    }
  }

  return (
    <section className="grid min-h-max w-full min-w-0 content-start gap-4 pb-8">
      <PageHeader title="Image Conversion" description="Batch image conversion to PNG." />
      <Section title="Conversion Queue" copy={`${inputPaths.length} source image${inputPaths.length === 1 ? "" : "s"}`}>
        <form className="grid gap-5" onSubmit={form.handleSubmit(convert)}>
          <FieldGroup>
            <Controller
              control={form.control}
              name="inputPaths"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={sourceInputId}>Source images</FieldLabel>
                  <Input
                    ref={field.ref}
                    accept={SOURCE_IMAGE_TYPES}
                    aria-invalid={fieldState.invalid}
                    id={sourceInputId}
                    multiple
                    name={field.name}
                    type="file"
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      void selectSources(Array.from(event.target.files ?? []), field.onChange);
                    }}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="outputFolder"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={outputInputId}>Output folder</FieldLabel>
                  <div className="flex gap-2">
                    <Input {...field} aria-invalid={fieldState.invalid} id={outputInputId} readOnly />
                    <Button aria-label="Choose output folder" onClick={chooseOutputFolder} size="icon" type="button" variant="outline">
                      <FolderOpen />
                    </Button>
                  </div>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
          {sourcePreviews.length > 0 && (
            <div className="grid grid-cols-3 gap-3 max-[1100px]:grid-cols-2 max-[720px]:grid-cols-1">
              {sourcePreviews.map((preview) => (
                <div className="min-w-0 border border-border bg-muted" key={preview.path}>
                  <div className="grid h-36 place-items-center overflow-hidden">
                    {preview.source ? (
                      <img alt={preview.path} className="max-h-36 max-w-full object-contain" src={preview.source} />
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {preview.source === null ? "Preview unavailable." : "Loading preview..."}
                      </span>
                    )}
                  </div>
                  <code className="block truncate border-t border-border bg-background px-2 py-1.5 text-xs">{preview.path}</code>
                </div>
              ))}
            </div>
          )}
          {form.formState.errors.root && <FieldError errors={[form.formState.errors.root]} />}
          <Button disabled={form.formState.isSubmitting || !form.formState.isValid} type="submit">
            <Images />
            {form.formState.isSubmitting ? "Converting..." : "Convert to PNG"}
          </Button>
        </form>
      </Section>
      {converted.length > 0 && (
        <Section title="Converted" copy={`${converted.length} PNG${converted.length === 1 ? "" : "s"}`}>
          <div className="divide-y divide-border border border-border">
            {converted.map((image) => (
              <div className="grid grid-cols-2 gap-3 px-3 py-2 text-xs max-[900px]:grid-cols-1" key={image.outputPath}>
                <code className="truncate text-muted-foreground">{image.inputPath}</code>
                <code className="truncate">{image.outputPath}</code>
              </div>
            ))}
          </div>
        </Section>
      )}
    </section>
  );
}
