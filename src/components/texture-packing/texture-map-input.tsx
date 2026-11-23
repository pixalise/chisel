import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import useTextureMapField from "@/hooks/use-texture-map-field"
import type { TextureMaps, TexturePackingForm } from "@/shared/schemas"
import { useId, type FC } from "react"
import type { Control } from "react-hook-form"

interface TextureMapInputProps {
  control: Control<TexturePackingForm>
  name: keyof TextureMaps
  label: string
  disabled: boolean
}

const TextureMapInput: FC<TextureMapInputProps> = (props) => {
  const { control, name, label, disabled } = props
  const { bindInput, blur, fieldState, selectFile } = useTextureMapField(control, name)
  const id = useId()
  return (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        ref={bindInput}
        name={name}
        type="file"
        accept=".png"
        disabled={disabled}
        aria-invalid={fieldState.invalid}
        onBlur={blur}
        onChange={(event) => {
          selectFile(event.currentTarget.files)
        }}
      />
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  )
}

export default TextureMapInput
