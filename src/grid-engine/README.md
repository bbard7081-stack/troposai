# Grid Engine Charter (v1.0)

This document defines the authoritative behavior and technical contract for the `GridEngine`. Adherence to these rules is mandatory to maintain system stability and prevent data corruption.

## 🧠 Core Architecture
- **Engine-First Design**: `GridEngine` is the single source of truth for all contact data.
- **One-Time Hydration**: Backend data is fetched exactly once at startup and sealed into the engine.
- **No Rehydration**: Polling, SSE, and backend push updates are permanently disabled.
- **Backend = Side Effect**: API responses never overwrite engine state.

## ✏️ State Management
- **Immutable Snapshots**: Every update produces a new snapshot (structural sharing preserved).
- **Structural Sharing**: Only changed rows are recreated; unchanged rows keep references.
- **Deterministic Ordering**: State changes are applied synchronously and predictably.

## ✍️ Single Write Authority
All mutations **must** go through:
```typescript
engine.updateContact(rowId, partialUpdate, source)
```
- **No direct API writes** from UI components.
- **Supported Sources**: `grid`, `profile`, `call`, `system`.
- Each mutation is source-tagged and logged for audit/debugging.

## 🔄 Safe Backend Sync
- **Queued Operations**: Changes are queued in an internal `saveQueue`.
- **Debounced Flushing**: Writes are debounced (1s idle) and grouped per row.
- **UI Independence**: Backend sync never blocks the UI and never overwrites engine state.

## 🧩 Shared Read Model
The following surfaces consume the same live engine snapshot:
- **Grid UI** (`ReadOnlyGrid`)
- **Client Profile** sidebar
- **Dashboard** metrics
- **Reports**
- **Call / VoIP panel**
- Edits in any surface propagate instantly to all others.

## ⏪ History / Undo / Redo
- **Engine-Level**: Deterministic history stack (not UI-state-based).
- **Bounded Depth**: Last 50 states.
- **Backend-Aware**: Diffs are computed automatically during `undo()`/`redo()`, and reverted values are synced back to the backend.

## 🚦 Non-Negotiable Rules
1. **All Reads** → `useGridEngine().snapshot`
2. **All Writes** → `engine.updateContact(...)`
3. **No direct API writes** for contact data.
4. **No re-introducing polling or SSE.**

---
*The Grid Engine is production-grade and stable. Direct bypass of this architecture will re-introduce state synchronization bugs.*
