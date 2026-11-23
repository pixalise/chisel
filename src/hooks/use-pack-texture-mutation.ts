import { useMutation, useQueryClient } from "@tanstack/react-query"
import { HookKeysEnum } from "@/enums/hook-keys-enum"
import texturePackingService from "@/services/texture-packing-service"
import type { Project, TexturePackingForm } from "@/shared/schemas"

const usePackTextureMutation = (project: Project) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: [HookKeysEnum.PACK_TEXTURE_MUTATION, project.id, project.path],
    mutationFn: async (input: TexturePackingForm) => {
      const asset = await texturePackingService.pack({ ...input, projectPath: project.path })
      await queryClient.invalidateQueries({
        queryKey: [HookKeysEnum.LIST_ASSETS_QUERY, project.id, project.path],
      })
      return asset
    },
  })
}

export default usePackTextureMutation
