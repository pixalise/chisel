import { CreateOrUpdateProject, Project } from "../../shared/schemas";
import { useMutation } from "@tanstack/react-query";
import { HookKeysEnum } from "@/constants/hook-keys-enum";
import projectServices from "@/services/project-service";
import { nanoid } from "nanoid";
import CacheUtils from "@/utils/cache-utils";

export interface UseCreateOrUpdateProjectMutation {
  createOrUpdateProject: (input: CreateOrUpdateProject) => Promise<Project>;
  isCreateOrUpdateProjectLoading: boolean;
}

const useCreateOrUpdateProjectMutation = (id?: string): UseCreateOrUpdateProjectMutation => {
  const { mutateAsync, isPending } = useMutation({
    mutationKey: [HookKeysEnum.createOrUpdateProjectMutation],
    mutationFn: async (input: CreateOrUpdateProject): Promise<Project> => {
      const project = await projectServices.createOrUpdateProject(id ?? nanoid(), input);
      await CacheUtils.invalidateQueries([[HookKeysEnum.listAllProjectsQuery]]);
      return project;
    }
  });

  return {
    createOrUpdateProject: mutateAsync,
    isCreateOrUpdateProjectLoading: isPending
  };
};

export default useCreateOrUpdateProjectMutation;
