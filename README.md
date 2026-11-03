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

## Security and privacy (spec 14)

- `/privacy` (the notice, from the API's data register), `/security` (vulnerability disclosure), `/account/privacy` (Your data: download, consents, requests, delete), `/account-deleted`.
- **Consent:** the API client opens one shared consent dialog whenever the API answers `consent_required` (follow, bells, membership, PVC, badge), records the consent and retries; "Not now" changes nothing (`consent_declined`).
- **Reverification:** the API client hands `reverification_required` answers to Clerk's `useReverification()`, which prompts and retries with a fresh token; a cancelled prompt does nothing (`reverification_cancelled`).
- **Admin two-step verification:** every `/admin` page sits behind `AdminMfaGate`, which explains how to turn it on (Clerk account → Security) when `/me` says it's required and off, or the API answered `mfa_required`.
- **Headers:** `npm run headers` prints the CSP and other headers built from `VITE_API_BASE_URL` and `VITE_CLERK_PUBLISHABLE_KEY` (`-- --write` refreshes `deploy/_headers` and `deploy/nginx-security.conf`). `npm run build` writes `dist/_headers`, and `dist/.well-known/security.txt` when `VITE_SECURITY_CONTACT` is set. Serve the app with those headers.
- CI: `.github/workflows/security.yml` (typecheck, tokens, tests, build, `npm audit --omit=dev`, gitleaks).
