# Food Crawl Planner — CLAUDE.md

## What This Is
A web app where users search for cafes/restaurants, build a list of spots (max 8), and get an optimised route based on their current location.

## Architecture Overview
```
User → Cloud Run (frontend: Next.js) → Cloud Run (backend: Express proxy) → Google APIs
                                                      ↓
                                                  Firestore (crawl persistence)
                                                  Cloud Logging (analytics events)
                                                  Secret Manager (API keys)
```

All infrastructure on GCP, region australia-southeast2, managed via Terraform.

## Project Structure
```
/web          — Next.js 14 App Router (TypeScript, Tailwind CSS v4)
/cloud-run    — Node/Express proxy backend
/terraform    — GCP infrastructure (Terraform)
/deploy.sh    — One-command deployment script
/firestore.rules — Firestore security rules (deny all client access)
```

## Tech Stack
- Next.js (App Router), TypeScript
- Tailwind CSS v4 (utility-first, CSS-based config in globals.css)
- shadcn/ui (base-nova style) for base components
- Framer Motion for animations
- @vis.gl/react-google-maps for the map
- @dnd-kit for drag-to-reorder crawl list
- Firestore for crawl persistence (active from launch)
- firebase-admin SDK (backend only, via Admin SDK — bypasses Firestore rules)

## Commands
```bash
cd web && npm run dev      # Start frontend dev server
cd web && npx next build   # Frontend production build
cd cloud-run && npm run dev # Start backend dev server
bash deploy.sh             # Build, push, and deploy everything (use bash, not ./)
```

## Environment Variables

### Frontend (web/.env.local)
| Variable | Where | Who Sets |
|---|---|---|
| `NEXT_PUBLIC_PROXY_URL` | .env.local / Cloud Run env | Terraform output |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | .env.local / Secret Manager | Terraform |

### Backend (Cloud Run env vars)
| Variable | Where | Who Sets |
|---|---|---|
| `MAPS_API_KEY` | Secret Manager | Terraform |
| `ANTHROPIC_API_KEY` | Secret Manager | Terraform |
| `GOOGLE_ROUTES_API_KEY` | Secret Manager | Terraform |
| `ALLOWED_ORIGINS` | Cloud Run env | Terraform (comma-separated) |
| `FIRESTORE_PROJECT_ID` | Cloud Run env | Terraform |
| `NODE_ENV` | Cloud Run env | Terraform (hardcoded: "production") |
| `FEATURE_LIMITS_ENABLED` | Cloud Run env | Terraform (default: "false") |

## API Routes

### Existing Routes (unchanged)
- `POST /api/search` — body: `{ searchQuery, maxResultCount?, mapCenter? }` → `{ places }`
- `GET /api/place/:placeId` — returns full place details
- `POST /api/parse` — NLP parse (Chrome extension only)
- `POST /api/photos` — batch photo resolution

### New Routes (Prompt 2)

#### POST /api/optimise
Request: `{ origin: { lat, lng }, places: [{ placeId, lat, lng }] }`
Validation: origin valid lat/lng, places 2–8 items, placeId matches `/^[A-Za-z0-9_-]{1,256}$/`
Response: `{ orderedPlaceIds: string[] }`
Backend: Calls Google Routes API (computeRoutes), minimises travel time

#### POST /api/crawl
Request: `{ places: [placeId], name: string, sessionId: string }`
Validation: places 1–8, placeId regex, name max 60 chars HTML-stripped, sessionId UUID
Response: `{ slug: string, url: string }`
Backend: Generates 6-char nanoid slug, writes to Firestore "crawls" collection

#### POST /api/event
Request: `{ event, sessionId, timestamp, suburb, searchQuery, placeType }`
Validation: event must be one of: search_performed, place_added, crawl_planned, crawl_shared
Response: `{ ok: true }` (always 200)
Backend: Logs to Cloud Logging only — no database write

#### GET /api/resolve
Request: `?url=ENCODED_URL`
Validation: only accepts `https://maps.app.goo.gl/*` — rejects all other URLs
Response: `{ resolvedUrl: string }`
Backend: Follows redirect server-side, validates resolved URL is google.com/maps

## Firestore Schema

Collection: `crawls`
```
{
  slug: string        // 6-char nanoid, used as document ID
  places: string[]    // array of placeIds
  name: string        // crawl name, max 60 chars, HTML-stripped
  createdAt: timestamp
  sessionId: string   // anonymous user UUID
}
```

## Visual Design — Non-Negotiable
- Modern, glassy, dewy. Terracotta hero colour (#C1440E)
- Custom terracotta palette defined in globals.css @theme: terracotta, terracotta-light, terracotta-muted, terracotta-50
- Background: warm gradient (amber-50 → stone-50 → orange-50)
- Glass cards: .glass-card / .glass-card-elevated classes in globals.css
- Text: text-stone-800 (deep charcoal, never pure black)
- Font: Lora (serif) as primary font
- Buttons: bg-terracotta text-white hover:bg-terracotta-light
- Not clinical. Not Bootstrap. Something people want to screenshot.

## Place Card Data Model
```typescript
{
  placeId: string
  name: string
  suburb: string
  address: string
  rating: number
  priceLevel: number       // 1–4
  isOpenNow: boolean
  photoUrl: string | null
  lat: number
  lng: number
  sponsored: boolean       // renders "Featured" badge when true
}
```

## Key Patterns
- **Search**: Debounced 300ms → POST /api/search → compact dropdown (5 results max) → keyboard navigable
- **URL paste**: Detect Google Maps URL → parseURL() in /web/src/lib/parseURL.ts → skip dropdown → resolve to card
- **Session**: UUID generated on first visit → stored in localStorage → passed as X-Session-ID header
- **Cache**: localStorage keyed by placeId + date, purge >2 days on app load
- **Analytics**: Fire-and-forget POST /api/event (no await, no error handling)

## Animations (Framer Motion)
- Dropdown: fade in, 0.15s
- Place card: fade up y:10→0, 0.2s
- Crawl list item: scale 0.95→1, 0.15s
- List reorder: layout animation only
- No bouncing, no infinite loops

## Security Notes

### CORS
- Backend reads `ALLOWED_ORIGINS` env var (comma-separated)
- Every request checked against the list — exact origin match only
- Health check (`/health`) bypasses CORS (no Origin header)

### Request Validation
- `express.json({ limit: '10kb' })` on all routes
- Content-Type: application/json enforced on all POST routes
- All placeId fields: `/^[A-Za-z0-9_-]{1,256}$/`
- Field-level validation on all new routes

### Error Handling
- Raw errors never returned to client — generic messages only
- Full error details to Cloud Logging
- Consistent shape: `{ error: string, code: string }`

### Firestore Rules
- All client access denied (`allow read, write: if false`)
- Backend uses Admin SDK which bypasses rules — intentional
- Deploy rules via: `firebase deploy --only firestore:rules`

### Secret Handling
- All API keys in Secret Manager, injected as env vars at runtime
- No hardcoded fallbacks
- Backend checks required env vars on startup — exits if missing

### CSP Headers (frontend)
- Configured in web/next.config.ts headers()
- default-src 'self', connect-src scoped to proxy + Maps API
- HSTS, X-Frame-Options DENY, nosniff, strict referrer policy

## Deploy Instructions

### Prerequisites
1. Create GCS bucket: `gcloud storage buckets create gs://BUCKET_NAME --location=australia-southeast2`
2. Authenticate: `gcloud auth login && gcloud auth application-default login`
3. First time only — migrate existing local state:
   ```
   cd terraform
   terraform init -backend-config="bucket=$TF_STATE_BUCKET"
   ```

### Deploy
All env vars must be exported in the **same shell session** that runs deploy.sh:
```bash
export PROJECT_ID=arched-champion-489804-s5
export TF_STATE_BUCKET=your-bucket-name
export TF_VAR_anthropic_key="your-key"
export TF_VAR_google_maps_key="your-key"
export TF_VAR_google_routes_key="your-key"
bash deploy.sh
```

### Windows / MINGW64 Note
The orphan detection check uses `gcloud` commands that hang on Windows (MINGW64 / Google Cloud SDK shell). Skip it with:
```bash
SKIP_ORPHAN_CHECK=1 bash deploy.sh
```
Or: `bash deploy.sh --skip-orphan-check`

If `terraform apply` then errors with "already exists", run the `terraform import` command from the error message manually.

### What deploy.sh does
1. Pre-flight: validates env vars, checks tools (gcloud, terraform, docker)
2. Optionally detects orphaned GCP resources and auto-imports into Terraform state
3. Reads `image_tag` and `frontend_image_tag` from `terraform.tfvars` to tag Docker images consistently
4. Builds and pushes backend + frontend Docker images to Artifact Registry
5. Runs `terraform apply`
6. Two-pass: reads frontend URL from output, adds to `allowed_origins` in tfvars, re-applies so backend CORS is correct

### Image Tags
- Backend tag: set `image_tag` in `terraform/terraform.tfvars` (e.g. `"v8"`, `"latest"`)
- Frontend tag: set `frontend_image_tag` in `terraform/terraform.tfvars` (default: `"latest"`)
- deploy.sh reads these values and uses them for `docker build`/`push` so the pushed tag matches what Terraform deploys

## Terraform State Backend
- GCS bucket, path prefix `food-crawl/state`
- Bucket name passed via `-backend-config="bucket=..."` at init time
- Versioning enabled on the bucket recommended

## Feature Flag Reference
| Flag | Default | Purpose |
|---|---|---|
| `FEATURE_LIMITS_ENABLED` | `"false"` | Freemium usage limit enforcement. Read on startup, logged. No logic built yet — deferred to Prompt 3. |

## Known Intentional Deviations from Spec

### SearchInput maxLength
Set to 500 (not 200) because the same input field accepts both search
queries and pasted Google Maps URLs. URLs regularly exceed 200 chars.
Server-side validation enforces the 200 char limit on searchQuery
specifically. The 500 limit covers the URL paste path.

## What NOT to Build

### Deferred to Prompt 3
- Cloud Armor / VPC networking
- Load Balancer / CDN (needs domain first — set `domain_name` variable when ready)
- Feature limit enforcement logic (flag exists, logic does not)

### Permanently deferred (revisit after launch)
- User auth / accounts
- NLP search
- Business dashboard
