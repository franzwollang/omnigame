# OmniGame Web Shell

This repository is now configured with a modern React stack using **Next.js 14**, **Tailwind CSS**, and the full **shadcn/ui** component registry. Everything is wired for development with **pnpm** including strict TypeScript settings, ESLint, and theming helpers.

## Getting started

```bash
pnpm install
pnpm dev
```

The development server runs on [http://localhost:3000](http://localhost:3000).

> **Note**
> Network access is required the first time you run `pnpm install` because dependencies and shadcn components are downloaded from npm.

## Available scripts

- `pnpm dev` – start the Next.js development server.
- `pnpm build` – create an optimized production build.
- `pnpm start` – run the production server locally.
- `pnpm lint` – run ESLint with the Next.js configuration.
- `pnpm typecheck` – run TypeScript in `--noEmit` mode.
- `pnpm components:add` – fetch every shadcn/ui component and keep the local registry up to date (idempotent).

## Project structure

```
app/              # Next.js App Router entry points (layout + routes)
public/           # Static assets
src/components/   # shadcn/ui components and shared UI primitives
src/lib/          # Utilities shared across the app
next.config.ts    # Next.js configuration
postcss.config.mjs
tailwind.config.ts
```

## Styling and theming

- Tailwind CSS is preconfigured with the shadcn design tokens and dark mode support via `next-themes`.
- `src/lib/utils.ts` exposes the `cn` helper for ergonomic class merging.
- Global CSS variables live in `app/globals.css`.

## shadcn/ui registry

The repository includes the `components.json` manifest expected by the shadcn CLI. Running `pnpm components:add` ensures every component stays synchronized with the upstream registry. Individual components can be found in `src/components/ui`.

## Deployment

Use `pnpm build` followed by `pnpm start` to serve the production build, or deploy via your preferred Next.js hosting provider.
