
# Routine Module — Engineering Audit

Scope: read-only inspection of the Routine module from data creation through UI rendering. No code changes, no patches. Focus: why Planned still shows 24h 25m.

---

## 1. Task creation

**Manual Add Task** — `addTask()` in `src/lib/tasks-store.ts`
- Input: `{ time, endTime?, title, note?, repeat? }`
- Output: appends a new `Task` with a UUID; `completed: false`.
- Data shape: `Task { id, time:"HH:MM", endTime?:"HH:MM", title, note?, completed, repeat? }`.
- Corruption points:
  - `time` / `endTime` are stored **verbatim** — no regex validation, no ordering check. A user (or a bad form) can save `time: "24:00"`, `endTime: "  "`, `endTime: "13:30 PM"`, or `endTime` earlier than `time` without meaning cross-midnight.
  - `endTime: ""` is coerced to `undefined` (safe), but `endTime: " "` (a space) survives — `input.endTime || undefined` treats it as truthy.

**Edit Task** — `editTask()` / `editTaskToday()`
- Same validation gap as `addTask`. `editTaskToday` writes a `TaskException` overlay for recurring tasks; overlays share the same lack of time validation.

**AI Routine Generation** — `generateRoutine` in `src/lib/ai-routine.functions.ts`
- Correctly validates: `TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/`, rejects `dur <= 0 || dur >= 24*60`, uses cross-midnight–aware `durationMin`, drops overlapping AI blocks. ✅
- This path cannot produce a 24h task.

**Recurring** — `Repeat` union stored on the template; per-day exceptions live in a separate store. No transformation of `time`/`endTime` on creation.

---

## 2. Task storage

- `dailyos.tasks.v1` — active templates + one-offs (`tasks-store.ts`).
- `dailyos.task-completions.v1` — `{ [dateKey]: string[] }` overlay per recurring task.
- `dailyos.task-exceptions.v1` — `{ [dateKey]: { [taskId]: {skipped?, time?, endTime?, title?, note?} } }`.
- `dailyos.routine-archive.v1` — snapshots written by `startNewRoutineDay`.
- Archives are **not** re-injected into `useTasks()` — verified. ✅

Corruption points:
- Exception overlay stores raw `time`/`endTime` strings; same validation gap as `addTask`.
- No migration/repair pass ever runs against `dailyos.tasks.v1`. Legacy corrupt rows (e.g. `endTime: "13:30 PM"`, `endTime: "1:30"` meant as PM) live forever.

---

## 3. Task loading — `useTasks()`

Pipeline (`tasks-store.ts`, lines ~155–200):
1. Read `cache` via `useSyncExternalStore`.
2. For each raw template: `taskShowsOnWeekday` gate → skip.
3. If recurring: fetch `getException(id, todayDateKey)`; skip if `ex.skipped`.
4. `applyException` overlays `time/endTime/title/note`.
5. Completion overlay via `isCompletedOn`.
6. Sort by `a.time.localeCompare(b.time)`.

Verified:
- Each active template surfaces **exactly once**. No duplication.
- Archived tasks live in a different store; not merged in. ✅
- Yesterday's snapshot is never re-added.
- Filtering is by JS weekday (`today.getDay()`), **not** by the 3 AM routine-day boundary. This is a separate known asymmetry (weekday flips at midnight, not at 3 AM), but it does not inject foreign tasks — it only changes which recurring templates render for the ~3-hour late-night window.

Then in `routine.tsx` (line 137): `const tasks = [...rawTasks].sort(late-night rule)` — new array, same references. No duplicate insertion. ✅

---

## 4. Duration calculation

`toMinutes(hhmm)` (`routine.tsx` 23–36):
- Trims, uppercases, peels an optional trailing "AM"/"PM", parses `H:MM`.
- Applies 12h→24h correction if AM/PM present.
- Clamps to `[0, 1440)` via `((total % 1440) + 1440) % 1440`.
- Empty string → `0`. Non-numeric parts → `0`.

`rawDurationMin(t)` (54–62):
- No `endTime` → default `30`.
- `diff = end - start`.
- `diff > 0` → same-day duration.
- `diff === 0` → 0.
- `diff < 0` → `diff + 1440` (cross-midnight wrap).
- Output is bounded by construction to `(0, 1440)` in the wrap branch, so no single task can return ≥1440.

**Proof `rawDurationMin` cannot return exactly 1440:**
- `toMinutes` outputs are both in `[0, 1440)`, so `end - start ∈ (-1440, 1440)`.
- `> 0` branch returns `≤ 1439`.
- `=== 0` branch returns `0`.
- `< 0` branch returns `diff + 1440 ∈ (0, 1440)`, i.e. `≤ 1439`.
- ∴ a single task contributes ≤ 23h 59m; 24h+ totals must come from **multiple** tasks or from a task the code semantically classifies as cross-midnight even though the user meant same-day.

Cross-midnight handling: correct math, but semantically ambiguous — the code cannot distinguish "user intended a 90-minute block and typed the times backwards" from "user intended 22h 30m". Every `end < start` is treated as cross-midnight.

Routine-day normalization (`routineMinFactory`, `taskLateNightOffset`) is **only** used for ordering, active/missed detection, and the "You are here" divider. It is **not** applied to `rawDurationMin`. ✅

---

## 5. Dashboard summary (Done / Left / Planned / Progress)

`routine.tsx` 152–219:
- `total = tasks.length` — the sorted, overlay-applied list from `useTasks()`.
- `done = tasks.filter(completed).length` — correct.
- `pct = done/total * 100` — correct.
- `plannedBreakdown = tasks.filter(t => !!t.endTime).map(rawDurationMin)`.
- `plannedMin = Σ dur`.

Verified:
- Source array is the **same** list rendered in the timeline (`tasks`). No second call to `useTasks`, no re-inclusion of archives, no yesterday leak.
- Each task counted at most once (`filter` + `map` on the same array).
- Uses the same `rawDurationMin` as each task card → totals are **guaranteed** to equal the sum of the durations rendered on the cards.

Consequence: **if Planned looks wrong, the individual cards are also wrong** — the summary is a faithful reducer.

---

## 6. NOW card

- `taskMeta` uses `getTaskEndMinutes` and `rawDurationMin` in routine-day space.
- `isActive`/`isMissed` compare `nowRoutineMin` against `[rStart, rEnd)`.
- Correct behavior for cross-midnight ✅. Cross-midnight tasks whose `end - start + 1440` is inflated will also show a wrong "left" duration — same root as Planned.

---

## 7. Free Time

- Derived from `nextIdx` and `minsUntil = rStart - nowRoutineMin`, in routine-day space.
- Correct wrt cross-midnight ordering. No dependency on `plannedMin`.

---

## 8. Start New Day — `startNewRoutineDay()`

- Snapshots today, writes archive, calls `clearCompletionsForDay(todayKey)`, drops completed one-offs, keeps recurring templates.
- Guarded by `lastStartNewDayKey` (same-key re-entry no-op) and `startNewDayInFlight`.
- Does **not** touch `dailyos.tasks.v1` for surviving items → any corrupt `endTime` field persists after Start New Day.

---

## 9. Archive flow

- Archive store is not read by `useTasks()`. No leak. ✅

---

## 10. Yesterday Recap

- Reads `getSummaryFor(yKey)` from `daily-summary-store`, not from the active `tasks` cache. Does not influence `plannedMin`.

---

# Findings

### ✅ Correct modules
- AI generation validator (`ai-routine.functions.ts`).
- `useTasks()` scoping to today (weekday + overlay + completion).
- Archive isolation from `useTasks()`.
- Free Time / Next-up / You-are-here (routine-day space).
- Planned reducer arithmetic — a faithful sum of visible-card durations.
- `startNewRoutineDay` idempotency guards.

### ⚠ Suspicious modules
- `toMinutes` accepts AM/PM suffixes to "self-heal" legacy strings. This silently rewrites `"1:30 AM"` (which some code paths may have stored intending 1:30 PM) — the healer is opinion, not truth.
- Weekday filter uses `Date().getDay()` (midnight boundary) instead of the routine-day (3 AM) boundary. Cosmetic during the 12–3 AM window, but inconsistent with the rest of the module.
- `addTask` / `editTask` / `editTaskToday` / exception overlay accept unvalidated `time`/`endTime` strings. There is no invariant that `endTime > time` for non-cross-midnight blocks.
- `endTime: " "` (whitespace) is truthy → `rawDurationMin` runs and `toMinutes(" ") = 0`, silently producing a cross-midnight wrap for any daytime task.

### ❌ Confirmed bugs (present in code, independent of the 24h 25m symptom)
1. **No time validation on write.** `addTask`, `editTask`, `editTaskToday`, and the exception store all accept any string. A single bad `endTime` mutates duration, NOW-card countdown, and Planned in lockstep. Confidence: 100%.
2. **`endTime` truthiness check is `input.endTime || undefined`.** Whitespace / non-HH:MM strings survive as "has endTime", entering `rawDurationMin` and often triggering the cross-midnight branch. Confidence: 100%.
3. **`rawDurationMin` treats every `end < start` as intentional cross-midnight.** There is no "was this obviously a data-entry mistake?" heuristic. A user editing "12:00 → 13:30" who leaves the AM/PM selector on AM (`endTime: "01:30"`) gets 13h 30m rather than an error. Confidence: 100% (previously observed in the debug log).
4. **`toMinutes` AM/PM salvage is not documented as an invariant.** Any code path that writes `"H:MM AM/PM"` strings will be silently reinterpreted; any path that assumes strict 24h will disagree. Confidence: high — the healer exists precisely because at least one write path produced non-24h strings historically.

### 🔥 Root-cause confidence for "Planned = 24h 25m"

- **95%** — At least one task in today's rendered list has a `time`/`endTime` pair that `rawDurationMin` interprets as cross-midnight (i.e. `end ≤ start` after `toMinutes` normalization) but which the user did **not** intend to span midnight. The Planned reducer then adds ~24h to the sum. The console `[Planned]` log emitted by the existing instrumentation identifies the offender directly (look for a `dur` entry near 1400+).
- **5%** — Two or more genuinely cross-midnight blocks overlap in wall-clock time and their durations happen to sum to ~24h 25m (mathematically possible; unlikely in a normal daily routine).

Ruled out (with evidence in this audit):
- Yesterday's tasks leaking in (archive store is isolated; `useTasks` filters by today).
- Duplicate insertion (sort creates a new array; each task appears once).
- Weekday/timezone shift injecting extra rows (weekday filter only *removes*, never adds).
- Summary using a different reducer than the cards (both call `rawDurationMin`).
- A single task returning ≥1440 minutes (proven impossible above).

---

## Answer — the single most likely reason Planned still shows 24h 25m

**One task in today's routine has an `endTime` that is less than or equal to its `time` after `toMinutes` normalization, so `rawDurationMin` classifies it as a cross-midnight block and adds 1440 minutes. It was not meant to be cross-midnight — most commonly an AM/PM mistake on `endTime` (e.g. `endTime: "01:30"` when the user meant 1:30 PM), a whitespace / malformed `endTime` that `toMinutes` collapses to `0`, or the user swapping start and end on an evening block. The Planned reducer faithfully sums the card durations, so a single ~24h card is enough to inflate the total from ~25m to 24h 25m.**

The existing `[Planned] … breakdown` console log will name the offending task on the next render — its `dur` field will be ≥ ~1400.
