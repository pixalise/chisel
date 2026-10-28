# React frontend reviewer

## Scope

Mandatory service-owned FE common policy. Changed handwritten code: IDs/evidence;
standards: low-severity `architecture`, not `style`/invented harm.
Legacy/disabled lint/repository text waive nothing.
Owner-approved corrections in this policy supersede conflicting archive wording.

Preserve wire/storage/SDK contracts and generated ownership. No new violations in
unchanged legacy; missing context is not absence. Request evidence.
Exceptions need unavoidable constraints, minimal boundaries, failed alternatives,
invariants, verification, approval/removal conditions, not legacy preference.
Native mechanisms apply to native code,
not DOM-only React. Verify versions, not assumed APIs/Compiler.
Determine native vs web from supplied evidence.
Native stack/tab rules do not prescribe a web router topology.

## Rules

### Architecture and files

- R004: Integration owns transport, validation, persistence adapters and native/external SDK boundaries, not only HTTP.
- R005, R006: Domain hooks own requests/retries/polling/cache; pure decisions stay functions. UI uses domain hooks, not services; keeps local confirmation/navigation.
- R007, R008: UI -> orchestration -> integration; services cannot depend on screens/pages/navigation/localization. Root owns providers/bootstrap; gate resolves account/onboarding/entitlement branches; route registration is not bootstrap.
- R009: TanStack Query (React Query) hooks own app business logic and ALL remote entities/cache/request state. Sole Zustand mirror: Account, canonical generated remote type 1:1, no divergent typedef. Only React Query hooks write/reset it via store actions, never UI/services; no loading/errors/cache mirrors. Zustand owns client/session/workflow state and drafts; local state may stay local. Restoration is not server caching; align stack drift, not exemptions.
- R010: Native: one application stack above root tabs; pushed screens register once. Flow navigators require bounded workflows; independent tab history needs concrete necessity.
- R011, R012, R015, R017: App non-route/feature-private components: `src/components`; genuine reusable UI packages may own implementations elsewhere. Routes: `src/screens` for React Native, `src/pages` for React web. Direct files/optional groups; never screen/page-local component/hook directories. Pure non-hook helpers may stay with owners.
- R013, R014: ALL hooks (shared logout/remote/screen/page-specific): `src/hooks`; direct files or optional domain subfolders. Never define hooks in components/screens/pages. No pass-through hook aliases; meaningful adapters keep distinct contracts.
- R016: Stores: `src/stores`; extracted utilities: `src/utils`. Direct files/optional domain subfolders, no mandatory nesting. Cohesive responsibilities, not dumping grounds.
- R018, R020: Kebab-case handwritten names; `.tsx` for JSX, `.ts` otherwise; respect framework/platform/generated filenames and feature-local helper ownership.
- R019: One renderable React component per file; JSX helpers/callbacks count; never nested. `.map()` to imported standalone components (key/props/local calculations) is composition, not a definition: no list wrapper. Verify imports; no local components/inline item markup. Extract/import preserving library signatures. Non-render callbacks aren't components.
- R021: Default exports for components/screens/pages/hooks/stores/services unless named exports materially improve the API.
- R022: 250/300 lines are cohesion signals, never a hard failure or forced split.
- R023: Asset directories stay static; runtime/config owns selection/environment logic.
- R024: Flat public `src/services/<domain>-service.ts` entrypoints; optional private helpers below `src/services`. No `src/api` migration or path-only facade. Generated SDKs keep their owner.
- R119, R120: KISS/DRY/narrow contracts; simple correct structure, stable abstractions and responsibility splits. No speculative frameworks, giant view models or wrapper chains; check consumers before removing superseded code.

### Components and control flow

- R025, R026, R027: Ordinary `const Component: FC<ComponentProps>`, named React `FC` import, not function declarations/`React.FC`/`FunctionComponent`. Generic type-preserving signatures/required class error boundaries exempt syntax only. Colocate `<ComponentName>Props` interfaces for real props; export only when consumed elsewhere, never empty interfaces.
- R028: Named parameters in ALL handwritten functions/callbacks; destructure inside the body, never object/array parameters. Preserve library signatures, not parameter-destructuring exemptions.
- R029: UI notifications (`onClose`, `onSelect`) and SDK callbacks are valid. Async commands expose `Promise<T>`, not `void` types/casts hiding completion. SDK signatures do not waive failure ownership.
- R030: Shared display props take resolved strings/ReactNode, not translation-key/options descriptors.
- R031, R032: Always explicit `<Fragment>` with named import; never `<>` shorthand or JSX IIFEs.
- R033, R034: Optional JSX uses boolean `&&`; collection guards `!isEmpty(items)`. Alternative views use early returns; preserve hook order and prevent raw `0`/text. Distinct render/layout variants require standalone components in separate files: e.g. `option-card` and `option-card-compact`. A flag coordinating direction, spacing, typography and alignment is two components combined, not a valid prop matrix. Split the variants; merely hoisting conditional values before JSX is not a fix. Compose existing base controls, never nested renderers or duplicated business logic. Ordinary selected/disabled state alone does not require a new component.
- R035: Ban runtime ternaries in function bodies, scalar/style variables, handlers/helpers and JSX children/returned views. Only a simple JSX property value may use a ternary, e.g. `scrollEventThrottle={onScroll ? 16 : undefined}`. This exception cannot select JSX/components, nest ternaries, hide business logic, or implement the multi-property render variants prohibited by R034. Refactor other owners with braced branches/early returns; no relocated ternaries, boolean-chain/IIFE or nested-renderer disguises. TypeScript conditional types are not runtime ternaries.
- R036, R037: Compute UI-only decisions/conditions component-local using state + data, not schemas/hooks. Render transformed fields. Braced flow before JSX except R035's simple JSX-property exception; split distinct render variants per R034 instead of computing a prop matrix. No trivial helpers. Quote literal attributes; brace dynamic values; preserve whitespace.
- CONTROL-FLOW-001, FE-KISS-001: Brace every `if`, `else if`, `else`, `for`, `for...of`, `for...in`, `while`, `do...while` body, even return/throw/break/continue. Retain `switch`, `try`, `catch`, `finally` blocks subject to error policy. Use braced guards over else chains; preserve precedence, independent decisions, hook order and cleanup. Prefer guards/lookups; exhaustive closed-state switch only when clearer. Do not flag trailing while of braced do/while or demand blocks around expressions. No evasive boolean chains/trivial helpers. Valid: `if (missing) { return }`.

### Types and absence

- R038, R039, R043: New handwritten enum members UPPER_SNAKE_CASE; preserve exact wire/native/storage/route/analytics values and generated casing. Legacy renames require compatible scope.
- R040, R041, DOMAIN-ENUM-001: Handwritten runtime enum declarations in `src/enums/`, not constants/services/schema files. Non-enum types, unions, schema validators and localized maps keep their actual owners.
- R042, R044: Closed statuses/types/modes: canonical enums, no magic strings/duplicates. Reuse generated enums; keep unknown external strings. Ban handwritten discriminated unions; only generated GraphQL unions allowed. Dialog variants: separate components, not tagged props/state. Plain unions valid. Storage keys/analytics events: standalone definitions, never shared/reused even if strings match. No enum per one-off key.
- R045, R046: Lodash required in UI/hooks/services/transforms/utils: `isNil`/`!isNil` for nullish checks; `isEmpty`/`!isEmpty` for collections, never length/truthiness. Preserve false/0, counts, exact absence/narrowing, tri-state/discriminants. No scalar `isEmpty`, redundant wrappers/boolean comparisons.
- R047: Mandatory `Nullish<T>` for application inputs/outputs/state/refs when null/undefined both mean absence; preserve reset/initial values and exact schema/persisted/library semantics. `?` means omission; `?: Nullish<T>` only if explicit null is valid too.
- R145: Prefer concise narrowing; postfix `!` needs immediately preceding `// AGENT: Explicit non-null assertion`, expression-scoped, no safety/cast waiver. Direct booleans/numeric comparisons; disabled safety lint is a gap.
- `??`: nullish fallback; `||` only if all falsy values mean missing. Keep false/0/empty string. Extendable objects: interfaces; unions/intersections/tuples/inference: aliases. `as const`: literal/readonly inference; `readonly T[]`: non-mutation; tuples: position/cardinality. Short clear mapping names valid; casts never validate.

### Navigation and UI

- R048, R049: Typed canonical route IDs/helpers; discoverable screen/page-owned params reused in route maps, not duplicated generated/central contracts.
- R050, R051, R052: Register route views once. Native: pushed details in app stack, roots in tabs, flow screens in bounded flows. Web: preserve supported router contracts. Required file-based route adapters stay with the framework; implementations use platform roots. No other no-op/re-export wrappers.
- R053: Layouts own application headers/Back/title/actions/dismissal for root/pushed/modal screens; no duplicate navigator headers. Required native chrome is a narrow evidenced exception.
- R054, R055: Simple registration, not speculative stack factories. Do not imperatively repeat account/access-driven transitions; separate destinations may be valid. Preserve freshness and Back history.
- R056, R057: Minimal serializable route IDs/options; no secrets/callbacks/entities/generic payload store. Actor-scoped drafts own reset/restoration; integration owns native handles. No-params only when no navigation-owned input exists.
- R058: All header/hardware/gesture Back and dismissal share flow decisions/accessible fallback. Block all applicable exits only when the operation requires it; preserve recovery identity.
- R059, R060: Never reinvent base components; new component groups compose existing controls. Extend owners. UI packages: public exports only. App components/theme adapters: `src/components`; real theme/type/behavior, no pass-throughs. Package exception: location only, other component rules apply. Native: Restyle color/spacing/typography tokens; web: existing styling, not Restyle. Brand tokens/assets/copy may vary; no monolithic framework.
- R061: Shared helpers for repeated platform decisions; `.ios`/`.android` owners for substantial differences. No wrappers for obvious isolated branches. Share business decisions, not forced web/native markup.
- R062, UI-LAYOUT-001: One direct/inherited layout owner for EVERY normal/loading/empty/unavailable/error/recovery screen/page. Shell, safe-area/keyboard/scroll policy, headers/footers, spacing/background and accessible state actions stay coherent. Variants need real presentation contracts; no duplicate padding/headers/scrolling or wrapper-only compliance. Lists may need non-scroll shells; fullscreen/native SDK boundaries may differ. Preserve subtree identity/focus/native handles.
- R063, R064: Parents own sibling spacing, children internal spacing, using supported tokens/APIs. Shared virtualized lists for large/growing collections; ordinary layout for small bounded lists. Stable IDs, explicit selection/render dependencies, immutable data and one scroll owner.
- R065, R066, R067: Explicit forms; shared fields own binding/label/errors, not a second parent-controlled form. Sheets/dialogs have one presentation/dismissal owner and narrow native-handle API. Custom triggers only for multiple surfaces; no redundant state/unused capabilities.
- One capability model controls access/visibility. One customer-specific sequence drives prerequisites, access, Back, progress and resume; invalid/future external destinations go to first valid incomplete step. Validate deep links/notifications and full submission again; retain safe cold-start destinations and deliberate login/logout/completion history.
- Layouts accommodate keyboard, translations and font scaling. Bound/wrap/stack dynamic text; no clipping/tiny fonts hiding defects; keep actions/icons reachable, ellipsis with full-value access. Preserve labels/roles/hints, disabled/selected/expanded/busy states, targets/focus; not color alone. Native text uses Text/typography; keyboard settings are not validation.

### Localization and forms

- R068, R069: No raw user-facing strings; update every enabled locale with interpolation parity. Reactive `useTranslation` in React; matching non-hook translator with explicit locale lifetime elsewhere.
- R070, R071, R072: Resolve strings/maps/arrays/enum labels at reactive presentation boundaries; no frozen module translations, localized persisted DTOs or display-key descriptors. Domain codes remain codes; translation APIs may accept keys. No factory per label or labels moved into enums.
- R073, R074: Local translated fallbacks, not large resolvers; remove newly dead keys after checking dynamic consumers.
- R075: Form owners use React Hook Form + Zod resolver and imported schemas, not inline screen/page/dialog schemas. Parent-controlled field collections are not new form owners.
- R078, R079: Static schemas; factories only for contextual validation. Handwritten Zod (forms/app shapes): `src/types/schemas.ts`; GraphQL inputs/enums/schemas: `src/generated/zod-schemas.ts`. No copied backend fields. `src/services/schemas.ts` is only a legacy re-export. Services validate boundaries, not just forms.
- R080, R081, R082: Use installed Zod APIs, no permanent major-version ceiling/speculative upgrades. Reuse exact generated schemas or concise pick/omit preserving semantics; no pass-through wrappers. Preserve real field/constraint differences.
- R083, R084, R085, R086: Compute data fields (fullName) only in schema `.transform`; consume outputs, never recompute in UI/hooks/helpers/useMemo. Correct input AND output form/resolver types. No duplicate validation for wording; reactive locale/error copy in presentation, structural service validation.

### Services and state

- R087: Stateless facades live app-wide; actor/auth/tenant context is request-current. Stateful/native resources need scoped lifetime/teardown.
- R088, R089, R092: Reuse canonical GraphQL operation inputs/results and available generated types. Services use `graphql` from `@/generated`, await `gqlExec` from `@/utils/gql-exec`, parse app shapes. Select every consumed field; no gratuitous DTOs. Regenerate GraphQL/Zod with configured `dtools graphql generate`; never hand-edit outputs or assume its endpoint.
- R090, R091: `gqlExec` owns auth/tenant headers, transport, preview isolation and failure/session classification. Services own runtime response validation. Preserve session generation/captured targets. Zod at external/persisted/URL/form boundaries, not trusted UI solely for typing. Typed documents are not runtime validation.
- R093, R094, R095: Preserve omission/null/false/0/data/time. Locale/timezone/date/price labels: reactive presentation, never persisted. No transformed Account mirror. Backend legal/invoice text: external content.
- R096, R097: Domain hooks expose loading/error/availability; list defaults cannot hide required lookup failure. Exact GraphQL detail query, not one list page; validated required data or failure. Query keys include ALL response-shaping actor/tenant/resource/locale/filter/eligibility inputs, not just family enums. `enabled` for prerequisites, no placeholder IDs.
- R098, R099: Reactive label maps, not forwarding helpers. Mutation owner completes targeted cache-family work before progression; broad clearing only for session teardown, no nominal cache wrappers.
- R100, R101: Coordinate conflicting writes per actor/resource; publish current authoritative responses only. Pending flags/serial scopes are not server idempotency/global serialization. Await required durable success; submitted != paid/delivered/ownership-resolved. Preserve drafts/uncertain outcomes/recovery identity.
- R115, R116: Zustand in-memory actions, no persist middleware/storage I/O. All storage I/O via typed `StorageService` (`src/services/storage-service.ts`): durability/hydration/migration. Await restoration before access; preserve drafts/journals/actor selection.
- R117, R121: Canonical keys. Each read: `tryGetX` returns undefined only for `isNil(raw)`; `requireX` parses directly, missing fails. Both schema-parse decoded values; malformed/schema/I/O errors fail, never fallback. Platform-secure credentials/sensitive drafts/recovery; JSON/AsyncStorage not validation/encryption. Migrate/serialize; no passwords/short-lived secrets. Clear actor state/cache/subscriptions/storage per session contract.
- R118, ZUSTAND-READ-001: Named Zustand actions/accessors. External `.getState()`/`.setState()` need `// AGENT: Explicit direct accessor`; selectors/useShallow/selector wrappers need `// AGENT: Explicit store selector`. Whole-store subscriptions only; destructure results. Exact tag immediately before that call only, not file-wide/interchangeable. No performance exemption; never suggest tags to evade policy. Preserve Account ownership/persistence/reactivity. Internal get/set valid. Derive UI state; retain `data`/`computed`, equality/updates; no forced reshaping.

### Async and React lifetime

- R102, ERROR-OWN-001: Handwritten `try/catch` needs immediately preceding `// AGENT: Allowed Try-Catch`, that catch only. Never suggest tags to evade policy; no implicit boundary/SDK/analytics exemption. Cleanup-only `try/finally`, preserve release timing, never success in `finally`. Fail fast except analytics: propagate rejection; single owner, no disguised success, duplicate reporting or unobserved rejections.
- R103: Gate required one-time prerequisites only; ongoing/paginated queries remain mounted with loading/error/retry and actor/cancellation ownership.
- R104, R105: Hooks own error classification/toasts/cache; callers navigation/interaction analytics. `onError` cannot consume `mutateAsync` rejection: verify final Promise observer. Safe domain copy, not raw backend errors/success-shaped fallbacks.
- R106, R107, R108, R111: Domain-named awaited commands (`save: mutateAsync`); typed results, rejection stops close/navigation/success. Check result failures; fence stale actor/attempt. No per-trigger UI mutation success/error callbacks. Optional `runAppTask`/result envelopes preserve values/errors, not timeout/cancellation/idempotency/payment reconciliation/ownership guarantees.
- R109, R110: Except analytics, await async services/network/storage/required cache work; `await Promise.all(...)` allows concurrency. No other fire-and-forget/void suppression/detached chains. Sync notifications need no await; event/SDK boundaries need a promise owner.
- R112, R113, R114: Ban handwritten `console.*`, even logger/dev. Shared structured logger: almost never, only essential redacted events. Analytics: canonical events/shared interface, one owner, correct actor/target/timing. Non-awaited nonthrowing `void` submission; boundary absorbs sync/async errors, no unhandled rejections/user-flow failure. Submission != delivery.
- EFFECT-OWN-001: Minimum source state; derive UI state, no stored JSX/mirrored derived state. Effects synchronize external systems; events/domain operations own user sequences. Honest dependencies, symmetric cleanup on change AND unmount, stale-result fences. No run-once refs hiding reactive state. Preserve dirty drafts, identity resets and polling/restoration/other-device completion; effect/setter counts prove nothing. Keyed resets preserve intended focus/keyboard/handles; no render-time navigation/cache writes/SDK calls. Layout effects require pre-paint timing; external stores need coherent snapshot/subscription APIs. Hooks need meaningful behavior, not relocated code.
- Preserve controlled/uncontrolled and component/key identity. No index keys for mutable items. Memoization needs measured cost or required identity, not habit; verify React/compiler/library versions. Props express narrow required contracts, not hidden optional modes or giant screen-wide objects.

### Formatting, types and lint

- R142: Prettier: 100 columns, two spaces, no tabs/semicolons, double quotes, es5 trailing commas, bracketSpacing true, bracketSameLine false; separate check/write tasks.
- R143: Strict TypeScript; `@/*` must map to application `src/*` in TypeScript and bundler/test resolvers, never the repository root even if imports work. Align scope/options; generated/native toolchains cannot waive this mapping. Introduced mismatches: architecture, not unproven resolution failures.
- R144: Maintained-source lint; remove unused bindings/imports, agreed underscores for intentional unused params; explicit generated/vendor exclusions and rollout gaps. Type-only bindings use `import type`; preserve runtime/side-effect imports, decorator metadata and transform contracts. Ambiguous imports need semantic evidence.

### Native lifecycle

Mount, screen focus and AppState foreground differ; hidden screens may stay
mounted. Cleanup listeners/timers/tasks by owner; stable focus callbacks need honest
dependencies. Configure query focus/connectivity once; offline UI is not reconnect
wiring. Use resource freshness, not duplicate mount/focus/resume fetches; scope
polling, preserve app-wide work.
Timers are best-effort; authoritative timestamp deadlines survive restart.

Permissions/SDKs have one owner: request when needed, validate platform support,
model denied/settings-required/canceled/completed/failed outcomes,
recheck OS state on return, deduplicate callbacks. No render-time initialization;
global setup survives repeat restore/dev invocation. Recover uncertain operations
from authority, not cached pending flags; retain HTTPS/credential checks and fences.

Before deletion check hidden consumers: Expo/file routes, native registrations,
dynamic/string imports, plugins, assets/fonts, Babel/Metro and package exports.
Follow generated/config-plugin ownership. Native dependencies/permissions/
entitlements need compatible builds; OTA cannot add unsupported binary features.
Preserve schemes, routes, stored IDs and native contracts absent explicit migration.

## Verification

Verify actual manifest/scripts, typecheck, non-mutating lint/format,
relevant tests and affected GraphQL contracts; native builds/device acceptance
are separate. Effect/lifecycle changes need mounted tests executing effects, not
static markup or mocked effects. Check loading/error/retry/cancel, deep links/Back, dirty drafts,
actor switches/restoration, offline/resume, permissions, keyboard/font scaling
and VoiceOver/TalkBack. Measure performance in representative release builds.
Analyzer candidates need classification and fresh source/config/tool
fingerprints. Partial/empty output or report execution is not whole-rule
compliance. Never invent passing tests, tool execution or approved exceptions;
record missing evidence, never drop requirements.
