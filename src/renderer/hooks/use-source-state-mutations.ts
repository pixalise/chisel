import { useMutation } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import sourceStateService from "@/services/source-state-service";
import CacheUtils from "@/utils/cache-utils";
import type { CommittedSourceSnapshot } from "../../shared/source-state";

export interface UseSourceStateMutations {
  commitDraft: () => Promise<CommittedSourceSnapshot>;
  isSourceStateMutating: boolean;
  rollbackToCommit: (commitId: string) => Promise<CommittedSourceSnapshot>;
}

async function invalidateSourceState(): Promise<void> {
  await CacheUtils.invalidateQueries([
    [HookKeysEnum.listSourceCommitsQuery],
    [HookKeysEnum.listAssetsQuery],
    [HookKeysEnum.listLocalizationQuery],
    [HookKeysEnum.listTablesQuery]
  ]);
}

const useSourceStateMutations = (): UseSourceStateMutations => {
  const commitDraftMutation = useMutation({
    mutationKey: [HookKeysEnum.sourceStateMutation, "commitDraft"],
    mutationFn: async () => sourceStateService.commitDraft(),
    onSuccess: invalidateSourceState
  });

  const rollbackMutation = useMutation({
    mutationKey: [HookKeysEnum.sourceStateMutation, "rollbackToCommit"],
    mutationFn: async (commitId: string) => sourceStateService.rollbackToCommit(commitId),
    onSuccess: invalidateSourceState
  });

  return {
    commitDraft: commitDraftMutation.mutateAsync,
    isSourceStateMutating: commitDraftMutation.isPending || rollbackMutation.isPending,
    rollbackToCommit: rollbackMutation.mutateAsync
  };
};

export default useSourceStateMutations;
