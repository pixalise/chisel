import { useMutation } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import exportService, { type ExportProjectResult, type ExportTarget } from "@/services/export-service";

export interface UseExportProjectMutation {
  exportProject: (target: ExportTarget) => Promise<ExportProjectResult>;
  isExportProjectLoading: boolean;
}

const useExportProjectMutation = (): UseExportProjectMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.exportProjectMutation],
    mutationFn: async (target: ExportTarget): Promise<ExportProjectResult> => exportService.exportProject(target)
  });

  return {
    exportProject: mutateAsync,
    isExportProjectLoading: isPending
  };
};

export default useExportProjectMutation;
