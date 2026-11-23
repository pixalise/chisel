import fileService from "@/services/file-service"
import type { TextureMaps, TexturePackingForm } from "@/shared/schemas"
import type { Nullish } from "@/shared/nullish"
import { isNil } from "lodash"
import { useController, type Control } from "react-hook-form"

const useTextureMapField = (control: Control<TexturePackingForm>, name: keyof TextureMaps) => {
  const { field, fieldState } = useController({ control, name })
  function selectFile(files: Nullish<FileList>): void {
    const file = files?.[0]
    if (isNil(file)) {
      field.onChange("")
      return
    }
    field.onChange(fileService.getPathForFile(file))
  }
  function bindInput(element: HTMLInputElement | null): void {
    field.ref(element)
  }
  function blur(): void {
    field.onBlur()
  }
  return { bindInput, blur, fieldState, selectFile }
}

export default useTextureMapField
