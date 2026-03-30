# PLXYGROUND Implementation Notes

## Blockers
- Expo React Native Web scaffold could not be installed from scratch in this environment without pulling network packages. A static SPA fallback was implemented in `frontend/` to preserve all requested UX flows and endpoint behavior on port `19006`.

## Implemented security/hardening
- JWT secret is required at boot.
- Role-based JWT middleware for admin routes.
- Single-admin policy guard (exactly one active admin).
- Rate limits for auth and API routes.
- Helmet headers and JSON/body size caps.
- URL + payload validation for content, media URL required on create/update.
- Request logging and counters exposed at `/metrics`.

## Dev credentials (seed)
- Admin: `admin@plxyground.local` / `Internet2026@`
- Creator: `sarahjohnson@plxyground.local` / `Password1!`
- Business: `nike@plxyground.local` / `Password1!`
