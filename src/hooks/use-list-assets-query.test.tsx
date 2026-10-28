import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { type FC, createElement } from "react"
import { act, create } from "react-test-renderer"
import { afterEach, describe, expect, it, vi } from "vitest"
import { nanoid } from "nanoid"
import { HookKeysEnum } from "@/enums/hook-keys-enum"
import type { Project } from "@/shared/schemas"
import useAppStore from "@/stores/app-store"
import useListAssetsQuery from "./use-list-assets-query"

const mocks = vi.hoisted(() => ({ getAllAssets: vi.fn() }))
vi.mock("@/services/asset-service", () => ({ default: mocks }))

const AssetQueryHarness: FC = () => {
  const { assets } = useListAssetsQuery()
  return createElement("output", {}, JSON.stringify(assets))
}

afterEach(() => {
  // AGENT: Explicit direct accessor
  useAppStore.getState().setProject(undefined)
  vi.clearAllMocks()
})

describe("project-scoped asset queries", () => {
  it("keeps the same project ID in different folders in separate caches", async () => {
    const first: Project = { id: nanoid(), name: "First", path: "/tmp/first" }
    const second: Project = { ...first, name: "Second", path: "/tmp/second" }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mocks.getAllAssets.mockImplementation(async (project: Project) => [project.path])
    // AGENT: Explicit direct accessor
    useAppStore.getState().setProject(first)
    const renderer = create(
      createElement(QueryClientProvider, {
        client,
        children: createElement(AssetQueryHarness),
      })
    )
    await act(async () => {
      await client.refetchQueries({
        queryKey: [HookKeysEnum.LIST_ASSETS_QUERY, first.id, first.path],
      })
    })
    await act(async () => {
      // AGENT: Explicit direct accessor
      useAppStore.getState().setProject(second)
    })
    await act(async () => {
      await client.refetchQueries({
        queryKey: [HookKeysEnum.LIST_ASSETS_QUERY, second.id, second.path],
      })
    })
    expect(mocks.getAllAssets).toHaveBeenCalledWith(first)
    expect(mocks.getAllAssets).toHaveBeenCalledWith(second)
    expect(client.getQueryData([HookKeysEnum.LIST_ASSETS_QUERY, first.id, first.path])).toEqual([
      first.path,
    ])
    expect(client.getQueryData([HookKeysEnum.LIST_ASSETS_QUERY, second.id, second.path])).toEqual([
      second.path,
    ])
    act(() => renderer.unmount())
    client.clear()
  })
})
