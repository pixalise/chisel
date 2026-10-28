import useLocalizationContext from "@/hooks/use-localization-context"
import { emptyLocalizationDocument, type LocalizationDocument } from "@/shared/localization"
import type { LocalizationContextValue } from "@/types/localization-context"
import { isNil } from "lodash"
import { createElement, useEffect, type FC } from "react"
import { act, create, type ReactTestRenderer } from "react-test-renderer"
import { afterEach, describe, expect, it, vi } from "vitest"
import LocalizationCard from "./localization-matrix/localization-card"
import LocalizationProvider from "./localization-provider"

vi.mock("@/hooks/use-list-assets-query", () => ({ default: () => ({ assets: [] }) }))
vi.mock("@/stores/app-store", () => ({ default: () => ({ _project: { path: "/tmp/project" } }) }))
vi.mock("./localization-matrix/localization-value-tools", () => ({ default: () => null }))

let renderer: ReactTestRenderer | undefined
let current: LocalizationContextValue | undefined
const source: LocalizationDocument = {
  ...emptyLocalizationDocument,
  locales: ["en", "sl_SI"],
  keys: [{ path: "UI.HELLO", placeholders: [], values: { en: "Hello", sl_SI: "Zdravo" } }],
}

const LocalizationHarness: FC = () => {
  const context = useLocalizationContext()
  useEffect(() => {
    current = context
  }, [context])
  const keyEntry = context.document.keys[0]
  if (isNil(keyEntry)) {
    throw new Error("Missing test localization key")
  }
  return createElement(LocalizationCard, {
    index: 0,
    isSelected: true,
    keyEntry,
    locales: context.document.locales,
    onRemoveKey: () => {},
    onSelectKey: () => {},
    onUpdateKey: (index, key) =>
      context.setDocument((document) => ({
        ...document,
        keys: document.keys.map((entry, entryIndex) => {
          if (entryIndex === index) {
            return key
          }
          return entry
        }),
      })),
  })
}

function mount(document: LocalizationDocument): void {
  act(() => {
    renderer = create(
      createElement(LocalizationProvider, {
        sourceDocument: document,
        children: createElement(LocalizationHarness),
      })
    )
  })
}

afterEach(() => {
  act(() => renderer?.unmount())
  renderer = undefined
  current = undefined
})

describe("mounted localization drafts", () => {
  it("keeps rapid edits in different locales and controls the rendered values", () => {
    mount(source)
    if (isNil(renderer)) {
      throw new Error("Renderer did not mount")
    }
    const mounted = renderer
    act(() =>
      mounted.root.findAllByType("textarea")[0].props.onChange({ target: { value: "Updated" } })
    )
    act(() =>
      mounted.root.findAllByType("textarea")[1].props.onChange({ target: { value: "Spremenjeno" } })
    )
    expect(current?.document.keys[0].values).toEqual({ en: "Updated", sl_SI: "Spremenjeno" })
    expect(mounted.root.findAllByType("textarea").map((field) => field.props.value)).toEqual([
      "Updated",
      "Spremenjeno",
    ])
  })

  it("does not replace dirty edits when an autosave response arrives", () => {
    mount(source)
    if (isNil(renderer)) {
      throw new Error("Renderer did not mount")
    }
    const mounted = renderer
    act(() =>
      mounted.root
        .findAllByType("textarea")[0]
        .props.onChange({ target: { value: "Still editing" } })
    )
    const response = structuredClone(source)
    response.keys[0].values.en = "Earlier autosave"
    act(() =>
      mounted.update(
        createElement(LocalizationProvider, {
          sourceDocument: response,
          children: createElement(LocalizationHarness),
        })
      )
    )
    expect(current?.document.keys[0].values.en).toBe("Still editing")
  })

  it("loads a refreshed source when the draft is clean", () => {
    mount(source)
    if (isNil(renderer)) {
      throw new Error("Renderer did not mount")
    }
    const mounted = renderer
    const response = structuredClone(source)
    response.keys[0].values.en = "Updated on disk"
    act(() =>
      mounted.update(
        createElement(LocalizationProvider, {
          sourceDocument: response,
          children: createElement(LocalizationHarness),
        })
      )
    )
    expect(current?.document.keys[0].values.en).toBe("Updated on disk")
  })
})
