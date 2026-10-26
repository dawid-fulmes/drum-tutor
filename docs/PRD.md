# Drum Tutor — Product Requirements Document (MVP)

## 1. Purpose

Drum Tutor is a practice app for drummers of every level. It solves two problems:

1. **Time lost searching for exercises.** Users get a curated library of ready-to-play exercises instead of hunting for material.
2. **Lack of motivation and visibility into practice.** Users see how much time they spend practicing each skill area (tag), which encourages regular practice and makes progress visible.

The first iteration exists to **validate the business logic** (library, exercise flow, completion logging, rating, statistics). Security and social features are deliberately out of scope.

## 2. Goals, non-goals, anti-goals

**Goals (MVP)**
- A browsable, filterable, sortable library of exercises (lessons) curated by an admin.
- A self-contained exercise player: count-in, metronome, timer, automatic completion.
- Reliable logging of completed exercises (lesson, duration, tempo, timestamp).
- Lesson rating (1–5), unlocked only after the user has completed the lesson at least once.
- A per-tag daily practice volume chart.

**Non-goals (MVP)** — deliberately postponed
- Authentication and authorization (no passwords, no protected admin panel).
- Social features other than rating (no comments, sharing, following, leaderboards).
- Payments / subscriptions.
- Editing lessons that already have completion logs (handled in a later iteration).
- Pausing an exercise.
- Playback of the groove itself (only a metronome click).
- Time signatures other than 4/4, subdivisions finer than eighth notes, multi-bar exercises, instruments beyond snare / closed hi-hat / kick.
- Text search in the library.
- Additional statistics (total time, streaks, goals).
- Logging of abandoned / failed attempts.

**Anti-goals** — the MVP fails if any of these happen, even if it "works"
- A practice session that was stopped early is counted as completed.
- Statistics show time the user did not actually practice (e.g. count-in time counted, abandoned sessions counted).
- Historical statistics silently change after the fact.
- A user can rate a lesson they have never completed.

## 3. Users and roles

| Role               | Description                                                                                               |
| ------------------ | --------------------------------------------------------------------------------------------------------- |
| **Drummer (user)** | Any drummer, beginner to advanced. Browses the library, practices, rates lessons, views their statistics. |
| **Super admin**    | Configures the content: lessons and the tag dictionary.                                                   |

### Identification (MVP)

- The login screen has a single **email** field. Entering an email logs the user in; if no user with that email exists, one is created automatically. No password, no verification.
- The admin panel lives at **`/admin`** and is **open to anyone who knows the URL**. This is an accepted, known risk of the MVP, made to keep focus on the business logic.

### Audience of the MVP

- The MVP is an **internal test** to validate the business logic, used by a small known group.
- MVP data (accounts, logs, ratings, lessons) is **disposable**: it does not need to be migrated to the iteration that introduces real authentication.

## 4. Domain concepts

### 4.1 Lesson

A lesson is a single exercise (e.g. "single strokes on a pad in eighth notes", "money beat").

| Property             | Rules                                                                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Name                 | Required.                                                                                                                                          |
| Description          | Required, plain text.                                                                                                                              |
| Difficulty           | One of: `beginner`, `intermediate`, `advanced`.                                                                                                    |
| Tags                 | At least one, chosen from the tag dictionary.                                                                                                      |
| Recommended tempo    | BPM, range 30–300. The user may override it before starting.                                                                                       |
| Recommended duration | Stored in **seconds**. The admin sets it in 30-second steps, range 30 s – 60 min. The user may override it before starting (same steps and range). |
| Signature            | The notation of the exercise (see 4.2).                                                                                                            |
| Status               | `draft` or `published`. Only published lessons are visible to drummers.                                                                            |
| Created at           | Used for sorting.                                                                                                                                  |

### 4.2 Signature (exercise notation)

- Always **exactly one bar in 4/4**, divided into **8 eighth-note slots**.
- Each slot has:
  - a list of instruments played on that slot — allowed values: `snare`, `hihat-closed`, `kick` (an empty list = rest);
  - an optional short comment (e.g. sticking `R` / `L`).
- The signature is stored with a format version (`v1` today) and drawn as drum notation. A lesson can be published only when its signature has at least one note (ADR-0050, ADR-0051, ADR-0053).

Examples:
- **Single strokes on a pad:** 8 slots, each with `snare`, comments alternating `R`, `L`, `R`, `L`…
- **Money beat:** 8 slots with `hihat-closed`; slots on beats 1 and 3 (slots 1 and 5) also have `kick`; slots on beats 2 and 4 (slots 3 and 7) also have `snare`.

### 4.3 Tag

- A dictionary managed by the admin, with unique names (prevents duplicates such as "weak hand" vs "Weak Hand").
- Examples: hand speed, weak hand, kick drum foot, hi-hat foot, rudiments.

### 4.4 Practice log (completed exercise)

Created only when an exercise runs to the end. Contains:
- user,
- lesson,
- duration in **seconds** (the duration chosen by the user, excluding count-in),
- tempo used (BPM),
- date and time of completion, together with the user's **local calendar date at the moment of completion** (so the day a session belongs to never changes afterwards — see 5.6).

### 4.5 Rating

- Integer 1–5.
- One rating per user per lesson; the user may change it at any time. A rating cannot be removed, only changed (ADR-0056).
- Allowed only if the user has at least one practice log for that lesson.
- A lesson's displayed rating = average of all users' ratings + number of ratings.
- Sorting by rating orders by the average; lessons with the same average are ordered by number of ratings (ADR-0057).

## 5. User stories

A checked story is implemented and verified end to end. The scope that delivered it is listed in [docs/specs/](specs/README.md) (US-1: `project-foundation`; US-3, US-4, US-16, US-17a, US-18, US-19: `lessons-and-tags`; US-7, US-8, US-9, US-10, US-11, US-11a, US-11b, US-14, US-15: `practice-and-stats`; US-17: `signature`; US-2, US-5, US-6, US-12, US-13: `rating`).

### 5.1 Identification

- [x] **US-1** As a drummer, I enter my email and get into the app; if I am new, my account is created automatically.

### 5.2 Library

- [x] **US-2** As a drummer, I browse the **paginated** list of lessons. Each item shows: name, difficulty, tags, average rating with rating count, recommended tempo and duration. Filters and sorting apply to the whole result set, not only the current page.
- [x] **US-3** As a drummer, I filter by tags. Selecting multiple tags **narrows** the results: a lesson must have **all** selected tags.
- [x] **US-4** As a drummer, I filter by difficulty. I can select one or more levels; a lesson matching **any** selected level is shown.
- [x] **US-5** As a drummer, I sort by creation date (newest / oldest) or by average rating. Lessons with no ratings go last when sorting by rating. Sorting by rating is the default (ADR-0058).

### 5.3 Lesson start screen

- [x] **US-6** As a drummer, I open a lesson and see its name, description, difficulty, tags, rating and the signature rendered from its configuration.
- [x] **US-7** As a drummer, before starting, I can change the tempo and the duration (pre-filled with the recommended values, within the allowed ranges).

### 5.4 Practice session

- [x] **US-8** As a drummer, I press play and hear **4 count-in clicks** at the chosen tempo; the count-in does not count toward the exercise duration.
- [x] **US-9** During the exercise I hear a metronome click on **every quarter note**, with an **accent on beat 1**, and see a timer counting the chosen duration.
- [x] **US-10** I can **stop** the exercise at any time. A stopped exercise is not completed and **nothing is logged**. There is no pause.
- [x] **US-11** When the timer reaches the end, the exercise ends automatically, counts as **completed**, and a practice log is saved (lesson, duration in seconds, tempo, completion timestamp).
- [x] **US-11a** If the session is interrupted in a way that stops the metronome (the user leaves the app / tab, the screen locks, the app is closed), it is treated as **stopped** and nothing is logged. _(Claude's call.)_
- [x] **US-11b** If saving the log of a completed exercise fails (e.g. no connection), the user is told and the save is retried until it succeeds, without creating duplicate logs. _(Claude's call.)_

### 5.5 Rating

- [x] **US-12** As a drummer who has never completed a lesson, I see the rating control **disabled**, with a call to action to try the lesson first.
- [x] **US-13** As a drummer who has completed a lesson at least once, the rating control is active; I can rate 1–5 and change my rating later.

### 5.6 Statistics

- [x] **US-14** As a drummer, I pick a **tag** and a **period** (week, month or year) and see a chart of **minutes practiced per day** for that tag in that period.
- [x] **US-15** I can page to the previous / next period to follow my progress over consecutive weeks, months or years.
- Rules:
  - A practice log counts the **full duration** toward **every** tag of its lesson (so the sum over tags may exceed the real total practice time — this is intended).
  - Days without practice show 0.
  - Day boundaries follow the **user's local time at the moment of completion** (a session finished at 23:30 belongs to that day), and the assigned day never changes afterwards, even if the user later views statistics in another time zone. _(Claude's call.)_
  - The year view shows weekly totals (Monday–Sunday weeks clipped to the year) instead of 365 daily bars, see ADR-0041.

### 5.7 Admin panel (`/admin`)

- [x] **US-16** As an admin, I manage the tag dictionary: add tags, rename tags (always allowed), delete tags (only when not assigned to any lesson). Tag names are unique.
- [x] **US-17** As an admin, I create a lesson with all properties from 4.1, including building the 8-slot signature (instruments + comment per slot). A new lesson starts as a **draft**, invisible to drummers, which I can freely edit or delete.
- [x] **US-17a** As an admin, I **publish** a draft to make it visible in the library. As long as nobody has completed the lesson yet, I can move it back to **draft**; once it has at least one practice log, it stays published.
- [x] **US-18** As an admin, I can edit or delete a lesson **only if no user has completed it yet**. Once at least one practice log exists, the lesson is locked (this keeps historical statistics stable).
- [x] **US-19** As an admin, I see the list of lessons with their status (draft / published) and can tell which ones are locked.

## 6. Business rules summary

| #   | Rule                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Only exercises that run to the end are logged; stopped exercises leave no trace.                                                                             |
| R2  | Count-in time is never part of the logged duration.                                                                                                          |
| R3  | Rating requires at least one completed log of that lesson by that user.                                                                                      |
| R4  | One rating per user per lesson, editable.                                                                                                                    |
| R5  | Tag filter = AND; difficulty filter = OR.                                                                                                                    |
| R6  | Statistics attribute the full log duration to each tag of the lesson.                                                                                        |
| R7  | A lesson with at least one log cannot be edited or deleted.                                                                                                  |
| R8  | A tag can be deleted only when no lesson uses it; renaming is always allowed.                                                                                |
| R9  | A lesson must have at least one tag.                                                                                                                         |
| R10 | Tempo 30–300 BPM; duration 30 s – 60 min in 30-second steps; durations are always stored in seconds.                                                         |
| R11 | New lessons are drafts; only published lessons appear in the library and can be practiced. A published lesson can return to draft only while it has no logs. |
| R12 | A log's day is fixed at completion time in the user's local time.                                                                                            |
| R13 | The library list is paginated; filters and sorting apply across all pages.                                                                                   |

## 7. Product decisions

- UI language: **English**.
- The detailed look of screens (library, lesson start screen, exercise player, statistics chart, admin forms) will be designed in a later step; this document defines the data and behavior each view needs.

## 8. Out of scope / future iterations

- Real authentication and a protected admin role.
- Editing lessons that already have logs (requires deciding how historical statistics react to changed tags).
- Pause, groove playback, richer notation (other meters, sixteenths, more instruments, multi-bar patterns; see ADR-0051).
- More statistics (total time, streaks, goals), search, social features, payments.
