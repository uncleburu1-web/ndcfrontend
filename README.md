# ndcfrontend

NDCConnect web app — React 18 + Vite 5 + TypeScript + React Router 6. Sign-in is Clerk.
Specs: `context/feature-specs/01-design-system.md`, `02-authentication.md` (kept in the project context folder).

```bash
npm install
cp .env.example .env.local   # Clerk DEVELOPMENT publishable key + API base URL
npm run dev                  # http://localhost:5173
npm run typecheck
npm run check:tokens         # fails if a colour literal exists outside src/styles/tokens.css
npm test                     # Vitest
npm run build
```

Without `VITE_CLERK_PUBLISHABLE_KEY` the app shows a "Sign-in isn't configured" screen. `/design-system` (dev only) works without it.

## Layout

- `src/styles/` — tokens (proposed, pending approval), base styles, app helpers
- `src/components/ui/` — design-system components
- `src/components/layout/AppLayout.tsx` — header with Sign in / user menu, session banners
- `src/auth/` — `useApi()` (attaches the Clerk token, one retry on 401, handles 403/503), `useMe()`, route guards, profile form, Clerk appearance from tokens, `profile:completed` event
- `src/pages/auth/` — sign-in, sign-up, setup-profile, account, account-deactivated
- `src/lib/format.ts` — `formatNaira`, `formatDate`

## Routes

| Route | Access |
|---|---|
| `/sign-in/*`, `/sign-up/*` | signed out (sign-up lands on `/setup-profile`) |
| `/setup-profile`, `/account/*` | signed in |
| everything else | public |

## Communities (spec 17)

- `/communities` (join, choose a state, browse), `/communities/<path>` (one route for every level: `lagos`, `lagos/ikeja/05/001`) and `/communities/<path>/posts/<id>`, `/account/communities` (Leave, Rejoin, new-post switches, change state), `/admin/communities` (system admins).
- Code in `src/communities/` (types from the OpenAPI schema, `PostCard`, `Composer` with `refusalWords()`, `communities.css` using tokens only); pages in `src/pages/communities/`. Joining relies on the shared consent dialog (`consent_required` with purpose `community_membership`).
- Who is in a community is never shown; counts come banded from the API.

## Hosting on Cloudflare (ahead of spec 20)

- `wrangler.jsonc` serves `dist/` as Workers static assets in single-page-app mode (every app route gets `index.html`); Vite's `dist/_headers` sets the security headers. Pages projects ignore the file and work the same way.
- **Build** variables (Settings → Build → Variables and secrets, not the runtime ones): `VITE_API_BASE_URL`, `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_SECURITY_CONTACT`, `NODE_VERSION=22`. `VITE_MEDIA_ORIGIN=https://res.cloudinary.com` is committed in `.env.production` (not secret), so the CSP lets the browser upload to and show images from Cloudinary. Build command `npm run build`; deploy command `npx wrangler deploy`.
- The site's address goes into the backend's `CLERK_AUTHORIZED_PARTIES` and `CORS_ALLOWED_ORIGINS`.

## Events and volunteering (spec 18)

- `/events` (filters State, Type, Online, This week in the address; Upcoming · Past), `/events/:id` (details in Lagos time, calendar file, registration box, report), `/account/events`, `/account/volunteering`, `/candidates/:slug/volunteer`, campaign tabs Posts · Events · Volunteers on `/campaign/:candidateId`, `/admin/events` (system admins: party events and all events with counts). "Upcoming events" strips on candidate, state and community pages.
- Code in `src/events/` (types from the OpenAPI schema, `EventCardItem`, `EventEditor`/`EventDashboard` with `refusal()`, `OrganiserEvents`, `CampaignVolunteers`, `UpcomingStrip`, `events.css` using tokens only); pages in `src/pages/events/`. Registering and applying rely on the shared consent dialog (purposes `event_registration` and `volunteering`).
- Times are always shown in Lagos time (`whenWords`); the editor sends `+01:00` (`fromLocalInput`). Nobody's registration is shown to anyone else; counts come banded from the API.

## States and geography (spec 19)

- `/states/:state` adds capital, LGAs (area councils in the FCT) with counts, constituencies and "About this data"; `/states/:state/:lga` (candidates standing there, events, community, wards); `/polling-units` (by code or by place, INEC's names and codes, "Check with INEC" on every result, never a VIN); Account "Confirm where you vote"; `/admin/geography` (system admins: Files, Review, Other names; PVC and membership officers: Review). Footer link "Find a polling unit"; search shows Places.
- Code in `src/geo/` (`GeoPicker`, `LgaPicker`, `ConstituencyPicker`, `GeoConfirmCard`, shared sections, cached anonymous lookups in `useGeo`, `geoBody()` for request fields); pages in `src/pages/geo/` and `src/pages/admin/geography/`. The membership, PVC, candidate, event and volunteer forms send IDs from the pickers; "My place isn't listed" sends the typed text for an officer to check.

## Security and privacy (spec 14)

- `/privacy` (the notice, from the API's data register), `/security` (vulnerability disclosure), `/account/privacy` (Your data: download, consents, requests, delete), `/account-deleted`.
- **Consent:** the API client opens one shared consent dialog whenever the API answers `consent_required` (follow, bells, membership, PVC, badge), records the consent and retries; "Not now" changes nothing (`consent_declined`).
- **Reverification:** the API client hands `reverification_required` answers to Clerk's `useReverification()`, which prompts and retries with a fresh token; a cancelled prompt does nothing (`reverification_cancelled`).
- **Admin two-step verification:** every `/admin` page sits behind `AdminMfaGate`, which explains how to turn it on (Clerk account → Security) when `/me` says it's required and off, or the API answered `mfa_required`.
- **Headers:** `npm run headers` prints the CSP and other headers built from `VITE_API_BASE_URL` and `VITE_CLERK_PUBLISHABLE_KEY` (`-- --write` refreshes `deploy/_headers` and `deploy/nginx-security.conf`). `npm run build` writes `dist/_headers`, and `dist/.well-known/security.txt` when `VITE_SECURITY_CONTACT` is set. Serve the app with those headers.
- CI: `.github/workflows/security.yml` (typecheck, tokens, tests, build, `npm audit --omit=dev`, gitleaks).
