import { HookKeysEnum } from "@/enums/hook-keys-enum"
import { queryClient } from "@/query-client"
import sourceStateService from "@/services/source-state-service"
import type { CommittedSourceSnapshot } from "@/shared/source-state"
import { useMutation } from "@tanstack/react-query"
export interface UseSourceStateMutations {
  commitDraft: () => Promise<CommittedSourceSnapshot>
  isSourceStateMutating: boolean
  rollbackToCommit: (commitId: string) => Promise<CommittedSourceSnapshot>
}
async function invalidateSourceState(): Promise<void> {
  await Promise.all(
    [
      [HookKeysEnum.LIST_SOURCE_COMMITS_QUERY],
      [HookKeysEnum.LIST_ASSETS_QUERY],
      [HookKeysEnum.LIST_LOCALIZATION_QUERY],
      [HookKeysEnum.LIST_TABLES_QUERY],
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))
  )
}
const useSourceStateMutations = (): UseSourceStateMutations => {
  const commitDraftMutation = useMutation({
    mutationKey: [HookKeysEnum.SOURCE_STATE_MUTATION, "commitDraft"],
    mutationFn: async () => sourceStateService.commitDraft(),
    onSuccess: invalidateSourceState,
  })
  const rollbackMutation = useMutation({
    mutationKey: [HookKeysEnum.SOURCE_STATE_MUTATION, "rollbackToCommit"],
    mutationFn: async (commitId: string) => sourceStateService.rollbackToCommit(commitId),
    onSuccess: invalidateSourceState,
  })
  return {
    commitDraft: commitDraftMutation.mutateAsync,
    isSourceStateMutating: commitDraftMutation.isPending || rollbackMutation.isPending,
    rollbackToCommit: rollbackMutation.mutateAsync,
  }
}
export default useSourceStateMutations
