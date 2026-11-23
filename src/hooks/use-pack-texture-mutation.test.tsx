import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type FC, createElement } from "react"
import { act, create } from "react-test-renderer"
import { describe, expect, it, vi } from "vitest"
import { HookKeysEnum } from "@/enums/hook-keys-enum"
import type { Project, TexturePackingForm } from "@/shared/schemas"
import usePackTextureMutation from "./use-pack-texture-mutation"

const mocks = vi.hoisted(() => ({ pack: vi.fn() }))
vi.mock("@/services/texture-packing-service", () => ({ default: mocks }))
const project: Project = { id: "test-project", name: "Test", path: "/tmp/target" }
const input: TexturePackingForm = {
  name: "HULL",
  albedo: "a.png",
  metallic: "m.png",
  emissive: "e.png",
  normal: "n.png",
  roughness: "r.png",
}

const PackingHarness: FC = () => {
  const mutation = usePackTextureMutation(project)
  return createElement("button", { onClick: () => mutation.mutateAsync(input) })
}

describe("texture packing mutation", () => {
  it("invalidates only the destination project's asset query after success and propagates failure", async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const invalidate = vi.spyOn(client, "invalidateQueries")
    const result = { id: "HULL" }
    mocks.pack.mockResolvedValueOnce(result).mockRejectedValueOnce(new Error("Map size mismatch"))
    const renderer = create(
      createElement(QueryClientProvider, { client, children: createElement(PackingHarness) })
    )
    await act(async () => {
      expect(await renderer.root.findByType("button").props.onClick()).toEqual(result)
    })
    expect(mocks.pack).toHaveBeenCalledWith({ ...input, projectPath: project.path })
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: [HookKeysEnum.LIST_ASSETS_QUERY, project.id, project.path],
    })
    await act(async () => {
      await expect(renderer.root.findByType("button").props.onClick()).rejects.toThrow(
        "Map size mismatch"
      )
    })
    expect(invalidate).toHaveBeenCalledTimes(1)
    act(() => renderer.unmount())
    client.clear()
  })
})
