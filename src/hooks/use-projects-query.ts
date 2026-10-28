import { HookKeysEnum } from "@/enums/hook-keys-enum"
import projectServices from "@/services/project-service"
import type { Project } from "@/shared/schemas"
import { useQuery } from "@tanstack/react-query"
export interface UseListProjectsQuery {
  projects: Project[]
  isLoading: boolean
}
const useListProjectsQuery = (): UseListProjectsQuery => {
  const { data, isLoading } = useQuery({
    queryKey: [HookKeysEnum.LIST_ALL_PROJECTS_QUERY],
    queryFn: async () => {
      const post = await projectServices.listAllProjects()
      return post
    },
  })
  return {
    projects: data ?? [],
    isLoading,
  }
}
export default useListProjectsQuery
