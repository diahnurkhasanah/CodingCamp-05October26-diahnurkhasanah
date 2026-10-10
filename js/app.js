/* ==========================================================================
   app.js — To-Do List Life Dashboard
   All application logic for the dashboard is contained in this single file.
   Sections are delimited by block comment banners.
   Everything is exposed via the window.App namespace.
   ========================================================================== */

/* --------------------------------------------------------------------------
   NAMESPACE
   -------------------------------------------------------------------------- */

window.App = window.App || {};


/* ==========================================================================
   STORAGE MANAGER
   Wraps every localStorage call so the rest of the codebase never touches
   the API directly.

   Public API:
     StorageManager.isAvailable()     → boolean
     StorageManager.get(key)          → parsed value | null
     StorageManager.set(key, value)   → true | false

   Requirements: 9.1, 9.2, 9.7, 10.3
   ========================================================================== */

App.StorageManager = (function () {
  'use strict';

  /**
   * Dispatch a custom `storage-error` DOM event on document so widgets can
   * display error messages without coupling to StorageManager internals.
   *
   * @param {'get'|'set'|'unavailable'} operation - which operation failed
   * @param {string} key - the localStorage key involved (empty string for unavailable)
   * @param {Error|null} error - the original exception, if any
   */
  function _dispatchErrorEvent(operation, key, error) {
    var event = new CustomEvent('storage-error', {
      bubbles: true,
      detail: {
        operation: operation,
        key: key,
        error: error || null,
      },
    });
    document.dispatchEvent(event);
  }

  /**
   * Probe localStorage with a test write / read / delete to determine whether
   * the API is usable in the current browsing context (e.g. private mode with
   * storage blocked will cause setItem to throw).
   *
   * @returns {boolean} true if localStorage is available and writable
   */
  function isAvailable() {
    var testKey = '__dashboard_probe__';
    var testValue = '1';
    try {
      localStorage.setItem(testKey, testValue);
      var readBack = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      return readBack === testValue;
    } catch (e) {
      return false;
    }
  }

  /**
   * Read and JSON-parse a value from localStorage.
   * Returns null — without throwing — if the key is absent, the stored value
   * is not valid JSON, or any other error occurs (Requirement 9.7, 10.3).
   * Dispatches a `storage-error` event when a parse failure is detected.
   *
   * @param {string} key
   * @returns {*} parsed value or null
   */
  function get(key) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null || raw === undefined) {
        // Key absent — return null silently (not an error condition)
        return null;
      }
      return JSON.parse(raw);
    } catch (e) {
      // JSON.parse failure — corrupted data (Requirement 9.7)
      _dispatchErrorEvent('get', key, e);
      return null;
    }
  }

  /**
   * JSON-serialize a value and write it to localStorage.
   * Returns true on success, false if a QuotaExceededError or any other
   * exception is thrown (Requirement 9.4).
   * Dispatches a `storage-error` event on failure.
   *
   * @param {string} key
   * @param {*} value - any JSON-serialisable value
   * @returns {boolean} true on success, false on failure
   */
  function set(key, value) {
    try {
      var serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      return true;
    } catch (e) {
      // Covers QuotaExceededError and any other storage exceptions
      _dispatchErrorEvent('set', key, e);
      return false;
    }
  }

  // Public interface
  return {
    isAvailable: isAvailable,
    get: get,
    set: set,
  };
}());


/* ==========================================================================
   THEME MANAGER
   Handles light / dark theme switching:
     - FOUC prevention via applyInitial() (mirrors the inline <script> in HTML)
     - toggle() switches and persists the theme within 100 ms (sync operation)
     - toggleTheme() is a pure function exposed for property-based testing

   localStorage key: "dashboard_theme"
   Valid values:     "light" | "dark"
   Default:          "light" (when key is absent or value is unrecognised)

   Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
   ========================================================================== */

App.ThemeManager = (function () {
  'use strict';

  var STORAGE_KEY = 'dashboard_theme';
  var VALID_THEMES = ['light', 'dark'];

  /**
   * Resolve the persisted theme value to a valid string.
   * Returns "light" when no theme is saved or the stored value is unrecognised.
   * Never throws — localStorage access is guarded.
   *
   * @returns {"light"|"dark"}
   */
  function _resolveStoredTheme() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      return VALID_THEMES.indexOf(stored) !== -1 ? stored : 'light';
    } catch (e) {
      // localStorage unavailable — default to light (Requirement 8.6)
      return 'light';
    }
  }

  /**
   * Apply the saved theme to <html> before the first paint to prevent a
   * flash of unstyled content (FOUC).
   *
   * This mirrors the logic in the inline <script> block in index.html so the
   * theme is guaranteed to be applied whether or not the inline script ran
   * (e.g. when called from App.init() or in a test environment).
   *
   * Requirement 8.4, 8.5, 8.6
   */
  function applyInitial() {
    var theme = _resolveStoredTheme();
    document.documentElement.setAttribute('data-theme', theme);
  }

  /**
   * Toggle the theme between "light" and "dark".
   *
   * 1. Reads the current data-theme attribute from <html>.
   * 2. Computes the opposite value (defaults to "light" when attribute is
   *    absent or contains an unrecognised value).
   * 3. Sets the attribute synchronously on <html>.
   * 4. Persists the new value to localStorage under "dashboard_theme".
   *
   * The entire operation is synchronous and completes well within 100 ms.
   * A write failure (e.g. QuotaExceededError) dispatches a "storage-error"
   * event but does NOT roll back the visual change.
   *
   * @returns {"light"|"dark"} The newly applied theme value.
   *
   * Requirement 8.1, 8.2, 8.3
   */
  function toggle() {
    var current = document.documentElement.getAttribute('data-theme');
    var next = toggleTheme(current);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      // Persist failure is non-fatal; visual change is already applied.
      // Dispatch storage-error so the UI can surface a warning if needed.
      var event = new CustomEvent('storage-error', {
        bubbles: true,
        detail: { operation: 'set', key: STORAGE_KEY, error: e },
      });
      document.dispatchEvent(event);
    }
    return next;
  }

  /**
   * Pure function: returns the opposite theme string.
   * Does NOT touch the DOM or localStorage — safe to call in Node.js tests.
   *
   * When `current` is "dark"  → returns "light".
   * When `current` is "light" → returns "dark".
   * When `current` is absent, null, or unrecognised → defaults to "light",
   *   so the return value is "dark" (opposite of the default).
   *
   * @param {string} current - "light" | "dark" (or any other string)
   * @returns {"light"|"dark"}
   *
   * Requirement 8.2 (used internally by toggle())
   */
  function toggleTheme(current) {
    return current === 'dark' ? 'light' : 'dark';
  }

  // Public interface
  return {
    applyInitial: applyInitial,
    toggle: toggle,
    toggleTheme: toggleTheme,
  };
}());


/* ==========================================================================
   CLOCK WIDGET
   Displays the current local time (HH:MM:SS) and full date
   (e.g. "Monday, 26 May 2025"), updated every second.

   Public API:
     ClockWidget.init(containerEl)   — starts live clock inside containerEl

   Implementation notes:
     - Uses setInterval(tick, 1000) started on init; tick() is also called
       once synchronously so the display is never blank at startup.
     - Time is formatted with a pad2(n) zero-padding helper.
     - Day and month names come from lookup arrays to avoid locale dependency.
     - On new Date() failure, renders a role="alert" error message.

   Requirements: 1.1, 1.2, 1.3, 1.4
   ========================================================================== */

App.ClockWidget = (function () {
  'use strict';

  /** Zero-pad a number to at least 2 digits. */
  function pad2(n) {
    return n < 10 ? '0' + n : String(n);
  }

  var DAY_NAMES = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday',
    'Thursday', 'Friday', 'Saturday',
  ];

  var MONTH_NAMES = [
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December',
  ];

  /**
   * Initialise the ClockWidget inside the given container element.
   * Looks for #clock-time and #clock-date inside containerEl.
   * Starts a 1-second interval and ticks immediately on init.
   *
   * @param {HTMLElement} containerEl - the element that wraps the clock
   */
  function init(containerEl) {
    if (!containerEl) {
      return;
    }

    var timeEl = containerEl.querySelector('#clock-time');
    var dateEl = containerEl.querySelector('#clock-date');

    /**
     * One tick: read current time, format it, push into the DOM.
     * On Date failure, display an accessible error message.
     */
    function tick() {
      var now;
      try {
        now = new Date();
        // Validate that we got a real Date (guards against exotic environments)
        if (isNaN(now.getTime())) {
          throw new Error('Invalid date');
        }
      } catch (e) {
        _showError(containerEl);
        return;
      }

      var hh = pad2(now.getHours());
      var mm = pad2(now.getMinutes());
      var ss = pad2(now.getSeconds());
      var timeStr = hh + ':' + mm + ':' + ss;

      var dayName   = DAY_NAMES[now.getDay()];
      var day       = now.getDate();
      var monthName = MONTH_NAMES[now.getMonth()];
      var year      = now.getFullYear();
      var dateStr   = dayName + ', ' + pad2(day) + ' ' + monthName + ' ' + year;

      if (timeEl) {
        timeEl.textContent = timeStr;
      }
      if (dateEl) {
        dateEl.textContent = dateStr;
      }
    }

    // Populate immediately so the display is never blank on load
    tick();

    // Continue updating every second
    setInterval(tick, 1000);
  }

  /**
   * Replace clock content with an accessible error message.
   * Only inserts the alert once to avoid duplicates on repeated tick failures.
   *
   * @param {HTMLElement} containerEl
   */
  function _showError(containerEl) {
    // Guard: don't insert a second alert if one already exists
    if (containerEl.querySelector('[role="alert"].clock-error')) {
      return;
    }
    var alert = document.createElement('p');
    alert.setAttribute('role', 'alert');
    alert.className = 'clock-error validation-error';
    alert.textContent = 'Time unavailable';
    containerEl.insertAdjacentElement('afterbegin', alert);
  }

  // Public interface
  return {
    init: init,
  };
}());


/* ==========================================================================
   GREETING WIDGET
   Displays a time-of-day greeting personalised with the user's name.

   Public API:
     App.GreetingWidget.getGreetingPrefix(hour)   — pure function; returns greeting prefix
     App.GreetingWidget.init(containerEl)         — wires name input + greeting display

   Time-of-day ranges:
     05–11  → "Good Morning"
     12–17  → "Good Afternoon"
     18–21  → "Good Evening"
     22–23, 0–4 → "Good Night"

   localStorage key: "dashboard_username"
   Default name:     "Friend" (when key is absent)

   Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8
   ========================================================================== */

App.GreetingWidget = (function () {
  'use strict';

  /**
   * Return the greeting prefix that matches the given hour of the day.
   * This is a pure function: no DOM access, no side-effects.
   *
   * @param {number} hour - integer in the range 0–23
   * @returns {"Good Morning"|"Good Afternoon"|"Good Evening"|"Good Night"}
   *
   * Requirements: 2.1, 2.2, 2.3, 2.4
   */
  function getGreetingPrefix(hour) {
    if (hour >= 5 && hour <= 11) {
      return 'Good Morning';    // Requirement 2.1
    }
    if (hour >= 12 && hour <= 17) {
      return 'Good Afternoon';  // Requirement 2.2
    }
    if (hour >= 18 && hour <= 21) {
      return 'Good Evening';    // Requirement 2.3
    }
    // Covers 22–23 and 0–4
    return 'Good Night';        // Requirement 2.4
  }

  /** Returns the greeting string for the current time of day. */





  function _buildGreeting() {
    return getGreetingPrefix(new Date().getHours());
  }

  /**
   * Initialise the GreetingWidget inside the given container element.
   *










   *
   * @param {HTMLElement} containerEl - the element that wraps the greeting UI
   *
   * Requirements: 2.5, 2.6, 2.7, 2.8
   */
  function init(containerEl) {
    if (!containerEl) {
      return;
    }

    var greetingEl  = containerEl.querySelector('#greeting-text');
    if (greetingEl) {
      greetingEl.textContent = _buildGreeting();
    }
  }

  // Public interface
  return {
    getGreetingPrefix: getGreetingPrefix,
    init: init,
  };
}());

// Expose pure function directly on App namespace for isolated unit/property testing
App.getGreetingPrefix = App.GreetingWidget.getGreetingPrefix;


/* ==========================================================================
   FOCUS TIMER WIDGET
   Countdown timer based on the Pomodoro technique.

   Pure logic exposed for testing:
     App.isValidDuration(d)   — returns true iff d is an integer in [1, 120]

   Timer state machine:
     IDLE → RUNNING → PAUSED → RUNNING → IDLE
     RUNNING → FINISHED → IDLE

   State constants (internal, also exposed on App namespace):
     App.TimerState.IDLE     = "IDLE"
     App.TimerState.RUNNING  = "RUNNING"
     App.TimerState.PAUSED   = "PAUSED"
     App.TimerState.FINISHED = "FINISHED"

   Requirements: 3.7, 3.8
   ========================================================================== */

App.FocusTimerWidget = (function () {
  'use strict';

  /**
   * Timer state machine constants.
   * Defines all valid states for the focus timer.
   *
   * Valid transitions:
   *   IDLE     → RUNNING  (user starts timer)
   *   RUNNING  → PAUSED   (user stops/pauses timer)
   *   RUNNING  → FINISHED (countdown reaches 00:00)
   *   PAUSED   → RUNNING  (user resumes timer)
   *   FINISHED → IDLE     (reset after completion)
   *   RUNNING  → IDLE     (user resets timer)
   *   PAUSED   → IDLE     (user resets timer)
   */
  var TimerState = {
    IDLE:     'IDLE',
    RUNNING:  'RUNNING',
    PAUSED:   'PAUSED',
    FINISHED: 'FINISHED',
  };

  /**
   * Validate a timer duration value.
   *
   * Returns true if and only if all of the following hold:
   *   1. d is a number (not NaN, not Infinity)
   *   2. d is an integer (no fractional part)
   *   3. d is in the range [1, 120] inclusive
   *
   * Rejects: floats, negative numbers, zero, values > 120,
   *          null, undefined, strings, booleans, objects, arrays, NaN, Infinity.
   *
   * @param {*} d - the value to validate
   * @returns {boolean}
   *
   * Requirements: 3.7, 3.8
   */
  function isValidDuration(d) {
    // Must be of type "number" (rules out null, undefined, strings, booleans, objects)
    if (typeof d !== 'number') {
      return false;
    }
    // Must be finite (rules out NaN and ±Infinity)
    if (!isFinite(d)) {
      return false;
    }
    // Must be an integer (rules out floats like 1.5, 25.0001)
    if (Math.floor(d) !== d) {
      return false;
    }
    // Must be within the valid range [1, 120]
    if (d < 1 || d > 120) {
      return false;
    }
    return true;
  }

  /* ------------------------------------------------------------------
     INTERNAL STATE
     ------------------------------------------------------------------ */

  /** Current FSM state — one of TimerState.* */
  var _state = TimerState.IDLE;

  /** Session duration in minutes, restored from storage or defaulted to 25 */
  var _sessionMinutes = 25;

  /** Remaining seconds on the clock */
  var _remainingSeconds = _sessionMinutes * 60;

  /** Handle returned by setInterval; null when no interval is active */
  var _intervalId = null;

  /* ------------------------------------------------------------------
     PURE HELPERS
     ------------------------------------------------------------------ */

  /**
   * Format a total-seconds value as "MM:SS".
   * @param {number} totalSeconds - non-negative integer
   * @returns {string} e.g. "25:00", "04:59"
   */
  function _formatTime(totalSeconds) {
    var mins = Math.floor(totalSeconds / 60);
    var secs = totalSeconds % 60;
    return (mins < 10 ? '0' + mins : String(mins)) +
           ':' +
           (secs < 10 ? '0' + secs : String(secs));
  }

  /**
   * Play a single short beep using the Web Audio API (no external file).
   * Gracefully no-ops when AudioContext is unavailable.
   */
  function _playBeep() {
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) { return; }
      var ctx = new AudioCtx();
      var oscillator = ctx.createOscillator();
      var gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);       // A5 — pleasant alert pitch
      gainNode.gain.setValueAtTime(0.6, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8); // fade out
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.8);
    } catch (e) {
      // AudioContext unavailable or suspended — silent fail (Req 3.6)
    }
  }

  /* ------------------------------------------------------------------
     INIT
     ------------------------------------------------------------------ */

  /**
   * Initialise the FocusTimerWidget inside the given container element.
   *
   * Looks up all timer sub-elements by ID, restores the configured duration
   * from StorageManager, and wires all button event listeners.
   *
   * @param {HTMLElement} containerEl - the #timer-container element
   *
   * Requirements: 3.1–3.10
   */
  function init(containerEl) {
    if (!containerEl) { return; }

    /* -- Element references ------------------------------------------ */
    var displayEl     = containerEl.querySelector('#timer-display');
    var startBtn      = containerEl.querySelector('#timer-start');
    var stopBtn       = containerEl.querySelector('#timer-stop');
    var resetBtn      = containerEl.querySelector('#timer-reset');
    var durationInput = containerEl.querySelector('#timer-duration-input');
    var durationSave  = containerEl.querySelector('#timer-duration-save');
    var errorEl       = containerEl.querySelector('#timer-error');
    var completeEl    = containerEl.querySelector('#timer-complete-msg');

    /* -- Restore persisted duration (Req 3.9) ------------------------ */
    var storedMinutes = App.StorageManager.get('dashboard_timer_duration');
    if (isValidDuration(storedMinutes)) {
      _sessionMinutes = storedMinutes;
    }
    _remainingSeconds = _sessionMinutes * 60;

    /* -- Helpers that touch the DOM ---------------------------------- */

    /** Push the current _remainingSeconds into #timer-display. */
    function _render() {
      if (displayEl) {
        displayEl.textContent = _formatTime(_remainingSeconds);
      }
    }

    /** Show inline error text; hide it when msg is falsy. */
    function _showError(msg) {
      if (!errorEl) { return; }
      if (msg) {
        errorEl.textContent = msg;
        errorEl.style.display = '';
      } else {
        errorEl.textContent = '';
        errorEl.style.display = 'none';
      }
    }

    /** Show / hide the completion message. */
    function _showComplete(visible) {
      if (!completeEl) { return; }
      completeEl.style.display = visible ? '' : 'none';
    }

    /* -- Initial render --------------------------------------------- */
    _render();
    _showError(null);
    _showComplete(false);

    /* -- Tick -------------------------------------------------------- */

    /**
     * Called every second while running.
     * Decrements _remainingSeconds; handles reaching 00:00.
     */
    function _tick() {
      if (_remainingSeconds <= 0) {
        // Safety guard: should not normally be reached on first tick
        _onFinished();
        return;
      }
      _remainingSeconds -= 1;
      _render();
      if (_remainingSeconds === 0) {
        _onFinished();
      }
    }

    /** Handle countdown completion (Req 3.6). */
    function _onFinished() {
      _clearInterval();
      _state = TimerState.FINISHED;
      _showComplete(true);
      _playBeep();
      // Keep completion indicator visible for ≥ 3 seconds, then reset to IDLE
      setTimeout(function () {
        _showComplete(false);
        _state = TimerState.IDLE;
        _remainingSeconds = _sessionMinutes * 60;
        _render();
      }, 3000);
    }

    /* -- Interval helpers ------------------------------------------- */

    function _clearInterval() {
      if (_intervalId !== null) {
        clearInterval(_intervalId);
        _intervalId = null;
      }
    }

    function _startInterval() {
      _clearInterval(); // defensive: ensure no duplicate interval
      _intervalId = setInterval(_tick, 1000);
    }

    /* -- Control button handlers ------------------------------------ */

    /**
     * Start: begin countdown.
     * Guard: no-op if already RUNNING (Req 3.10).
     * Allowed from IDLE and PAUSED.
     */
    function _onStart() {
      if (_state === TimerState.RUNNING) {
        return; // already running — ignore (Req 3.10)
      }
      if (_state === TimerState.FINISHED) {
        return; // still in finished state — ignore
      }
      _state = TimerState.RUNNING;
      _showError(null);
      _showComplete(false);
      _startInterval();
    }

    /**
     * Stop: pause countdown, retain remaining time (Req 3.4).
     * Only meaningful while RUNNING.
     */
    function _onStop() {
      if (_state !== TimerState.RUNNING) { return; }
      _clearInterval();
      _state = TimerState.PAUSED;
    }

    /**
     * Reset: stop countdown, restore to configured session duration (Req 3.5).
     * Allowed from any state.
     */
    function _onReset() {
      _clearInterval();
      _state = TimerState.IDLE;
      _remainingSeconds = _sessionMinutes * 60;
      _render();
      _showComplete(false);
    }

    /**
     * Duration save: validate, persist, apply (Req 3.7, 3.8, 3.9).
     */
    function _onDurationSave() {
      if (!durationInput) { return; }
      var raw = durationInput.value.trim();
      var parsed = Number(raw);

      if (!isValidDuration(parsed)) {
        // Invalid — show accessible error, retain current duration (Req 3.8)
        _showError('Please enter a whole number between 1 and 120 minutes.');
        durationInput.focus();
        return;
      }

      // Valid — persist and apply (Req 3.9)
      _showError(null);
      _sessionMinutes = parsed;
      App.StorageManager.set('dashboard_timer_duration', parsed);

      // If not running, reset display to new duration
      if (_state !== TimerState.RUNNING) {
        _remainingSeconds = _sessionMinutes * 60;
        _render();
      }
      durationInput.value = '';
    }

    /* -- Wire events ------------------------------------------------- */

    if (startBtn)     { startBtn.addEventListener('click', _onStart); }
    if (stopBtn)      { stopBtn.addEventListener('click', _onStop); }
    if (resetBtn)     { resetBtn.addEventListener('click', _onReset); }
    if (durationSave) { durationSave.addEventListener('click', _onDurationSave); }

    // Allow pressing Enter in the duration input field to save (UX improvement)
    if (durationInput) {
      durationInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { _onDurationSave(); }
      });
    }
  }

  // Public interface
  return {
    TimerState:      TimerState,
    isValidDuration: isValidDuration,
    init:            init,
  };
}());

// Expose pure function and state constants on the App namespace for
// isolated unit / property-based testing (Requirement 3.7, 3.8)
App.isValidDuration = App.FocusTimerWidget.isValidDuration;
App.TimerState      = App.FocusTimerWidget.TimerState;



/* ==========================================================================
   TASK WIDGET
   Manages a persisted to-do list with add, complete-toggle, delete, and sort.

   localStorage key: "dashboard_tasks"
   Each task object: { id, text, completed, createdAt }
   ========================================================================== */

App.TaskWidget = (function () {
  'use strict';

  var STORAGE_KEY = 'dashboard_tasks';

  // In-memory task array — source of truth for rendering
  var _tasks = [];

  /** Load tasks from localStorage. */
  function _load() {
    var stored = App.StorageManager.get(STORAGE_KEY);
    _tasks = Array.isArray(stored) ? stored : [];
  }

  /** Persist current _tasks to localStorage. */
  function _save() {
    App.StorageManager.set(STORAGE_KEY, _tasks);
  }

  /** Generate a simple unique ID. */
  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /**
   * Sort _tasks according to the current sort mode.
   * Does NOT mutate _tasks — returns a new sorted array.
   * @param {string} mode
   * @returns {Array}
   */
  function _sorted(mode) {
    var arr = _tasks.slice();
    if (mode === 'active-first') {
      arr.sort(function (a, b) { return Number(a.completed) - Number(b.completed); });
    } else if (mode === 'completed-first') {
      arr.sort(function (a, b) { return Number(b.completed) - Number(a.completed); });
    } else if (mode === 'alpha-asc') {
      arr.sort(function (a, b) { return a.text.localeCompare(b.text); });
    } else {
      // 'creation' (default) — oldest first
      arr.sort(function (a, b) { return a.createdAt - b.createdAt; });
    }
    return arr;
  }

  /**
   * Initialise the TaskWidget inside the given container element.
   * @param {HTMLElement} containerEl
   */
  function init(containerEl) {
    if (!containerEl) { return; }

    var inputEl  = containerEl.querySelector('#task-input');
    var addBtn   = containerEl.querySelector('#task-add');
    var listEl   = containerEl.querySelector('#task-list');
    var sortEl   = containerEl.querySelector('#task-sort');
    var errorEl  = containerEl.querySelector('#task-error');

    _load();

    /* -- Helpers ----------------------------------------------------- */

    function _showError(msg) {
      if (!errorEl) { return; }
      if (msg) {
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
      } else {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
      }
    }

    function _render() {
      if (!listEl) { return; }
      var mode = sortEl ? sortEl.value : 'creation';
      var sorted = _sorted(mode);
      listEl.innerHTML = '';

      sorted.forEach(function (task) {
        var li = document.createElement('li');
        li.className = 'flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors';

        var checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = task.completed;
        checkbox.className = 'w-4 h-4 accent-indigo-500 cursor-pointer flex-shrink-0';
        checkbox.setAttribute('aria-label', 'Mark "' + task.text + '" as ' + (task.completed ? 'active' : 'complete'));
        checkbox.addEventListener('change', function () {
          _toggleComplete(task.id);
        });

        var span = document.createElement('span');
        span.className = 'flex-1 text-sm text-gray-800 dark:text-gray-100' + (task.completed ? ' line-through text-gray-400 dark:text-gray-500' : '');
        span.textContent = task.text;

        var delBtn = document.createElement('button');
        delBtn.className = 'flex-shrink-0 px-3 py-1 rounded-md bg-red-500 text-white text-xs font-semibold cursor-pointer hover:bg-red-600 active:scale-95 transition-all';
        delBtn.textContent = 'Delete';
        delBtn.setAttribute('aria-label', 'Delete "' + task.text + '"');
        delBtn.addEventListener('click', function () {
          _deleteTask(task.id);
        });

        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(delBtn);
        listEl.appendChild(li);
      });
    }

    /* -- Actions ----------------------------------------------------- */

    function _addTask() {
      if (!inputEl) { return; }
      var text = inputEl.value.trim();
      if (!text) {
        _showError('Please enter a task description.');
        inputEl.focus();
        return;
      }
      var isDuplicate = _tasks.some(function (t) {
        return t.text.toLowerCase() === text.toLowerCase();
      });
      if (isDuplicate) {
        _showError('"' + text + '" sudah ada dalam daftar task.');
        inputEl.focus();
        return;
      }
      _showError(null);
      _tasks.push({ id: _uid(), text: text, completed: false, createdAt: Date.now() });
      _save();
      _render();
      inputEl.value = '';
    }

    function _toggleComplete(id) {
      _tasks = _tasks.map(function (t) {
        return t.id === id ? { id: t.id, text: t.text, completed: !t.completed, createdAt: t.createdAt } : t;
      });
      _save();
      _render();
    }

    function _deleteTask(id) {
      _tasks = _tasks.filter(function (t) { return t.id !== id; });
      _save();
      _render();
    }

    /* -- Wire events ------------------------------------------------- */

    if (addBtn) { addBtn.addEventListener('click', _addTask); }
    if (inputEl) {
      inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { _addTask(); }
      });
    }
    if (sortEl) { sortEl.addEventListener('change', _render); }

    // Initial render
    _render();
  }

  return { init: init };
}());


/* ==========================================================================
   QUICK LINKS WIDGET
   Manages a list of user-defined bookmarks (label + URL).

   localStorage key: "dashboard_links"
   Each link object: { id, label, url }
   ========================================================================== */

App.QuickLinksWidget = (function () {
  'use strict';

  var STORAGE_KEY = 'dashboard_links';
  var _links = [];

  function _load() {
    var stored = App.StorageManager.get(STORAGE_KEY);
    _links = Array.isArray(stored) ? stored : [];
  }

  function _save() {
    App.StorageManager.set(STORAGE_KEY, _links);
  }

  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  function _isValidUrl(str) {
    try {
      var u = new URL(str);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  function init(containerEl) {
    if (!containerEl) { return; }

    var labelInput = containerEl.querySelector('#link-label-input');
    var urlInput   = containerEl.querySelector('#link-url-input');
    var addBtn     = containerEl.querySelector('#link-add');
    var listEl     = containerEl.querySelector('#links-list');
    var errorEl    = containerEl.querySelector('#link-error');

    _load();

    /* -- Error helper ------------------------------------------------ */

    function _showError(msg) {
      if (!errorEl) { return; }
      if (msg) {
        errorEl.textContent = msg;
        errorEl.classList.remove('hidden');
      } else {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
      }
    }

    /* -- Render ------------------------------------------------------- */

    function _render() {
      if (!listEl) { return; }
      listEl.innerHTML = '';

      if (_links.length === 0) {
        var empty = document.createElement('p');
        empty.className = 'text-sm text-gray-400 dark:text-gray-500';
        empty.textContent = 'No links yet. Add one above.';
        listEl.appendChild(empty);
        return;
      }

      _links.forEach(function (link) {
        var wrapper = document.createElement('div');
        wrapper.className = 'flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800';

        var anchor = document.createElement('a');
        anchor.href = link.url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        anchor.className = 'flex-1 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline truncate';
        anchor.textContent = link.label || link.url;
        anchor.setAttribute('title', link.url);

        var delBtn = document.createElement('button');
        delBtn.className = 'flex-shrink-0 px-3 py-1 rounded-md bg-red-500 text-white text-xs font-semibold cursor-pointer hover:bg-red-600 active:scale-95 transition-all';
        delBtn.textContent = 'Delete';
        delBtn.setAttribute('aria-label', 'Delete link "' + (link.label || link.url) + '"');
        delBtn.addEventListener('click', function () {
          _links = _links.filter(function (l) { return l.id !== link.id; });
          _save();
          _render();
        });

        wrapper.appendChild(anchor);
        wrapper.appendChild(delBtn);
        listEl.appendChild(wrapper);
      });
    }

    /* -- Add link ----------------------------------------------------- */

    function _addLink() {
      var label = labelInput ? labelInput.value.trim() : '';
      var url   = urlInput  ? urlInput.value.trim()   : '';

      if (!url) {
        _showError('Please enter a URL.');
        if (urlInput) { urlInput.focus(); }
        return;
      }
      if (!_isValidUrl(url)) {
        _showError('Please enter a valid URL starting with http:// or https://');
        if (urlInput) { urlInput.focus(); }
        return;
      }
      var isDuplicate = _links.some(function (l) { return l.url === url; });
      if (isDuplicate) {
        _showError('"' + url + '" sudah ada dalam daftar link.');
        if (urlInput) { urlInput.focus(); }
        return;
      }

      _showError(null);
      _links.push({ id: _uid(), label: label || url, url: url });
      _save();
      _render();
      if (labelInput) { labelInput.value = ''; }
      if (urlInput)   { urlInput.value = ''; }
    }

    /* -- Wire events -------------------------------------------------- */

    if (addBtn) { addBtn.addEventListener('click', _addLink); }
    if (urlInput) {
      urlInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { _addLink(); }
      });
    }

    _render();
  }

  return { init: init };
}());

/* ==========================================================================
   APP INIT
   Wires all widgets together on DOMContentLoaded.
   Populated as each widget module is added in subsequent tasks.
   ========================================================================== */

App.init = function () {
  'use strict';

  // Apply saved theme (guard: the inline <script> in HTML may have already
  // set data-theme, but calling applyInitial() again is idempotent).
  App.ThemeManager.applyInitial();

  // Check localStorage availability; show persistent banner if unavailable
  // (full implementation in Task 15.1).
  if (!App.StorageManager.isAvailable()) {
    _showStorageWarningBanner();
  }

  // Wire theme toggle button (present in index.html).
  var themeToggleBtn = document.getElementById('theme-toggle');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', function () {
      App.ThemeManager.toggle();
      _updateThemeToggleLabel(themeToggleBtn);
    });
    // Sync the button label/icon to the current theme on load.
    _updateThemeToggleLabel(themeToggleBtn);
  }

  // Initialise ClockWidget (Requirements 1.1, 1.2, 1.3, 1.4)
  var clockContainer = document.getElementById('clock-container');
  if (clockContainer) {
    App.ClockWidget.init(clockContainer);
  }

  // Initialise GreetingWidget (Requirements 2.1–2.8)
  var greetingContainer = document.getElementById('greeting-container');
  if (greetingContainer) {
    App.GreetingWidget.init(greetingContainer);
  }

  // Initialise FocusTimerWidget (Requirements 3.1–3.10)
  var timerContainer = document.getElementById('timer-container');
  if (timerContainer) {
    App.FocusTimerWidget.init(timerContainer);
  }

  // Initialise TaskWidget
  var tasksContainer = document.getElementById('tasks-container');
  if (tasksContainer) {
    App.TaskWidget.init(tasksContainer);
  }

  // Initialise QuickLinksWidget
  var linksContainer = document.getElementById('links-container');
  if (linksContainer) {
    App.QuickLinksWidget.init(linksContainer);
  }

  // Additional widget initialisation calls will be added in subsequent tasks.
};

/**
 * Update the theme toggle button's aria-label and visible emoji icon to
 * reflect the *next* theme (i.e. the action the button will perform).
 *
 * @param {HTMLButtonElement} btn
 */
function _updateThemeToggleLabel(btn) {
  var current = document.documentElement.getAttribute('data-theme');
  var isDark = current === 'dark';
  btn.setAttribute(
    'aria-label',
    isDark ? 'Switch to light theme' : 'Switch to dark theme'
  );
  // Show the icon that represents the *opposite* theme so the toggle acts as
  // a preview of what activating it will do.
  btn.textContent = isDark ? '☀️' : '🌙';
}

/**
 * Render a non-dismissible warning banner when localStorage is unavailable.
 * Full banner wiring is implemented in Task 15.1; this is the ThemeManager
 * task's minimal stub used by App.init().
 */
function _showStorageWarningBanner() {
  var banner = document.createElement('div');
  banner.setAttribute('role', 'alert');
  banner.setAttribute('aria-live', 'assertive');
  banner.className = 'storage-warning-banner';
  banner.textContent =
    'Warning: Local storage is unavailable. Your settings will not be saved across sessions.';
  if (document.body) {
    document.body.insertAdjacentElement('afterbegin', banner);
  }
}

document.addEventListener('DOMContentLoaded', App.init);
