import Section from "@/components/layout/section"
import StyleCreateEditor from "@/components/localization/editors/style-create-editor"
import StyleEditor from "@/components/localization/editors/style-editor"
import TooltipCreateEditor from "@/components/localization/editors/tooltip-create-editor"
import TooltipEditor from "@/components/localization/editors/tooltip-editor"
import LanguagesSection from "@/components/localization/languages-section/languages-section"
import LocalizationKeySection from "@/components/localization/localization-key-section"
import LocalizationKeyTree from "@/components/localization/localization-key-tree/localization-key-tree"
import LocalizationMatrix from "@/components/localization/localization-matrix/localization-matrix"
import { Button } from "@/components/ui/button"
import { LocalizationProblemSeverity } from "@/enums/localization-problem-severity"
import useListAssetsQuery from "@/hooks/use-list-assets-query"
import useLocalizationContext from "@/hooks/use-localization-context"
import useSaveLocalizationMutation from "@/hooks/use-save-localization-mutation"
import { useToast } from "@/hooks/use-toast"
import { validateLocalizationDocument, type LocalizationDocument } from "@/shared/localization"
import { useEffect, useMemo, useRef, type FC } from "react"
interface LocalizationScreenContentProps {
  isLocalizationLoading: boolean
  sourceLocalization: LocalizationDocument
}
const SAFE_FREQUENCY = 1500
const LocalizationWorkspace: FC<LocalizationScreenContentProps> = (props) => {
  const { isLocalizationLoading, sourceLocalization } = props
  const { assets } = useListAssetsQuery()
  const { document: draft, setDocument: setDraft } = useLocalizationContext()
  const { saveLocalization, isSaveLocalizationLoading } = useSaveLocalizationMutation()
  const { toast } = useToast()
  const autosaveRef = useRef({
    draft,
    errorCount: 0,
    isLocalizationLoading,
    isSaveLocalizationLoading,
    saveLocalization,
  })
  const isAutosavingRef = useRef(false)
  const lastAutosavedErrorRef = useRef<string | undefined>(undefined)
  const lastSavedSignatureRef = useRef(JSON.stringify(sourceLocalization))
  useEffect(() => {
    lastSavedSignatureRef.current = JSON.stringify(sourceLocalization)
  }, [sourceLocalization])
  const problems = useMemo(() => validateLocalizationDocument(draft, assets), [assets, draft])
  const errorCount = problems.filter(
    (problem) => problem.severity === LocalizationProblemSeverity.ERROR
  ).length
  async function onSave(): Promise<void> {
    if (errorCount > 0) {
      toast({
        variant: "destructive",
        title: "Localization has blocking errors",
        description: problems.find(
          (problem) => problem.severity === LocalizationProblemSeverity.ERROR
        )?.message,
      })
      return
    }
    try {
      const saved = await saveLocalization(draft)
      setDraft(saved)
      toast({
        title: "Localization saved",
        description: `${saved.keys.length} keys across ${saved.locales.length} locales.`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Localization save failed",
        description: error instanceof Error ? error.message : String(error),
      })
    }
  }
  useEffect(() => {
    autosaveRef.current = {
      draft,
      errorCount,
      isLocalizationLoading,
      isSaveLocalizationLoading,
      saveLocalization,
    }
  }, [draft, errorCount, isLocalizationLoading, isSaveLocalizationLoading, saveLocalization])
  useEffect(() => {
    const interval = window.setInterval(() => {
      const current = autosaveRef.current
      if (
        current.errorCount > 0 ||
        current.isLocalizationLoading ||
        current.isSaveLocalizationLoading ||
        isAutosavingRef.current
      ) {
        return
      }
      const signature = JSON.stringify(current.draft)
      if (signature === lastSavedSignatureRef.current) {
        return
      }
      isAutosavingRef.current = true
      void current
        .saveLocalization(current.draft)
        .then((saved) => {
          lastSavedSignatureRef.current = JSON.stringify(saved)
          lastAutosavedErrorRef.current = undefined
          setDraft((currentDraft) =>
            JSON.stringify(currentDraft) === signature ? saved : currentDraft
          )
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error)
          if (lastAutosavedErrorRef.current === message) {
            return
          }
          lastAutosavedErrorRef.current = message
          toast({
            variant: "destructive",
            title: "Localization autosave failed",
            description: message,
          })
        })
        .finally(() => {
          isAutosavingRef.current = false
        })
    }, SAFE_FREQUENCY)
    return () => {
      window.clearInterval(interval)
    }
  }, [toast, setDraft])
  return (
    <Section
      title="Localization"
      copy="Key/value translation matrix with typed placeholders, reusable rich styles, tooltips, and Roblox Luau exports."
      actions={[
        <Button
          disabled={isLocalizationLoading || isSaveLocalizationLoading || errorCount > 0}
          key="save"
          onClick={onSave}
          type="button"
        >
          {isSaveLocalizationLoading ? "Saving..." : "Save Localization"}
        </Button>,
      ]}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_24rem] gap-4 max-[1180px]:grid-cols-1">
        <div className="min-w-0 space-y-4">
          <LanguagesSection document={draft} onUpdateDocument={setDraft} />
          <Section title="Keys">
            <div className="grid grid-cols-[20rem_minmax(0,1fr)] gap-3">
              <LocalizationKeyTree />
              <div>
                <LocalizationKeySection />
                <LocalizationMatrix />
              </div>
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Styles">
            <StyleCreateEditor />
            <StyleEditor />
          </Section>

          <Section title="Tooltips">
            <TooltipCreateEditor assets={assets} />
            <TooltipEditor assets={assets} />
          </Section>
        </div>
      </div>
    </Section>
  )
}
export default LocalizationWorkspace
