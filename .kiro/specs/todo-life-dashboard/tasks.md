# Implementation Plan: To-Do List Life Dashboard

## Overview

Implement a zero-dependency, client-side single-page dashboard using plain HTML, CSS, and Vanilla JavaScript. The application is delivered as three files (`index.html`, `css/style.css`, `js/app.js`) with no build step. Widgets are initialized on `DOMContentLoaded` and all state persists via `localStorage`.

---

## Tasks

- [x] 1. Set up project structure, HTML skeleton, and CSS foundation
  - Create `index.html` with semantic landmark elements: header card, 2-column main grid (timer + tasks), full-width quick links card, and footer with theme toggle
  - Add an inline `<script>` block before `</head>` for FOUC-free theme application (reads `localStorage` directly, sets `data-theme` on `<html>`)
  - Create `css/style.css` with all CSS custom properties for light theme (`:root`) and dark theme overrides (`:root[data-theme="dark"]`), base reset, layout classes (`.dashboard-container`, `.header-card`, `.main-grid`, `.full-width-card`), and responsive breakpoint (`@media (max-width: 640px)` → single column)
  - Create `js/app.js` with the top-level `App` namespace object and an empty `App.init()` wired to the `DOMContentLoaded` event
  - _Requirements: 10.1, 10.4, 8.4, 8.5_

- [x] 2. Implement StorageManager
  - [x] 2.1 Implement `StorageManager` module with `isAvailable()`, `get(key)`, and `set(key, value)` methods
    - `isAvailable()` probes `localStorage` with a test write/read/delete and returns `boolean`
    - `get` wraps `JSON.parse`; returns `null` on any parse error or missing key without throwing
    - `set` wraps `JSON.stringify` + `localStorage.setItem`; returns `true` on success, `false` on `QuotaExceededError` or any other exception
    - Both `get` and `set` dispatch a custom `storage-error` DOM event on failure so widgets can display error messages without coupling to `StorageManager` internals
    - _Requirements: 9.1, 9.2, 9.7, 10.3_

  - [ ]* 2.2 Write property test for StorageManager corruption recovery
    - **Property 16: localStorage corruption recovery returns default and does not throw**
    - **Validates: Requirements 9.7, 10.3**

  - [ ]* 2.3 Write property test for username persistence round-trip
    - **Property 14: Username persistence round-trip**
    - **Validates: Requirements 2.6, 2.7**

- [x] 3. Implement ThemeManager
  - [x] 3.1 Implement `ThemeManager` module with `applyInitial()` and `toggle()` methods
    - `applyInitial()` is the inline script logic (already in HTML from task 1); expose it also as a callable function for `App.init()` context
    - `toggle()` reads the current `data-theme` attribute on `<html>`, computes the opposite value, sets the attribute, and writes to `localStorage` using the `dashboard_theme` key; completes within 100 ms
    - Default to `"light"` when no saved theme exists or the stored value is unrecognized
    - Add CSS styles for `.theme-toggle` button with `aria-label` and keyboard activation support
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 3.2 Write property test for theme toggle round-trip
    - **Property 15: Theme toggle is a round-trip**
    - **Validates: Requirements 8.2, 8.3**

- [x] 4. Implement ClockWidget
  - [x] 4.1 Implement `ClockWidget.init(containerEl)` with live time and date display
    - Use `setInterval(tick, 1000)` started immediately; call `tick()` once synchronously on init so the display is populated within 1 second without waiting for the first interval
    - Format time as `HH:MM:SS` using a `pad2(n)` helper (zero-padding); use lookup arrays for full day and month names to avoid locale inconsistencies
    - Format date as `"DayName, DD MonthName YYYY"` (e.g., `"Monday, 26 May 2025"`)
    - On `new Date()` failure, render a `"Time unavailable"` error message inside the container using a `role="alert"` element
    - Add `.clock-display` CSS styles: large font, `var(--color-accent)` color
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 5. Implement GreetingWidget
  - [x] 5.1 Implement `getGreetingPrefix(hour)` pure function
    - Returns `"Good Morning"` for hours 5–11, `"Good Afternoon"` for 12–17, `"Good Evening"` for 18–21, `"Good Night"` for 22–23 and 0–4
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ]* 5.2 Write property test for greeting 24-hour coverage
    - **Property 13: Greeting message prefix covers all 24 hours without overlap or gap**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

  - [x] 5.3 Implement `GreetingWidget.init(containerEl)` with name input and greeting display
    - On load, read `dashboard_username` via `StorageManager.get`; default to `"Friend"` if `null`
    - Render greeting text using `getGreetingPrefix(new Date().getHours())` + `", " + userName`
    - Name input + Save button: on submit, trim value, persist via `StorageManager.set('dashboard_username', name)`, update greeting display within 100 ms
    - If `StorageManager.set` returns `false`, display an inline `role="alert"` error and retain the previously displayed name
    - Add `.greeting-text` CSS style
    - _Requirements: 2.1–2.8_

- [x] 6. Implement FocusTimerWidget
  - [x] 6.1 Implement timer validation and pure logic
    - `isValidDuration(d)` returns `true` if and only if `d` is a positive integer and `1 ≤ d ≤ 120`
    - Internal state machine: `Idle → Running → Paused → Running → Idle`, `Running → Finished → Idle`
    - _Requirements: 3.7, 3.8_

  - [ ]* 6.2 Write property test for timer duration validation
    - **Property 10: Focus timer duration validation accepts exactly [1, 120]**
    - **Validates: Requirements 3.7, 3.8**

  - [x] 6.3 Implement `FocusTimerWidget.init(containerEl)` with full countdown behavior
    - Default duration: 25 minutes; restore from `StorageManager.get('dashboard_timer_duration')` on load
    - Start: create `setInterval(tick, 1000)`; guard against duplicate Start when already `Running` (no-op)
    - Stop: clear interval, retain remaining time, transition to `Paused`
    - Reset: clear interval, restore display to configured session duration, transition to `Idle`
    - At `00:00`: clear interval, show visible completion indicator for ≥ 3 seconds, play a single beep via `AudioContext` (Web Audio API — no external file)
    - Custom duration input: validate with `isValidDuration`; on valid submit persist via `StorageManager.set('dashboard_timer_duration', minutes)`; on invalid show inline `role="alert"` error and retain previous duration
    - Add `.timer-display` (large font, accent color), `.timer-controls` (flex row), and button variant CSS styles
    - _Requirements: 3.1–3.10_

- [ ] 7. Checkpoint — StorageManager, ThemeManager, ClockWidget, GreetingWidget, FocusTimerWidget
  - Ensure all tasks 1–6 are wired in `App.init()`, the page renders correctly with all widgets visible, and no JavaScript console errors appear on load. Ask the user if any questions arise.

- [ ] 8. Implement TaskListWidget — core data and pure functions
  - [ ] 8.1 Implement pure functions for task validation
    - `validateTaskText(text, existingTasks)` returns `{ valid: true }` or `{ valid: false, reason: 'empty' | 'tooLong' | 'duplicate' }`
    - Trims `text`; rejects empty/whitespace-only (`reason: 'empty'`); rejects length > 200 (`reason: 'tooLong'`); rejects case-insensitive match against any incomplete task's trimmed text (`reason: 'duplicate'`)
    - `serializeTasks(tasks)` → JSON string; `deserializeTasks(json)` → `Task[]` (returns `[]` on parse failure)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 9.2_

  - [ ]* 8.2 Write property test for task addition grows the list
    - **Property 1: Task addition grows the list**
    - **Validates: Requirements 4.1**

  - [ ]* 8.3 Write property test for whitespace and empty descriptions are always rejected
    - **Property 2: Whitespace and empty descriptions are always rejected**
    - **Validates: Requirements 4.2**

  - [ ]* 8.4 Write property test for duplicate task detection is case-insensitive
    - **Property 3: Duplicate task detection is case-insensitive**
    - **Validates: Requirements 4.4**

  - [ ]* 8.5 Write property test for task persistence round-trip
    - **Property 4: Task persistence round-trip**
    - **Validates: Requirements 4.6, 9.2**

- [ ] 9. Implement TaskListWidget — sorting pure function
  - [ ] 9.1 Implement `sortTasks(tasks, mode)` pure function
    - `"creation"`: sort by `createdAt` ascending
    - `"active-first"`: incomplete tasks first, then completed; within each group sort by `createdAt` ascending
    - `"completed-first"`: completed tasks first, then incomplete; within each group sort by `createdAt` ascending
    - `"alpha-asc"`: sort by `text.toLowerCase()` ascending; tie-break by `createdAt` ascending
    - Returns a new sorted array; does not mutate the input
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 9.2 Write property test for sort by creation date
    - **Property 6: Sort by creation date produces non-decreasing timestamps**
    - **Validates: Requirements 6.1**

  - [ ]* 9.3 Write property test for active-first sort
    - **Property 7: Active-first sort places all incomplete tasks before all completed tasks**
    - **Validates: Requirements 6.2**

  - [ ]* 9.4 Write property test for completed-first sort
    - **Property 8: Completed-first sort places all completed tasks before all incomplete tasks**
    - **Validates: Requirements 6.3**

  - [ ]* 9.5 Write property test for alphabetical sort
    - **Property 9: Alphabetical sort is case-insensitive with createdAt tie-break**
    - **Validates: Requirements 6.4**

- [ ] 10. Implement TaskListWidget — completion toggle pure function
  - [ ] 10.1 Implement `toggleCompletion(task)` pure function
    - Returns a new `Task` object with `completed` flipped; does not mutate the original; no other tasks are affected
    - _Requirements: 5.5, 5.6_

  - [ ]* 10.2 Write property test for completion toggle round-trip
    - **Property 5: Completion toggle is a round-trip**
    - **Validates: Requirements 5.5, 5.6**

- [ ] 11. Implement TaskListWidget — UI and full CRUD
  - [ ] 11.1 Implement `TaskListWidget.init(containerEl)` with add, edit, complete, delete, and sort UI
    - On load: restore tasks via `deserializeTasks(StorageManager.get('dashboard_tasks'))`; if `null` or parse error display empty list with inline `role="alert"` error; restore sort preference from `StorageManager.get('dashboard_sort')` (default `"creation"`)
    - Add task form: trim input, call `validateTaskText`, show inline `role="alert"` error for each rejection reason, retain input focus on rejection; on success create `Task` (`crypto.randomUUID()` or `Date.now()` fallback for `id`), push to array, re-render, persist
    - Render: iterate `sortTasks(tasks, sortMode)`, generate list items with checkbox (`<input type="checkbox">`+ `<label>`), task text, Edit button, Delete button; apply `.task-item--completed` (strikethrough) for completed tasks
    - Edit: replace row with `<input>` pre-filled with task text (max 500 chars); on confirm trim → reject if empty (retain original, no persist); on cancel discard; on success update text, re-render, persist
    - Complete toggle: call `toggleCompletion`, replace task in array, re-render, persist
    - Delete: remove task from array, re-render, persist
    - Sort dropdown: on change update `sortMode`, persist to `dashboard_sort`, re-render
    - All persist calls within 500 ms; if `StorageManager.set` returns `false`, show inline `role="alert"` error
    - Add `.task-list`, `.task-item`, `.task-item--completed` CSS styles
    - _Requirements: 4.1–4.8, 5.1–5.7, 6.1–6.7_

- [ ] 12. Checkpoint — TaskListWidget complete
  - Ensure add, edit, complete, delete, and all four sort modes work correctly, persist to `localStorage`, and restore on page reload. No console errors. Ask the user if any questions arise.

- [ ] 13. Implement QuickLinksWidget — validation and pure functions
  - [ ] 13.1 Implement pure validation functions for Quick Links
    - `isValidUrl(url)`: returns `true` if `url` starts with `http://` or `https://` AND `url.length ≤ 2048`
    - `isDuplicateUrl(url, links)`: returns `true` if any existing link's `url.toLowerCase() === url.toLowerCase()`
    - _Requirements: 7.1, 7.2, 7.9_

  - [ ]* 13.2 Write property test for Quick Link URL validation
    - **Property 11: Quick link URL validation accepts only absolute http/https URLs within length limit**
    - **Validates: Requirements 7.1, 7.2**

  - [ ]* 13.3 Write property test for duplicate Quick Link detection
    - **Property 12: Duplicate Quick Link detection is case-insensitive**
    - **Validates: Requirements 7.9**

- [ ] 14. Implement QuickLinksWidget — UI
  - [ ] 14.1 Implement `QuickLinksWidget.init(containerEl)` with add, open, and delete
    - On load: restore links via `StorageManager.get('dashboard_links')`; if `null` or parse error display empty list with inline `role="alert"` error
    - Add form: validate label (1–50 chars, non-whitespace-only), validate URL with `isValidUrl`, check duplicate with `isDuplicateUrl`; show inline `role="alert"` error for each rejection; on success create `QuickLink`, push to array, re-render, persist
    - Render: each link as a button with label text and a `×` delete control
    - Open: `window.open(url, '_blank', 'noopener,noreferrer')`
    - Delete: remove from array, re-render, persist
    - If persist fails, show inline `role="alert"` error
    - Add `.quick-links-list` (flex wrap), `.quick-link-btn` CSS styles
    - _Requirements: 7.1–7.9_

- [ ] 15. Implement App.init() — wire all widgets and localStorage availability check
  - [ ] 15.1 Implement `App.init()` to coordinate all widgets and handle storage unavailability
    - On `DOMContentLoaded`: call `StorageManager.isAvailable()`
    - If unavailable: render a non-dismissible warning banner (`role="alert"`, `aria-live="assertive"`) at the top of the page; all widgets continue with in-memory state
    - Call `ThemeManager.applyInitial()` (if not already applied by inline script)
    - Initialize all widgets in order: `ClockWidget.init()`, `GreetingWidget.init()`, `FocusTimerWidget.init()`, `TaskListWidget.init()`, `QuickLinksWidget.init()`
    - Ensure all `localStorage` restoration completes within 500 ms of page load
    - Listen for `storage-error` custom events and route them to the appropriate widget's error display
    - _Requirements: 9.3, 9.4, 9.6, 10.2, 10.3, 10.5_

- [ ] 16. Final checkpoint — full integration
  - Verify: all six widgets render on page load, all data persists across reload, theme toggle works without FOUC, the page is responsive at ≤640px, no JavaScript console errors in Chrome/Firefox/Edge/Safari. Ask the user if any questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP. The core implementation will be fully functional without them.
- Property tests require installing `fast-check` as a dev dependency (`npm install --save-dev fast-check`) and running via Node.js. The pure functions must be exported via the `App` namespace or a separate test entry point to be testable in isolation.
- Each property test must include the comment `// Feature: todo-life-dashboard, Property N: <property text>` and run a minimum of 100 iterations.
- All inline error and validation messages must use `role="alert"` for screen reader accessibility.
- The Web Audio API `AudioContext` beep needs no external file — generate a short oscillator tone programmatically.
- `crypto.randomUUID()` is available in all target browsers (Chrome, Firefox, Edge, Safari stable); the `Date.now()` fallback covers any edge case.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "3.1"] },
    { "id": 1, "tasks": ["2.2", "2.3", "3.2", "4.1"] },
    { "id": 2, "tasks": ["5.1"] },
    { "id": 3, "tasks": ["5.2", "5.3", "6.1"] },
    { "id": 4, "tasks": ["6.2", "6.3", "8.1"] },
    { "id": 5, "tasks": ["8.2", "8.3", "8.4", "8.5", "9.1"] },
    { "id": 6, "tasks": ["9.2", "9.3", "9.4", "9.5", "10.1"] },
    { "id": 7, "tasks": ["10.2", "11.1"] },
    { "id": 8, "tasks": ["13.1"] },
    { "id": 9, "tasks": ["13.2", "13.3", "14.1"] },
    { "id": 10, "tasks": ["15.1"] }
  ]
}
```
