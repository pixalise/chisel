import { LocalizationContext, type LocalizationContextValue } from "@/types/localization-context"
import { isNil } from "lodash"
import { useContext } from "react"

const useLocalizationContext = (): LocalizationContextValue => {
  const context = useContext(LocalizationContext)
  if (isNil(context)) {
    throw new Error("useLocalizationContext requires LocalizationProvider.")
  }
  return context
}
export default useLocalizationContext
