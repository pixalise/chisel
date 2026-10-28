import { HookKeysEnum } from "@/enums/hook-keys-enum"
import { queryClient } from "@/query-client"
import projectServices from "@/services/project-service"
import type { CreateOrUpdateProject, Project } from "@/shared/schemas"
import { useMutation } from "@tanstack/react-query"
import { nanoid } from "nanoid"
export interface UseCreateOrUpdateProjectMutation {
  createOrUpdateProject: (input: CreateOrUpdateProject) => Promise<Project>
  isCreateOrUpdateProjectLoading: boolean
}
const useCreateOrUpdateProjectMutation = (id?: string): UseCreateOrUpdateProjectMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.CREATE_OR_UPDATE_PROJECT_MUTATION],
    mutationFn: async (input: CreateOrUpdateProject): Promise<Project> => {
      const project = await projectServices.createOrUpdateProject(id ?? nanoid(), input)
      await Promise.all(
        [[HookKeysEnum.LIST_ALL_PROJECTS_QUERY]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey })
        )
      )
      return project
    },
  })
  return {
    createOrUpdateProject: mutateAsync,
    isCreateOrUpdateProjectLoading: isPending,
  }
}
export default useCreateOrUpdateProjectMutation
