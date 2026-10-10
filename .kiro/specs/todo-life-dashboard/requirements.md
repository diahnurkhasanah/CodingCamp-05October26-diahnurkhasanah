# Requirements Document

## Introduction

The To-Do List Life Dashboard is a client-side web application built with HTML, CSS, and Vanilla JavaScript. It serves as a personal daily dashboard that displays the current time and date, a greeting, a focus (Pomodoro) timer, a to-do list, and quick links to favorite websites. All user data is persisted using the browser's Local Storage API. The application requires no backend, no build tools, and no external frameworks. It can be opened as a standalone web page or set as a browser homepage.

## Glossary

- **Dashboard**: The single-page web application rendered in the user's browser.
- **Clock**: The component that displays the current time and date.
- **Greeting**: The text message that addresses the user by name and varies based on time of day.
- **Focus_Timer**: The countdown timer component based on the Pomodoro technique.
- **Session**: A single countdown cycle of the Focus_Timer.
- **Task**: A single to-do item with a text description and a completion state.
- **Task_List**: The component that manages and displays all Tasks.
- **Quick_Link**: A user-defined label and URL pair rendered as a clickable button.
- **Link_Manager**: The component that manages and displays all Quick_Links.
- **Local_Storage**: The browser's `localStorage` API used to persist all user data client-side.
- **Theme**: The visual color scheme of the Dashboard, either light or dark.
- **User_Name**: The custom name entered by the user, displayed in the Greeting.

---

## Requirements

### Requirement 1: Clock Display

**User Story:** As a user, I want to see the current time and date on the dashboard, so that I always know what time it is without switching tabs.

#### Acceptance Criteria

1. THE Clock SHALL display the current local time in HH:MM:SS format (24-hour or 12-hour with AM/PM indicator), updated every 1 second.
2. THE Clock SHALL display the current date in the format: full day name, numeric day of month, full month name, and 4-digit year (e.g., Monday, 26 May 2025).
3. WHEN the Dashboard page is loaded, THE Clock SHALL begin displaying the current time and date within 1 second without requiring user interaction.
4. IF the system clock is unavailable, THEN THE Clock SHALL display an error message indicating the time cannot be retrieved.

---

### Requirement 2: Personalized Greeting

**User Story:** As a user, I want to see a greeting that uses my name and reflects the time of day, so that the dashboard feels personal and contextual.

#### Acceptance Criteria

1. WHEN the current local time is between 05:00 and 11:59, THE Greeting SHALL display the message "Good Morning, [User_Name]".
2. WHEN the current local time is between 12:00 and 17:59, THE Greeting SHALL display the message "Good Afternoon, [User_Name]".
3. WHEN the current local time is between 18:00 and 21:59, THE Greeting SHALL display the message "Good Evening, [User_Name]".
4. WHEN the current local time is between 22:00 and 04:59, THE Greeting SHALL display the message "Good Night, [User_Name]".
5. WHEN a User_Name has not been set, THE Greeting SHALL display "Friend" as the default placeholder name.
6. WHEN the user submits a new User_Name via the name input field, THE Dashboard SHALL save the User_Name to Local_Storage and update the Greeting within 100 milliseconds.
7. WHEN the Dashboard page is loaded, THE Greeting SHALL retrieve the saved User_Name from Local_Storage and display it in the greeting message.
8. IF saving the User_Name to Local_Storage fails, THEN THE Dashboard SHALL display an error message and retain the previously saved name in the Greeting.

---

### Requirement 3: Focus Timer

**User Story:** As a user, I want a countdown timer I can start, stop, and reset, so that I can work in focused sessions and take structured breaks.

#### Acceptance Criteria

1. WHEN the Focus_Timer is initialized, THE Focus_Timer SHALL display a default duration of 25 minutes and 00 seconds.
2. WHEN the user activates the Start control, THE Focus_Timer SHALL begin counting down in one-second intervals.
3. WHILE the Focus_Timer is running, THE Focus_Timer SHALL update the displayed time each second.
4. WHEN the user activates the Stop control, THE Focus_Timer SHALL pause the countdown and retain the remaining time.
5. WHEN the user activates the Reset control, THE Focus_Timer SHALL stop the countdown and restore the display to the configured session duration.
6. WHEN the Focus_Timer countdown reaches 00:00, THE Focus_Timer SHALL stop automatically, display a visible completion indicator for at least 3 seconds, and play a single audible alert.
7. WHEN the user sets a custom session duration via the duration input field, THE Focus_Timer SHALL validate that the value is a positive integer between 1 and 120 (minutes).
8. IF the user enters a duration value outside the range of 1 to 120 minutes, THEN THE Focus_Timer SHALL reject the input, display an error message indicating the valid range (1–120 minutes), and retain the previously configured duration.
9. WHEN a valid custom duration is saved, THE Focus_Timer SHALL persist the value to Local_Storage and apply it as the new default session duration on subsequent page loads.
10. IF the user activates the Start control while the Focus_Timer is already running, THEN THE Focus_Timer SHALL ignore the activation and continue the current countdown without interruption.

---

### Requirement 4: To-Do List — Add and Display Tasks

**User Story:** As a user, I want to add tasks to a list and see them displayed, so that I can track what I need to do during the day.

#### Acceptance Criteria

1. WHEN the user submits a non-empty, non-whitespace-only text value of 1–200 characters via the task input field, THE Task_List SHALL create a new Task with that text and add it to the end of the list.
2. IF the user submits an empty or whitespace-only value, THEN THE Task_List SHALL reject the input, retain focus on the task input field, and display an inline validation message indicating the task text cannot be blank.
3. IF the user submits a Task text that exceeds 200 characters, THEN THE Task_List SHALL reject the input and display an inline validation message indicating the maximum length limit.
4. IF the user submits a Task text that is identical (case-insensitive, after trimming leading and trailing whitespace) to an existing incomplete Task, THEN THE Task_List SHALL reject the input and display an inline duplicate warning message indicating the task already exists.
5. THE Task_List SHALL display all Tasks in the order they were added, showing each Task's text and completion state.
6. THE Task_List SHALL persist all Tasks (text, completion state, and creation order) to Local_Storage after every add, edit, delete, or status change operation, completing the write within 500 milliseconds of the operation.
7. WHEN the Dashboard page is loaded, THE Task_List SHALL restore all previously saved Tasks from Local_Storage and display them in their persisted order within 1 second of page load.
8. IF Local_Storage is unavailable or the saved data cannot be parsed, THEN THE Task_List SHALL display an empty task list and show an inline error message indicating tasks could not be restored.

---

### Requirement 5: To-Do List — Edit, Complete, and Delete Tasks

**User Story:** As a user, I want to edit, mark as done, and delete tasks, so that I can keep my list accurate and up to date.

#### Acceptance Criteria

1. WHEN the user activates the Edit control on a Task, THE Task_List SHALL replace the task display with an editable input field pre-filled with the current task text, accepting up to 500 characters.
2. WHEN the user confirms an edit with a valid (non-empty, non-whitespace-only) value, THE Task_List SHALL update the Task text, return to the display view, and persist the change to Local_Storage.
3. IF the user confirms an edit with an empty or whitespace-only value, THEN THE Task_List SHALL reject the change, return to the display view without modifying Local_Storage, and retain the original task text.
4. IF a Local_Storage write operation fails during an edit or delete, THEN THE Dashboard SHALL display an error message indicating the change could not be saved.
5. WHEN the user activates the Complete control on an incomplete Task, THE Task_List SHALL mark the Task as completed and apply strikethrough style on the task text.
6. WHEN the user activates the Complete control on a completed Task, THE Task_List SHALL mark the Task as incomplete and remove the strikethrough style from the task text.
7. WHEN the user activates the Delete control on a Task, THE Task_List SHALL remove the Task from the list and update Local_Storage.

---

### Requirement 6: Task Sorting

**User Story:** As a user, I want to sort my task list, so that I can view tasks in a meaningful order.

#### Acceptance Criteria

1. WHEN the user selects the "By Creation Date" sort option, THE Task_List SHALL display Tasks ordered from oldest to newest by their creation timestamp.
2. WHEN the user selects the "Active First" sort option, THE Task_List SHALL display incomplete Tasks before completed Tasks, with Tasks within each group ordered from oldest to newest by their creation timestamp.
3. WHEN the user selects the "Completed First" sort option, THE Task_List SHALL display completed Tasks before incomplete Tasks, with Tasks within each group ordered from oldest to newest by their creation timestamp.
4. WHEN the user selects the "Alphabetical (A–Z)" sort option, THE Task_List SHALL display Tasks sorted by task text in ascending alphabetical order (case-insensitive), with Tasks that have identical text ordered from oldest to newest by their creation timestamp.
5. WHEN the user selects a sort option, THE Task_List SHALL save the selected sort option to Local_Storage.
6. WHEN the page loads and Local_Storage contains a previously saved sort option, THE Task_List SHALL restore and apply that saved sort option.
7. WHEN the page loads and Local_Storage does not contain a saved sort option, THE Task_List SHALL apply the "By Creation Date" sort option as the default.

---

### Requirement 7: Quick Links

**User Story:** As a user, I want to save and open links to my favorite websites directly from the dashboard, so that I can navigate quickly without typing URLs.

#### Acceptance Criteria

1. WHEN the user submits a label (1–50 characters) and a valid URL (up to 2048 characters) via the link input form, THE Link_Manager SHALL create a new Quick_Link and add it to the displayed list.
2. IF the user submits a URL that is not a valid absolute URL (must begin with `http://` or `https://`), THEN THE Link_Manager SHALL reject the input and display a validation error message.
3. IF the user submits an empty or whitespace-only label, THEN THE Link_Manager SHALL reject the input and display a validation error message.
4. WHEN the user activates a Quick_Link button, THE Dashboard SHALL open the associated URL in a new browser tab.
5. WHEN the user activates the Delete control on a Quick_Link, THE Link_Manager SHALL remove the Quick_Link from the list and update Local_Storage.
6. THE Link_Manager SHALL persist all Quick_Links to Local_Storage after every add or delete operation.
7. WHEN the Dashboard page is loaded, THE Link_Manager SHALL restore all previously saved Quick_Links from Local_Storage.
8. IF Local_Storage is unavailable or the saved Quick_Links data cannot be parsed on page load, THEN THE Link_Manager SHALL display an empty link list and show an inline error message indicating quick links could not be restored.
9. IF the user submits a URL that is identical (case-insensitive) to an existing Quick_Link URL, THEN THE Link_Manager SHALL reject the input and display an inline duplicate warning message indicating the link already exists.

---

### Requirement 8: Light / Dark Theme

**User Story:** As a user, I want to toggle between a light and dark color scheme, so that I can use the dashboard comfortably in different lighting conditions.

#### Acceptance Criteria

1. THE Dashboard SHALL provide a visible toggle control, accessible via click or keyboard activation, that switches the Theme between light and dark.
2. WHEN the user activates the theme toggle, THE Dashboard SHALL apply the selected Theme to all visual components within 100 milliseconds without a page reload.
3. WHEN the user activates the theme toggle, THE Dashboard SHALL persist the selected Theme value to Local_Storage.
4. WHEN the Dashboard page is loaded, THE Dashboard SHALL retrieve the saved Theme from Local_Storage and apply it before the first render to prevent a flash of unstyled content.
5. IF no Theme has been saved in Local_Storage, THEN THE Dashboard SHALL apply the light Theme as the default.
6. IF Local_Storage is unavailable or returns an unrecognized Theme value, THEN THE Dashboard SHALL apply the light Theme as the default.

---

### Requirement 9: Data Persistence and Browser Compatibility

**User Story:** As a user, I want the dashboard to remember all my settings across browser sessions, so that I don't have to reconfigure it every time I open it.

#### Acceptance Criteria

1. THE Dashboard SHALL use only the browser `localStorage` API for all client-side data persistence; no cookies, no server calls, and no third-party storage libraries.
2. THE Dashboard SHALL store all persistent state (User_Name, Tasks, Quick_Links, Theme, sort preference, and Focus_Timer duration) as JSON-serialized strings under distinct `localStorage` keys.
3. WHEN the Dashboard loads, THE Dashboard SHALL read all persistent state from `localStorage` and restore the application to the previously saved configuration within 500 milliseconds.
4. WHEN any persistent state value changes, THE Dashboard SHALL write the updated value to `localStorage` before the next user interaction is processed.
5. THE Dashboard SHALL function correctly in the current stable releases of Chrome, Firefox, Edge, and Safari without polyfills or browser-specific workarounds.
6. IF `localStorage` is unavailable (e.g., private browsing with storage blocked), THEN THE Dashboard SHALL display a non-dismissible warning banner at the top of the page indicating that settings will not be saved, and continue operating with in-memory state for the current session.
7. IF a `localStorage` read operation returns a value that is not valid JSON or does not match the expected data structure for that key, THEN THE Dashboard SHALL discard the corrupted value, load the default value for that state item, and continue loading remaining state from `localStorage`.

---

### Requirement 10: Performance and Code Structure

**User Story:** As a developer and user, I want the dashboard to load fast and be built from clean, maintainable source files, so that it is easy to use and easy to extend.

#### Acceptance Criteria

1. THE Dashboard SHALL be implemented using exactly one HTML file, exactly one CSS file located in the `css/` directory, and exactly one JavaScript file located in the `js/` directory.
2. THE Dashboard SHALL load and become interactive within 2 seconds of the initial HTTP request on a connection with a download speed of at least 25 Mbps, measured from navigation start to the point at which all widgets render their initial state and respond to user input.
3. THE Dashboard SHALL produce no JavaScript console errors on initial page load in any supported browser.
4. THE Dashboard SHALL use no external JavaScript frameworks, CSS frameworks, or runtime dependencies; all logic SHALL be implemented in Vanilla JavaScript.
5. IF the Dashboard fails to load a locally stored data value on initial page load, THEN THE Dashboard SHALL display a default empty or zero state for the affected widget without producing a JavaScript console error.
