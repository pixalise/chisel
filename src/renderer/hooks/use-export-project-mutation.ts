import { useMutation } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import exportService, { type ExportProjectResult } from "@/services/export-service";

export interface UseExportProjectMutation {
  exportProject: () => Promise<ExportProjectResult>;
  isExportProjectLoading: boolean;
}

const useExportProjectMutation = (): UseExportProjectMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.exportProjectMutation],
    mutationFn: async (): Promise<ExportProjectResult> => exportService.exportProject()
  });

  return {
    exportProject: mutateAsync,
    isExportProjectLoading: isPending
  };
};

export default useExportProjectMutation;
