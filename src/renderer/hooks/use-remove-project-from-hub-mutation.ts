import { useMutation } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import projectServices from "@/services/project-service";
import CacheUtils from "@/utils/cache-utils";

export interface UseRemoveProjectFromHubMutation {
  removeProjectFromHub: () => Promise<void>;
  isRemoveProjectFromHubLoading: boolean;
}

const useRemoveProjectFromHubMutation = (id: string): UseRemoveProjectFromHubMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.removeProjectFromHubMutation],
    mutationFn: async (): Promise<void> => {
      await projectServices.removeProjectFromHub(id);
      await CacheUtils.invalidateQueries([[HookKeysEnum.listAllProjectsQuery]]);
    }
  });

  return {
    removeProjectFromHub: mutateAsync,
    isRemoveProjectFromHubLoading: isPending
  };
};

export default useRemoveProjectFromHubMutation;
