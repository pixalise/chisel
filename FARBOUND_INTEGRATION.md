# FARBOUND Integration Contract

## Status

This document records the Chisel-side authoring and export contract required by FARBOUND’s current vertical-slice specifications. It is a design and migration contract only; it does not claim that the described schemas or validation rules are implemented.

Authoritative gameplay meaning lives in the sibling FARBOUND documents:

- ../farbound/NORTH_STAR.md
- ../farbound/CARDS_LOADOUT_INVENTORY_SYSTEM_SPEC.md
- ../farbound/STORY_AND_NARRATIVE_FOUNDATION.md
- ../farbound/STYLE_GUIDE.md
- ../farbound/VERTICAL_SLICE.md
- ../farbound/architecture.md

Chisel remains a generic editor. FARBOUND-specific authored schemas are project data, while reusable reference validation, export, asset, localization, and migration behavior belongs to Chisel.

## Responsibility Boundary

### Chisel owns

- Immutable authored definitions.
- Stable slugs and table identities.
- Typed fields and reference relationships.
- Localization references.
- Managed asset references.
- Schema and cross-reference validation.
- Committed authoring state.
- Validation-gated, self-contained generated exports.

### FARBOUND runtime owns

- Installed upgrade instances.
- Equipment and Relicant host instances.
- Current Capacity and mastery progression.
- Personal-pack and Waywagon-cargo contents.
- Quick-use assignment.
- Learned player abilities.
- Available combat-card pool.
- Enabled combat deck.
- Draw pile, hand, discard pile, retention, and searches.
- Encounter state.
- Target defeat and post-combat disposition.
- Save snapshots and derived-state rebuilds.

Generated data is immutable runtime input, not a live content database and not save state.

## Current FARBOUND Project Audit

The current **.chisel** project contains placeholder tables:

- **cards** has name, description, and portrait only.
- **items** has name, description, icon, and fixed **card_1**, **card_2**, and **card_3** references.
- Both tables currently contain no rows.

That shape cannot express the approved system because:

- It collapses upgrade cards and combat cards into one ambiguous category.
- Three fixed card columns impose an arbitrary contribution limit.
- It cannot express learned abilities, equipment-native actions, upgrade-granted actions, or replacements.
- It cannot express upgrade ranks, Capacity costs, host tags, compatibility, or effect family.
- It makes source tracing and validation dependent on column position.
- It does not distinguish physical consumables from buildcraft.

The placeholder tables should be migrated or replaced when implementation begins. They must not remain beside the authoritative schema as a compatibility model.

## Locked Semantic Taxonomy

| Definition family       | Authored meaning                                                                                    | Runtime behavior                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Upgrade card            | Modular change installed into a compatible host                                                     | Consumes Capacity; never shuffled or drawn                                        |
| Combat card             | Reusable combat action                                                                              | Only definition family allowed in the enabled combat deck                         |
| Learned ability         | Permanent Relicant unlock of a combat card                                                          | Contributes a sourced combat card without a socket unless an upgrade grants it    |
| Equipment-native action | Combat card exposed by equipped gear                                                                | Exists while the equipment source is active                                       |
| Upgrade-granted action  | Combat card exposed or replaced by an installed upgrade                                             | Exists while the upgrade source is installed                                      |
| Physical item           | Object carried in personal pack or Waywagon cargo                                                   | Never becomes a card merely because it is configurable                            |
| Consumable              | Physical item that can be assigned to quick use                                                     | Separate rail; consumed on activation; never counts toward deck size              |
| Contextual requirement  | Knowledge, evidence, magic, reputation, relationship, contract, law, facility, or state requirement | Derives a direct option; not shuffled unless it explicitly grants a combat action |

Cards are universal buildcraft. Only combat cards are card play.

## Proposed Definition Families

Exact table names may follow the project’s established naming policy, but the semantic separation and reference direction are required.

### host_families

Defines reusable upgrade-host bounds.

Required concepts:

- Stable slug.
- Localized name and description.
- Host category.
- Compatibility tags.
- Fixed socket count.
- Starting Capacity.
- Standard mature Capacity.
- Whether the host can contribute native combat actions.

Initial character rows:

| Host               | Sockets | Starting Capacity | Mature Capacity |
| ------------------ | ------: | ----------------: | --------------: |
| Relicant           |       6 |                10 |              18 |
| Primary weapon     |       4 |                 6 |              12 |
| Secondary/off-hand |       3 |                 5 |               9 |
| Headgear           |       2 |                 3 |               6 |
| Torso armor        |       3 |                 5 |               9 |
| Arms               |       2 |                 3 |               6 |
| Legs/boots         |       2 |                 3 |               6 |
| Relic/implement    |       3 |                 5 |               9 |
| Field device       |       2 |                 3 |               6 |

Waywagon facilities, companions, vehicles, businesses, and special implements use the same host grammar with separately authored bounds.

### upgrade_cards

Required concepts:

- Stable slug.
- Localized name and description.
- Managed UI artwork.
- Upgrade family or progression family.
- Rank, normally 1–3.
- Capacity cost.
- Compatibility tags.
- Effect family: Enhancement, Behavior, or Capability.
- Effect definition or explicit reference to a typed effect record.
- Optional granted or replaced combat action through normalized relation tables.

Upgrade effects must not be encoded as arbitrary prose that runtime code repeatedly interprets. The effect vocabulary can begin with only the typed operations needed by the vertical slice.

### combat_cards

Required concepts:

- Stable slug.
- Localized name and description.
- Managed UI artwork.
- Action-resource cost.
- Combat tags.
- Typed effect or action definition.
- Targeting contract that does not introduce tactical positioning.
- Any encounter-state requirements.
- Presentation metadata that remains non-authoritative.

A combat card definition does not own its runtime source. The same definition may be contributed by different equipment, learned abilities, or upgrades.

### equipment

Required concepts:

- Stable slug.
- Localized name and description.
- Managed UI artwork.
- Host-family reference.
- Equipment tags.
- Starting Capacity or mastery profile where it differs from the host-family default.
- Physical pack footprint when unequipped.
- Trade and rarity metadata needed by the slice.

Equipment-native combat actions use relation rows rather than numbered columns.

### physical_items

Required concepts:

- Stable slug.
- Localized name and description.
- Managed UI artwork.
- Item category.
- Personal-pack footprint.
- Stack rules.
- Cargo eligibility.
- Trade metadata.
- Consumable behavior reference when applicable.

Upgrade cards are buildcraft definitions, not ordinary pack items. If an upgrade requires a physical prerequisite object, that prerequisite is represented explicitly as a physical item.

### Normalized contribution relations

Variable-length relationships should use rows with scalar references so the exporter can validate every edge and the runtime can enumerate contributions without special column names.

Recommended relation families:

- **equipment_combat_actions:** equipment → combat card.
- **upgrade_combat_grants:** upgrade card → granted combat card.
- **upgrade_combat_replacements:** upgrade card → replaced combat card + replacement combat card.
- **learned_abilities:** learned-ability definition → combat card.
- **loadout_preset_equipment:** preset + equipment slot → equipment.
- **loadout_preset_upgrades:** preset + host source + socket order → upgrade card.
- **loadout_preset_deck:** preset + combat card + source selector → enabled entry.
- **loadout_preset_consumables:** preset + quick-use slot → physical consumable.

A relation table may include order, quantity, requirement, or source-role fields when those concepts are genuinely authored. Do not add generic JSON escape hatches merely to avoid defining a small typed relation.

### Brass Winter content families

The vertical slice will also require immutable definitions for:

- Three lodge-aligned loadout presets.
- The Brass Winter contract and objective graph.
- Nested Reach, regional, and local-map entries.
- Local tiles or authored/semi-authored map layout.
- Illustrated events and two-to-four-choice option sets.
- Evidence and knowledge facts.
- Maintenance-organism encounter.
- Creature intent and one creature-specific state.
- At most one prominent environment rule.
- Direct-resolution requirements.
- Post-combat disposition requirements and outcomes.
- Market, auction, provision, or cargo choice.
- Persistent aftermath facts.
- Localization and managed assets for every player-facing definition.

These content families should reuse general schema capabilities. Chisel should not gain a special hard-coded Brass Winter subsystem.

## Tags And Compatibility

Upgrade sockets are generic. Compatibility is controlled by authored host and upgrade tags.

The first tag vocabulary should be small, closed, and legible. Examples may include weapon, armor, sensory, mobility, defensive, restraint, implement, field-device, Relicant, companion, and facility, but the final vocabulary belongs to authored project data.

Validation must establish that an upgrade has at least one legal host in the committed content set unless it is explicitly marked for future or scenario-only use.

Do not add:

- Polarity colors.
- Decorative socket types.
- Per-host installation mini-languages.
- Implicit compatibility inferred from display names.
- Runtime comparisons against localized prose.

## Stable Identity And Source Tracing

Every definition uses a stable slug. Generated table indexes are dense runtime projections and may change after content edits.

A runtime source trace combines immutable definition identity with authoritative instance context. For example:

- Combat card definition: **BRACE**.
- Source kind: equipment-native action.
- Source definition: **IRONWARD_BUCKLER**.
- Source instance: the currently equipped off-hand instance.

Or:

- Combat card definition: **BINDING_SHOT**.
- Source kind: installed upgrade.
- Source definition: **RESTRAINT_COIL_RANK_2**.
- Host instance: the currently equipped primary weapon.
- Installation slot: authoritative runtime socket index.

Chisel exports the stable definitions and reference graph. FARBOUND creates and saves instance identity.

The generated contract must make it possible to:

- Enumerate all combat actions native to equipment.
- Enumerate all actions granted or replaced by an upgrade.
- Resolve every reference before hot gameplay loops.
- Inspect stable slugs for debugging and save migration.
- Rebuild the available pool after loadout changes.
- Explain why a combat card or contextual option exists.

## Validation Contract

Export should be blocked by:

- Duplicate or invalid slugs.
- Missing required translations or assets.
- Missing or category-invalid asset references.
- Unresolved table references.
- Upgrade rank outside the authored family’s supported range.
- Non-positive or invalid Capacity cost.
- Host socket or Capacity bounds outside accepted schema constraints.
- Upgrade compatibility with no legal host, unless explicitly permitted.
- Combat action relation pointing to an upgrade-card definition.
- Upgrade installation preset pointing to a combat-card definition.
- Consumable included in an enabled-deck preset.
- Enabled preset deck below 7 or above 20 combat cards.
- Duplicate preset equipment slot or quick-use slot.
- Quick-use preset above four assignments.
- Learned ability that points anywhere except a combat card.
- Replacement relation with an invalid or identical replacement edge.
- Cyclic or unreachable required objective relationships.
- A declared Brass Winter ending with no reachable authored requirement path.

Warnings may cover unusual but legal design choices such as a high Capacity cost, a loadout with no free socket, or a combat card with only one available source.

Validation messages must name the table, row slug, field or relation, and corrective action.

## Export Contract

The FARBOUND export uses the LÖVE target.

A successful export must be self-contained under **gamedata** and include:

- One generated Lua module per authored table.
- Manifest entries for every generated table.
- Stable row constants and **SLUGS**.
- Dense arrays for fields and resolved references.
- Generated localization data.
- Generated semantic input data when configured.
- The standalone lazy AssetManager and managed asset tree.
- Resolved approved terrain and spatial dressings in `gamedata/terrain.lua` when terrain system tables are present.
- No dependency on Chisel being installed or open.
- No raw editor-document parsing at runtime.

The generated AssetManager remains the only runtime path to managed assets. UI imagery uses the **UI** category, not legacy **UI_ICON**. Replacing a managed asset source preserves its stable slug and generated category ID contract.

Tables describe immutable definitions; the AssetManager owns lazy resource loading. Neither one owns mutable gameplay state.

## Migration From Placeholder Tables

When implementation is authorized, migrate in one coherent content change:

1. Introduce the distinct definition and relation tables.
2. Move any real rows from generic **cards** into the correct upgrade-card or combat-card family.
3. Replace **items.card_1**, **items.card_2**, and **items.card_3** with normalized contribution rows.
4. Separate physical items and consumables from installed buildcraft.
5. Add host-family and compatibility data.
6. Add three lodge-aligned loadout presets.
7. Validate all references and preset bounds.
8. Export the complete FARBOUND **gamedata** projection.
9. Remove the superseded generic tables and generated modules in the same change.

Do not keep both old and new schemas as parallel authorities.

## Vertical-Slice Acceptance

The Chisel content contract is sufficient for the slice when a committed project can author and validate:

- Eight equipment host families and the Relicant host.
- Upgrade rank, Capacity, tags, and compatibility.
- Equipment-native, learned, and upgrade-granted combat-card sources.
- Approximately 20–24 available prototype combat cards.
- Three lodge-aligned starting loadouts.
- A 7–20-card enabled deck per preset.
- A 4×6 pack definition and four-slot quick-use assignments without treating either as a deck.
- One Brass Winter encounter with intent, creature state, environment rule, defeat, retreat, and disposition references.
- Kill, repair/help, capture/study/tame, and expose/negotiate outcome families.
- One market or cargo choice and persistent aftermath.
- Complete localization and managed-asset references.
- A validation-gated, self-sufficient LÖVE export.

The authoring model is correct only if the runtime can explain every combat card, upgrade effect, and contextual option through an explicit source.
