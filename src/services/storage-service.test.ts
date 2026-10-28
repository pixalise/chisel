import { nanoid } from "nanoid"
import { beforeEach, describe, expect, it, vi } from "vitest"
import storageService from "./storage-service"

const values = new Map<string, string>()
const project = { id: nanoid(), name: "Roblox Game", path: "/tmp/roblox-game" }

describe("project hub storage", () => {
  beforeEach(() => {
    values.clear()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
  })

  it("distinguishes missing storage from malformed or incompatible data", async () => {
    await expect(storageService.tryGetProjects()).resolves.toBeUndefined()
    for (const raw of ["", "{", "null", "{}", '[{"name":"Broken"}]']) {
      values.set("projects", raw)
      await expect(storageService.tryGetProjects()).rejects.toThrow()
    }
  })

  it("preserves the current storage key, wire shape, order, and empty list", async () => {
    await storageService.saveProjects([project])
    expect(values.get("projects")).toBe(JSON.stringify([project]))
    await expect(storageService.tryGetProjects()).resolves.toEqual([project])
    await storageService.saveProjects([])
    await expect(storageService.tryGetProjects()).resolves.toEqual([])
  })

  it("propagates storage failures", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("Storage unavailable")
      },
      setItem: () => {
        throw new Error("Quota exceeded")
      },
    })
    await expect(storageService.tryGetProjects()).rejects.toThrow("Storage unavailable")
    await expect(storageService.saveProjects([project])).rejects.toThrow("Quota exceeded")
  })
})
