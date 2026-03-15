# Food Crawl Planner — Full Vision

## What This Is
A web app where anyone can search for cafes and restaurants, build a curated 
list of spots, and get an optimised route to visit them all in the right order 
based on their current location.

The core insight: Google Maps is great at finding one place. It's terrible at 
planning a multi-stop food outing. Nobody has built a beautiful, shareable 
solution to this that normal people actually want to use.

## Why I'm Building It
Two reasons running in parallel:

1. It's a genuinely useful product with real monetisation paths that I want 
   to explore — local business advertising, freemium SaaS, or selling to a 
   larger player once there's traction.

2. It's a public demonstration of what I can build. In the tech and product 
   world, shipping > talking. This project is proof I can take something from 
   idea to deployed infrastructure, make real architectural decisions, and 
   iterate on a product with real users.

The content strategy (LinkedIn, TikTok, Instagram) runs parallel to the build. 
The product and the personal brand grow together.

## The User
General public — no technical knowledge assumed. Specifically:
- Tourists visiting Melbourne or Sydney who want to plan a day of eating
- Locals organising a food crawl with friends for a birthday, Saturday arvo, 
  bucks/hens day
- Food content creators who film "best 5 cafes in Fitzroy" style content and 
  want a tool to plan and share their routes
- Anyone who's been frustrated that Google Maps can't answer 
  "plan me a morning hitting 4 good cafes in the CBD"

The product should feel like it was built for a person, not a user.

## The Feel
Modern, glassy, and dewy — like morning light through a cafe window. 
Terracotta as the hero colour, executed with depth and softness rather than 
flatness. Glass morphism effects where appropriate: frosted panels, 
subtle backdrop blur, dewy surface texture on cards.

Tailwind CSS utility-first — no custom CSS files where Tailwind can handle it. 
Every visual decision should be expressible as a Tailwind class combination.

- Background: warm off-white or very light cream with subtle warmth
- Accent: terracotta — rich, not orange, not brown. The colour of good 
  unglazed ceramic.
- Glass effect: backdrop-blur, semi-transparent panels with a frosted quality
- Text: deep charcoal, never pure black
- Cards: glassy surface, soft shadow, slight translucency — tactile and dewy
- Map: warm-toned, feels integrated not bolted on
- The whole thing should be something people want to screenshot and share

Not clinical. Not Bootstrap. Not "another Google Maps clone."

## The Magic Moment
The moment a user hits "Plan my crawl" and watches their list reorder itself 
into the optimal route with the map updating in real time. That's the wow. 
Everything else in the product serves that moment.

## Core Features (MVP — Build Now)
- Search input mirrors native Google Maps UX — compact dropdown on type, 
  full glassy card on select, then add to crawl list
- Paste any URL (Google Maps to start) → skips dropdown, resolves directly 
  to a full place card
- Build a crawl list of up to 8 spots
- Route optimisation based on current location
- Shareable URL that generates a proper OG preview on LinkedIn and iMessage
- Short slug URLs via Firestore (e.g. foodcrawl.app/crawl/x7k2p)
- Beautiful place cards: photo, name, suburb, rating, price level, open now
- Map view with numbered markers in route order
- Mobile responsive

## Features Deferred (Build After MVP Has Users)
- NLP natural language search: "cafes in Fitzroy open after 3pm" — the 
  Chrome extension already has this working, port it when the time is right
- TikTok / Instagram URL parsing: user pastes a TikTok of a cafe, app 
  extracts the venue and adds it to their crawl. Unique, no one does this well.
  Blocked by Meta/TikTok API restrictions — the workaround is URL parsing + 
  NLP, not official API integration. Build when core product has traction.
- User accounts and auth
- "My saved crawls" history

## Monetisation Paths — All Kept Open

### Path 1: Freemium SaaS
Free tier: 10 searches/day, 3 saved crawls/month
Paid tier (~$4.99–9.99/month): unlimited searches, unlimited saves, 
priority route optimisation
The enforcement logic is built into the proxy from day one 
(FEATURE_LIMITS_ENABLED=false). Flip the flag when ready.

### Path 2: Local Business Advertising
The most realistic near-term revenue path.
Primary markets: Melbourne (CBD, inner north — Fitzroy, Collingwood, 
Brunswick, Carlton) and Sydney (CBD, Surry Hills, Newtown, Paddington).
Cafes and restaurants pay $49–99/month to appear as "Featured" in relevant 
crawls. The sponsored badge is already in the place card data model — hidden 
by default, renders when sponsored=true.
The pitch to a cafe owner: "You appeared in 47 searches in Carlton this week. 
Here's how to make sure people add you to their crawl."
This requires sales hustle to local businesses — cold outreach, showing up, 
building relationships. The product data (Cloud Logging analytics) is the 
proof point in the sales conversation.
Revenue potential: $500–2K/month if executed on seriously.

### Path 3: Acquisition / Licensing
A well-designed product with real user data and a clean architecture is 
sellable. Potential buyers: food delivery platforms, tourism apps, Google 
Maps competitors, hospitality groups.
The anonymous session tracking and event logging mean there's a real data 
asset being built from day one — not just an app.

### Path 4: Content → Inbound
The personal brand play compounds. Every piece of content about the build 
drives traffic to the product. Every user of the product validates the content. 
At scale, sponsored content or brand partnerships with food/lifestyle brands 
become possible.

## Architecture Decisions That Protect the Vision

### No Third-Party Analytics
All event data stays in GCP Cloud Logging. This keeps the data asset 
proprietary — no Mixpanel or Google Analytics owning your user behaviour data.

### Anonymous Session Tracking From Day One
UUID generated on first visit, passed on every API call. Means user behaviour 
is being captured before there are even login concepts. This is the foundation 
of the business intelligence pitch to local businesses.

### Firestore Active From MVP Launch
Crawl persistence is live at launch — not deferred. Every saved crawl gets 
a short nanoid slug. This means trackable URLs, real crawl data, and a 
foundation for the business intelligence pitch from the first user.

### parseURL() Is Isolated
The URL input handler is a standalone function, extensible without touching 
the UI. When TikTok/Instagram parsing is ready, it slots in cleanly.

### Sponsored Field in Data Model
Place card data model includes sponsored: boolean (always false for now). 
The badge component exists in the UI, hidden. Zero code changes needed to 
activate the advertising model.

### FEATURE_LIMITS_ENABLED Flag
All freemium enforcement logic checks this env var. Flip it in Terraform,
no code deploy needed. This is the difference between a feature that takes 
a day to ship and one that takes a week.

### Everything in GCP
Cloud Run for both frontend and backend, Terraform for all infrastructure, 
Secret Manager for all keys. One cloud, one billing account, one mental model. 
Scales from 0 to serious traffic without re-architecting.

### Security Is Layered, Not Bolted On
Security is built in three layers across three sessions:
- Layer 1 (Prompt 1): Frontend — CSP headers, input sanitisation, 
  localStorage validation
- Layer 2 (Prompt 2): Backend + Infrastructure — CORS, origin validation, 
  Firestore rules, request validation, Terraform state backend
- Layer 3 (Prompt 3): Hardening — Cloud Armor, VPC private networking, 
  IAM tightening, full security audit

## Content Strategy (Runs Parallel to Build)
The build is the content. Document decisions, mistakes, and "aha" moments in 
real time.

### Platforms
- LinkedIn: longer-form build updates, architecture decisions, lessons learned. 
  Audience: tech, product, startup people. Goal: credibility and inbound 
  professional opportunities.
- TikTok / Instagram Reels: short demo videos, "I built X" hooks, behind the 
  scenes of the build. Audience: general tech-curious, builders, founders. 
  Goal: reach and shareability.

### Content Angles That Will Perform
- "I built a smarter Google Maps" (demo hook — let the product speak)
- "Why I'm paying my own API costs and why that's a mistake" (honest founder 
  moment)
- "The architecture behind a Chrome extension nobody asked me to build" 
  (technical credibility)
- "I used AI to fix the most annoying thing about Google Maps" (broad audience)
- Build-in-public updates: wins, blockers, user feedback

### The Rule
Start posting before the product is finished. The audience builds while 
the product builds. Launching to silence is the worst outcome — launching 
to a warm audience that's watched you build it is the best.

## Locked Decisions
- Colour palette: modern terracotta, glassy and dewy, Tailwind-native
- Firestore: active from MVP launch for crawl persistence and slug URLs
- Primary launch markets: Melbourne and Sydney
- Infrastructure: GCP only, no Vercel, no other clouds
- Search UX: mirrors native Google Maps — dropdown on type, full card on select
- Security: layered across three build sessions, not deferred

## Open Questions (Decide When Relevant)
- Final app name and domain (foodcrawl.app? crawlmap.app? something else?)
- Pricing tier structure if freemium is activated
- Whether to build a business-facing dashboard or just do manual reporting 
  initially for the first few paying cafe clients

## How to Use This Document
Before every Claude Code session, bring this document and ask:
"Here's my vision doc and here's what I'm about to build — is anything in 
this session's prompt closing a door the vision needs open?"

Before every product decision, check it against the magic moment:
"Does this make the crawl planning experience better, or am I building 
something that doesn't serve that?"

Before every content post, check it against the why:
"Does this build credibility, demonstrate I can ship, or show the product 
working? If not, skip it."