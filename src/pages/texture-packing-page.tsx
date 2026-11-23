import ControlledSlugInput from "@/components/controls/controlled-slug-input"
import ControlledTextarea from "@/components/controls/controlled-textarea"
import ImagePreview from "@/components/image-preview"
import { Section } from "@/components/layout/section"
import TextureMapInput from "@/components/texture-packing/texture-map-input"
import { Button } from "@/components/ui/button"
import usePackTextureMutation from "@/hooks/use-pack-texture-mutation"
import { texturePackingFormSchema, type TexturePackingForm } from "@/shared/schemas"
import useAppStore from "@/stores/app-store"
import { zodResolver } from "@hookform/resolvers/zod"
import { isNil } from "lodash"
import { PackagePlus } from "lucide-react"
import { type FC } from "react"
import { useForm } from "react-hook-form"

const TexturePackingPage: FC = () => {
  const {
    computed: { project },
  } = useAppStore()
  const packing = usePackTextureMutation(project)
  const form = useForm<TexturePackingForm>({
    resolver: zodResolver(texturePackingFormSchema),
    defaultValues: {
      name: "",
      note: "",
      albedo: "",
      metallic: "",
      normal: "",
      roughness: "",
      emissive: "",
    },
    mode: "onChange",
  })
  const canRun = form.formState.isValid && !packing.isPending
  return (
    <section className="grid min-h-max w-full min-w-0 content-start gap-4 pb-8">
      <Section
        title="Material Packing"
        copy="Creates ZPBR material assets from albedo, metallic, normal, roughness, and emissive-mask maps."
      >
        <form
          className="grid gap-5"
          onSubmit={form.handleSubmit((input) => {
            packing.mutate(input)
          })}
        >
          <ControlledSlugInput
            control={form.control}
            disabled={packing.isPending}
            label="Slug"
            name="name"
          />
          <ControlledTextarea
            control={form.control}
            disabled={packing.isPending}
            label="Note"
            name="note"
            rows={1}
          />
          <div className="grid grid-cols-2 gap-4 max-[960px]:grid-cols-1">
            <TextureMapInput
              control={form.control}
              disabled={packing.isPending}
              label="Albedo"
              name="albedo"
            />
            <TextureMapInput
              control={form.control}
              disabled={packing.isPending}
              label="Metallic"
              name="metallic"
            />
            <TextureMapInput
              control={form.control}
              disabled={packing.isPending}
              label="Normal"
              name="normal"
            />
            <TextureMapInput
              control={form.control}
              disabled={packing.isPending}
              label="Roughness"
              name="roughness"
            />
            <TextureMapInput
              control={form.control}
              disabled={packing.isPending}
              label="Emissive mask"
              name="emissive"
            />
          </div>
          {packing.isError && (
            <p role="alert" className="text-sm text-destructive">
              {packing.error.message}
            </p>
          )}
          <Button disabled={!canRun} type="submit">
            <PackagePlus />
            Create ZPBR Package
          </Button>
        </form>
      </Section>
      {!isNil(packing.data) && (
        <Section title={packing.data.name} copy={packing.data.relativePath}>
          <ImagePreview path={`${project.path}/${packing.data.relativePath}`} />
        </Section>
      )}
    </section>
  )
}

export default TexturePackingPage
