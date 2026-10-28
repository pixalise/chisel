import LocalizationProvider from "@/components/localization/localization-provider"
import LocalizationWorkspace from "@/components/localization/localization-workspace"
import useLocalizationQuery from "@/hooks/use-localization-query"
import useAppStore from "@/stores/app-store"
import type { FC } from "react"

const LocalizationPage: FC = () => {
  const { localization, isLocalizationLoading } = useLocalizationQuery()
  const {
    computed: { project },
  } = useAppStore()
  return (
    <LocalizationProvider key={`${project.id}:${project.path}`} sourceDocument={localization}>
      <LocalizationWorkspace
        isLocalizationLoading={isLocalizationLoading}
        sourceLocalization={localization}
      />
    </LocalizationProvider>
  )
}
export default LocalizationPage
