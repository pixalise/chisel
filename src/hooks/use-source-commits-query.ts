import { HookKeysEnum } from "@/enums/hook-keys-enum"
import sourceStateService from "@/services/source-state-service"
import type { CommittedSourceSnapshot } from "@/shared/source-state"
import useAppStore from "@/stores/app-store"
import { useQuery } from "@tanstack/react-query"
export interface UseSourceCommitsQuery {
  commits: CommittedSourceSnapshot[]
  areSourceCommitsLoading: boolean
}
const useSourceCommitsQuery = (): UseSourceCommitsQuery => {
  const {
    computed: { project },
  } = useAppStore()
  const { data, isLoading } = useQuery({
    queryKey: [HookKeysEnum.LIST_SOURCE_COMMITS_QUERY, project.id, project.path],
    queryFn: async () => sourceStateService.listCommits(project),
  })
  return {
    commits: data ?? [],
    areSourceCommitsLoading: isLoading,
  }
}
export default useSourceCommitsQuery
