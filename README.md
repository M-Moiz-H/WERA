# WERA

**WarEra Economic Research & Analytics**

WERA is being built as a market-intelligence companion for WarEra.

## Current stage

This first foundation provides:

- TypeScript monorepo
- Deployable API service
- `/health` endpoint
- Secure server-side WarEra API client foundation
- Environment configuration
- No WarEra API credentials bundled in the mobile client

## Run locally

```bash
npm install
cp .env.example .env
npm run dev:api
```

Then open:

```text
http://localhost:3000/health
```

## Important

`WARERA_API_KEY` must stay server-side. Do not add it to an Expo/mobile environment variable or commit it to Git.

The WarEra client intentionally starts with a generic tRPC procedure caller. We will add verified procedure wrappers only after confirming their current input/output contracts.
