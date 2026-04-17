# Harot Li Frontend Rebuild

Frontend-only landing page foundation for the brand "חרוט לי".

## Run locally

1. Install dependencies:
   - `npm install`
2. Start dev server:
   - `npm run dev`

## Backend (new)

The backend lives under `backend/` and runs separately from the Vite dev server.

1. Install backend dependencies:
   - `cd backend && npm install`
2. (Optional) Create env file:
   - `cp .env.example .env`
3. Start backend in dev mode:
   - `npm run dev`
4. Test:
   - `curl http://localhost:4000/health`

## Notes

- Frontend + minimal backend scaffold (no database / auth / payments yet).
- Full RTL Hebrew layout.
- Modular structure for future backend integration:
  - `src/components`
  - `src/sections`
  - `src/constants`
  - `src/styles`
  - `src/assets`
