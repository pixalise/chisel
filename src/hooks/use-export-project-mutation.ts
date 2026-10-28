import { HookKeysEnum } from "@/enums/hook-keys-enum"
import exportService, { type ExportProjectResult } from "@/services/export-service"
import { useMutation } from "@tanstack/react-query"
export interface UseExportProjectMutation {
  exportProject: () => Promise<ExportProjectResult>
  isExportProjectLoading: boolean
}
const useExportProjectMutation = (): UseExportProjectMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.EXPORT_PROJECT_MUTATION],
    mutationFn: async (): Promise<ExportProjectResult> => exportService.exportProject(),
  })
  return {
    exportProject: mutateAsync,
    isExportProjectLoading: isPending,
  }
}
export default useExportProjectMutation
