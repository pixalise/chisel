import { useQuery } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import projectServices from "@/services/project-service";
import { Project } from "../../shared/schemas";

export interface UseListProjectsQuery {
  projects: Project[];
  isLoading: boolean;
}

const useListProjectsQuery = (): UseListProjectsQuery => {
  const { data, isLoading } = useQuery({
    queryKey: [HookKeysEnum.listAllProjectsQuery],
    queryFn: async () => {
      const post = await projectServices.listAllProjects();
      return post;
    }
  });

  return {
    projects: data ?? [],
    isLoading
  };
};

export default useListProjectsQuery;
