import { useQuery } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import sourceStateService from "@/services/source-state-service";
import type { CommittedSourceSnapshot } from "../../shared/source-state";

export interface UseSourceCommitsQuery {
  commits: CommittedSourceSnapshot[];
  areSourceCommitsLoading: boolean;
}

const useSourceCommitsQuery = (): UseSourceCommitsQuery => {
  const { data, isLoading } = useQuery({
    queryKey: [HookKeysEnum.listSourceCommitsQuery],
    queryFn: async () => sourceStateService.listCommits()
  });

  return {
    commits: data ?? [],
    areSourceCommitsLoading: isLoading
  };
};

export default useSourceCommitsQuery;
