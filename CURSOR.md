# PitWall - Cursor Agent Instructions

> Read this file before writing a single line of code.
> These rules are non-negotiable and apply to every file in this project.

---

## What This Project Is

PitWall is a production-grade F1 fan analytics web app.
It is not a prototype. It is not a demo. Every feature built here
should be something you would be comfortable shipping to real users.

**Stack:**
- Frontend: Vue 3 (Composition API, `<script setup>`), Pinia, Vue Router 4, Vite, Tailwind CSS, Chart.js + vue-chartjs, @vueuse/motion, TypeScript
- Backend: Vercel serverless functions under `/api`
- Data: OpenF1 API + Ergast API
- AI layer: Anthropic Claude API - backend only, never frontend

---

## Rule 1 - Never Call External APIs From the Frontend

This is the most important rule in this file.

The Claude/Anthropic API must **only** be called from `/api` serverless functions.
Never import or call the Anthropic SDK or fetch Anthropic endpoints from any file inside `/src`.
The same applies to any API that requires a secret key.

**Why:**
- API keys in frontend code are visible in browser DevTools
- CORS will block direct Anthropic calls from the browser anyway
- There is no way to rate limit frontend API calls
- A single leaked key can drain credits or compromise the project

**Correct pattern:**
```
Frontend → POST /api/generateRaceStory → Vercel function → Anthropic API
```

If you are about to write a `fetch()` to `api.anthropic.com` inside `/src`, stop and create a `/api` endpoint instead.

---

## Rule 2 - Rate Limiting on Every /api Endpoint

Every single Vercel serverless function must have rate limiting. No exceptions. Even internal-feeling endpoints.

**Implementation** (in-memory, no external dependencies):
- Use a module-level `Map<string, { count: number, resetTime: number }>`
- Key by client IP from `x-forwarded-for` header
- Limits:
  - `/api/generateRaceStory` → 5 requests per IP per hour
  - `/api/generateTelemetryExplainer` → 10 requests per IP per hour
  - `/api/generateChartOneLiners` → 5 requests per IP per hour
- On limit exceeded: return HTTP 429 with `{ error: 'Rate limit exceeded', retryAfter: seconds }`
- Reset count when `Date.now() > resetTime`

Rate limiter logic lives in `/api/_rateLimit.ts` and is imported by every endpoint. Do not copy-paste it into each file.

---

## Rule 3 - Input Validation With Zod on Every Endpoint

Every `/api` endpoint that accepts a request body must validate that body with a Zod schema before doing anything else.

**Pattern:**
1. Define schema at top of file
2. Parse request body with `schema.safeParse()`
3. If parse fails: return HTTP 400 with the zod error details
4. Only proceed if parse succeeds

Never trust the shape of data coming from the frontend.
Never use `as SomeType` to cast unvalidated data.

```ts
const schema = z.object({
  season: z.number().int().min(2020).max(2030),
  round: z.number().int().min(1).max(24),
  driverA: z.string().length(3).toUpperCase(),
  driverB: z.string().length(3).toUpperCase(),
})
const result = schema.safeParse(body)
if (!result.success) return res.status(400).json({ error: result.error })
```

---

## Rule 4 - Secrets Management

Never hardcode any API key, token, or secret anywhere in the codebase.
Never commit a `.env` file. Never commit a `.env.local` file.

```
ANTHROPIC_API_KEY  →  used only in /api functions (never VITE_ prefixed)
```

`VITE_` prefixed variables are bundled into the frontend and visible to users.
The Anthropic key must **never** have the `VITE_` prefix.

A `.env.example` file must exist at the project root with placeholder values:
```
ANTHROPIC_API_KEY=your_key_here
```

`.env.local` must be in `.gitignore` - verify this before the first commit.

In each `/api` function, check `process.env.ANTHROPIC_API_KEY` at the top.
If missing, return HTTP 500 with `"Server misconfiguration"` only.
Never expose which specific key is missing in the error response.

---

## Rule 5 - TypeScript: No `any`, No Exceptions

The word `any` should not appear in this codebase.

All OpenF1 and Ergast API response shapes have TypeScript interfaces defined in `src/types/openf1.ts` and `src/types/ergast.ts`. Use them everywhere.

If you do not know the shape of an API response, check the OpenF1 docs at https://openf1.org or look at the existing interfaces in `src/types/` before inventing a shape or falling back to `any`.

Unknown third-party shapes should use `unknown` and be narrowed with a type guard before use - not cast with `as` or typed as `any`.

If you find yourself writing `any`, ask: what is the actual shape here? Then define it.

---

## Rule 6 - Error Handling Everywhere

Every async function must have a `try/catch`.
Every API call must handle network failures gracefully.
The user must never see an unhandled error or a blank screen.

**Frontend error states - every chart component must have three states:**
- `loading`: skeleton with pulse animation matching existing card styles
- `error`: friendly message + retry button where appropriate
- `data`: the actual chart

Never show raw error messages or stack traces to the user.

**Backend error responses must always be JSON:**
```ts
{ error: string, code?: string }
```
Never return plain text errors from `/api` functions.

**Retry logic on OpenF1 API calls** (via `src/api/retry.ts`):
- 3 retries max
- Delays: 500ms, 1000ms, 2000ms (exponential)
- Only retry on network errors or 5xx responses
- Never retry on 4xx - retrying a client error won't help

---

## Rule 7 - Caching Strategy

Two levels of caching exist in this project. Respect both.

**Level 1 - API response cache (`src/api/cache.ts`):**
- In-memory Map, TTL of 5 minutes
- Wraps all OpenF1 and Ergast fetch calls via `cached()`
- Never fetch the same endpoint twice in the same session

**Level 2 - Claude response cache (sessionStorage):**
- Key pattern: `pitwall_{endpoint}_{season}_{round}_{driverA}_{driverB}`
- Check cache before calling `/api` endpoint
- Store result in cache after successful response
- This is the primary cost control mechanism for Claude calls

Never bypass either cache layer to "get fresh data" unless the user has explicitly triggered a manual refresh action.

---

## Rule 8 - Component Structure

Every Vue component must follow this structure in order:
1. `<script setup lang="ts">` - props, emits, composables, logic
2. `<template>` - markup only, minimal logic
3. `<style scoped>` - component-specific styles only

**No logic in templates beyond:**
- `v-if` / `v-else` / `v-show`
- `v-for` with a key
- Simple ternaries for class bindings
- Event handler references (not inline functions)

If you are writing a method call with arguments in the template, move that logic to a computed property or a function in `<script setup>`.

```ts
// Props must always be typed
defineProps<{ title: string; loading: boolean }>()

// Emits must always be typed
defineEmits<{ driverSelected: [code: string] }>()
```

---

## Rule 9 - Commenting Standard

Every function needs a JSDoc block. Every non-obvious transformation needs an inline comment. This is not optional.

**JSDoc block must include:**
- What the function does (one line)
- Which data source / API endpoint it uses
- What the return shape is
- Why a non-obvious approach was chosen (if applicable)

**Good comment:**
```ts
/**
 * Converts time-series car telemetry to distance-series.
 *
 * Data source: OpenF1 /car_data (speed in km/h per timestamp)
 *
 * We integrate speed over time to estimate cumulative distance because
 * OpenF1 does not provide GPS coordinates on the free tier. This is an
 * approximation - accuracy degrades slightly on slow corners but is
 * consistent enough for driver-vs-driver comparison.
 *
 * Returns: CarDataSample[] with an added `distance` field in metres
 */
```

**Bad comments - never write these:**
```ts
// loop through laps
// call the API
// set loading to false
```

Comments explain **why**, not **what**. The code already shows what.

---

## Rule 10 - Do Not Modify Working Code

If a feature is already built and working, do not touch it unless the current task explicitly requires a change to it.

Before modifying any existing file, ask:
> "Does this task require me to change this file, or can I achieve the goal by only adding new files?"

**If you must modify an existing file:**
- Only change the specific lines the task requires
- Do not reformat, rename, or reorganise surrounding code
- Do not change existing function signatures
- Add new functions below existing ones, never interleaved

This rule exists because refactoring working code to match a style preference is how regressions get introduced.

---

## Rule 11 - Build Order Discipline

Always build in this order. Never skip steps.

```
1. Types        → define interfaces in src/types/ before writing logic
2. API layer    → fetch functions with cache wrapper
3. Store        → Pinia state and actions
4. Composables  → business logic, computed insights
5. Backend      → /api functions with validation + rate limiting
6. Components   → charts, cards, tables
7. Views        → assemble components, wire up store
```

If you are writing a Vue component before the store action that feeds it exists, you are building in the wrong order. Stop and build the data layer first.

---

## Rule 12 - Dependency Discipline

Do not add a new npm package without a clear reason.

**Before installing anything ask:**
- Can this be done with what is already installed?
- Is this package actively maintained?
- Is this the standard choice for Vue 3 + Vite, or a random find?

**Pre-approved packages:**
```
vue, vue-router, pinia, vite, typescript, tailwindcss,
chart.js, vue-chartjs, chartjs-chart-box, @vueuse/motion,
zod, @anthropic-ai/sdk (backend only)
```

For anything not on this list: add a comment in the commit explaining why the package is necessary and what it replaces.

---

## Rule 13 - Performance Baselines

These are minimums, not targets.

- No chart renders more than 500 data points - sample or aggregate first
- Car telemetry data (~4 samples/second × race duration) must be filtered to a single lap before storing or rendering
- No component fetches data in `onMounted` if that data can be loaded in the parent view and passed as a prop
- All images must have explicit width and height to prevent layout shift
- Route-level code splitting is enabled by default in Vue Router - do not import views statically in the router

---

## Rule 14 - Fan-Friendly Output Standard

This is an F1 analytics app for everyday fans, not engineers.

**Every chart must have:**
- A plain-English title - not `"Lap Duration Distribution"`, yes `"Lap Times"`
- A subtitle explaining what the chart reveals in one sentence
- A Claude-generated one-liner insight below it via `ChartWrapper.vue`
- Tooltips that show deltas, not just raw values

**Number formatting rules:**
- Lap times: always `M:SS.mmm` format - never raw seconds to the user
- Gaps: always `+X.XXXs` or `-X.XXXs` with the sign explicit
- Speeds: always `XXX km/h` with unit label
- Tyre age: `"Lap X on this tyre"` not just `"X laps"`

Never show raw API response field names to the user.
`duration_sector_1` is not a label. `Sector 1` is.

---

## Project File Structure

```
src/
├── api/
│   ├── openf1.ts             # OpenF1 fetch functions
│   ├── ergast.ts             # Ergast fetch functions
│   ├── cache.ts              # In-memory cache wrapper (TTL 5 min)
│   ├── retry.ts              # Exponential backoff utility
│   └── claudeInsights.ts     # Frontend cache + /api call wrapper
├── stores/
│   ├── raceStore.ts          # Race results, laps, stints, telemetry
│   └── seasonStore.ts        # Season schedule, standings
├── composables/
│   ├── useRaceData.ts        # Store + API composable
│   ├── useInsights.ts        # Insight generation logic
│   ├── usePostRacePipeline.ts # Orchestrated post-race data load
│   └── useCountdown.ts       # Next race countdown
├── components/
│   ├── ui/                   # DriverBadge, TyreChip, InsightCard, ChartWrapper
│   ├── charts/               # Breakdown charts (heatmap, degradation, etc.)
│   └── telemetry/            # Speed, throttle, brake, gear traces
├── views/
│   ├── HomeView.vue          # Home - last race + countdown + standings
│   ├── RaceView.vue          # Race - all tabs including Breakdown
│   ├── DriversView.vue       # Driver standings + pace comparison
│   ├── TeamsView.vue         # Constructor standings + pit performance
│   └── TelemetryView.vue     # Deep dive - driver vs driver telemetry
├── types/
│   ├── openf1.ts             # All OpenF1 response interfaces
│   └── ergast.ts             # All Ergast response interfaces
├── constants/
│   └── teams.ts              # Team colors, driver codes, full names
└── router/
    └── index.ts              # Vue Router configuration

api/                          # Vercel serverless functions
├── _rateLimit.ts             # Shared rate limiter - imported by all endpoints
├── generateRaceStory.ts      # Claude race narrative
├── generateChartOneLiners.ts # Batch chart one-liners
└── generateTelemetryExplainer.ts # Telemetry plain-English explanation
```

---

## Before Starting Any Task - Checklist

Read every item before writing code. If any answer is wrong, fix it first.

- [ ] Have I read the relevant rules in this file?
- [ ] Am I building in the correct order: types → api → store → composables → backend → components → views?
- [ ] Does every new `/api` endpoint have rate limiting AND zod validation?
- [ ] Does every new file have zero `any` types?
- [ ] Does every new async function have a `try/catch`?
- [ ] Does every new chart component use `ChartWrapper.vue`?
- [ ] Have I added JSDoc to every new function including source, return shape, and why?
- [ ] Am I modifying any working code that this task does not require me to touch?
- [ ] Am I adding a dependency that is not on the pre-approved list?
- [ ] Will a casual F1 fan understand every label, tooltip, and number in my UI?

---

> These rules are non-negotiable. They exist to protect the project, the API keys, and the users.
