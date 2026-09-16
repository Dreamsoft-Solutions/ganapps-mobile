# Ganapps Mobile

The React Native app for **Ganapps**, a campus event discovery platform for Central
Philippine University. Students browse events on a map or feed, register, join the event
chat, check in by scanning the organizer's QR code, and leave feedback afterwards.

This repo is one of three:

| Repo | What it is | Stack |
|---|---|---|
| `ganapps-mobile` (this one) | React Native app | Expo SDK 57 · npm |
| `ganapps-server` | Backend API — source of truth for data and auth | NestJS 11 · Prisma 7 · pnpm |
| `ganapps-web` | Browser frontend | Next.js 16 · pnpm |

## Stack

Expo SDK 57 · Expo Router (file-based routing) · TypeScript 6 · NativeWind v4 (Tailwind) ·
TanStack Query v5 · Zustand v5 · react-hook-form + Zod v4 · Axios · Drizzle ORM (SQLite via
expo-sqlite) · Firebase Remote Config · Biome · Jest · EAS Build

## Prerequisites

- **Node.js 20+** (developed on 24.x)
- **npm** — this repo uses npm, not pnpm or yarn. The server and web repos use pnpm; don't
  copy their commands here.
- A running `ganapps-server` instance, or a reachable deployment, for anything past the
  login screen.

## Setup

```bash
npm install
cp .env.example .env
```

Then edit `.env` and point `EXPO_PUBLIC_API_URL` at your server (defaults to
`http://localhost:3000/api`). Note that `EXPO_PUBLIC_*` variables are bundled into the app
and are visible to anyone who inspects it — never put a secret behind that prefix.

Firebase Remote Config additionally needs `google-services.json` (Android) and
`GoogleService-Info.plist` (iOS) in the project root. Download them from the Firebase
console under Project Settings → Your Apps, or ask a teammate. They are gitignored and
never committed, so each developer supplies their own copy.

## Running

```bash
npm run dev          # Expo dev server, metro cache cleared
npm start            # Expo dev server
npm run android      # Build and run on an Android device/emulator
npm run ios          # Build and run on an iOS simulator
```

The app depends on native modules (Firebase, SecureStore, SQLite), so **it will not run in
Expo Go** — use a development build via `npm run android` / `npm run ios`, or an EAS
development build.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Expo dev server with metro cache cleared |
| `npm run lint` | Biome lint |
| `npm run lint:fix` | Biome lint with auto-fix |
| `npm run format` | Biome format, writing changes |
| `npm run check` | Biome lint + format check (does not write) |
| `npm run type-check` | `tsc --noEmit` |
| `npm run test` | Jest |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:coverage` | Jest with coverage |
| `npm run db:generate` | Generate Drizzle migrations from `src/db/schema.ts` |
| `npm run db:migrate` | Apply Drizzle migrations |
| `npm run eas:preview` | EAS preview build (Android APK / iOS simulator) |
| `npm run eas:build` | EAS build |

Adding an Expo package uses `npx expo install <pkg>`, not `npm install`, so an
SDK-57-compatible version is selected.

## Project layout

```
src/
├── api/            Axios client, interceptors, endpoint wrappers, response types
├── app/            Expo Router screens — (auth) and (app) route groups
├── components/     common/ (CVA primitives), forms/, lists/
├── constants/      Route paths, error codes, theme colors
├── db/             Drizzle SQLite schema — offline outbox and cache tables
├── hooks/          queries/, mutations/, and aggregated feature hooks
├── providers/      Root provider composition
├── services/       Firebase Remote Config, offline sync
├── store/          Zustand stores
├── types/          Shared TypeScript types
└── utils/          Validation schemas, storage wrappers, formatting, error parsing
```

## Conventions

**`AGENTS.md` is authoritative** for how code is written here — the three-layer hook
pattern, component and form conventions, the Lynx design tokens, TSDoc requirements, error
handling, and the code review checklist. Read it before contributing.

Architecture decisions live in `docs/adr/`; see `docs/adr/README.md` for the format.

## Git workflow

Work happens on `dev`; `master` is not a working branch. Commits follow
[Conventional Commits](https://www.conventionalcommits.org/) and are enforced by commitlint
(100 character header limit). Husky hooks run lint-staged on commit and lint + tests on
push. Don't bypass them with `--no-verify`.

## License

See [LICENSE](./LICENSE).
