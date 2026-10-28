import { HookKeysEnum } from "@/enums/hook-keys-enum"
import { queryClient } from "@/query-client"
import projectServices from "@/services/project-service"
import { useMutation } from "@tanstack/react-query"
export interface UseRemoveProjectFromHubMutation {
  removeProjectFromHub: () => Promise<void>
  isRemoveProjectFromHubLoading: boolean
}
const useRemoveProjectFromHubMutation = (id: string): UseRemoveProjectFromHubMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.REMOVE_PROJECT_FROM_HUB_MUTATION],
    mutationFn: async (): Promise<void> => {
      await projectServices.removeProjectFromHub(id)
      await Promise.all(
        [[HookKeysEnum.LIST_ALL_PROJECTS_QUERY]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
    },
  })
  return {
    removeProjectFromHub: mutateAsync,
    isRemoveProjectFromHubLoading: isPending,
  }
}
export default useRemoveProjectFromHubMutation
