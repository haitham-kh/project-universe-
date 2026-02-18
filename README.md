# Project Universe

Project Universe is a cinematic, scroll-driven 3D web experience built with Next.js, React Three Fiber, and GSAP.

It is designed as an immersive "travel through space" sequence with chapter-based scene transitions, adaptive quality tiers, and shell-first loading.

## Builder Story

- Built by a first-year Computer Science student exploring advanced 3D WebGL engineering.
- Shipped in about 50 days, including building and integrating the 3D models.
- Developed on modest hardware: Intel Core i3 (7th Gen) + Intel HD 620 graphics.
- Goal: prove that ambitious real-time web graphics can be built from scratch, even on low-end hardware.

## Live Demo

GitHub Pages:
https://haitham-kh.github.io/project-universe-/

## Highlights

- Cinematic multi-scene journey (Space -> Saturn -> Neptune)
- Scroll-scrubbed camera and timeline choreography
- Runtime performance tiering (quality adapts to device conditions)
- Frame-budgeted asset orchestration and chapter-aware disposal
- Shell-first loading strategy with critical-path gating
- Static export compatible with GitHub Pages

## Tech Stack

- Next.js (App Router, static export)
- React + TypeScript
- @react-three/fiber + @react-three/drei + three.js
- GSAP (timeline orchestration)
- Zustand (runtime state)

## Architecture Snapshot

Core runtime pieces:

- src/components/Experience.tsx
  Main R3F composition and frame loop integration.
- src/lib/SceneDirector.ts
  Frame orchestration boundary (frame budget + GSAP + asset scheduler tick).
- src/lib/AssetOrchestrator.ts
  Queueing, streaming status, memory budget, chapter tracking, disposal.
- src/lib/useDirector.ts
  Timeline-derived global state used by camera/effects/scene systems.
- src/hooks/useStreamingTrigger.ts
  Scroll-zone driven preload priority and chapter transitions.

## Getting Started

Requirements:

- Node.js 20+
- npm

Install:

    npm ci

Run development server:

    npm run dev

Open:

http://localhost:3000

## Scripts

    npm run dev      # local development
    npm run build    # production static build (Next export)
    npm run start    # Next production server (not used for Pages)
    npm run lint     # lint checks
    npm run deploy   # publish ./out to gh-pages branch

## Deploying to GitHub Pages

This repository includes an Actions workflow:

- .github/workflows/deploy-pages.yml

How it works:

1. Trigger on push to main.
2. Build static output with npm run build.
3. Upload out/ as Pages artifact.
4. Deploy using actions/deploy-pages.

GitHub setup required once:

1. Repository Settings -> Pages.
2. Source: GitHub Actions.

## Base Path Configuration

Project Universe supports repo-based subpath hosting.

- Production base path is controlled by NEXT_PUBLIC_BASE_PATH.
- In GitHub Actions, it is automatically set to /<repo-name>.

Examples:

    # For repo pages at /project-universe-
    NEXT_PUBLIC_BASE_PATH=/project-universe- npm run build

    # For root domain deployment
    NEXT_PUBLIC_BASE_PATH= npm run build

## Troubleshooting

### GitHub Action fails with out/.nojekyll not found

Cause: static export output was not created in out/.

Fix:

- Confirm next.config.ts still has output: "export".
- Ensure the build step succeeds in the workflow logs before deploy step.

### Windows + OneDrive lock errors on .next

If your local machine locks .next, use an alternate dist directory:

    $env:NEXT_DIST_DIR=".next-pages"
    npm run build

Note: this is only for local troubleshooting. CI uses default output expectations.

## License

This project is licensed under the MIT License. See LICENSE.

## Asset Attribution

- Code and original project assets: MIT (Project Universe Authors)
- Parker Solar Probe model (/models/ship.glb): NASA/Johns Hopkins APL asset, excluded from MIT transfer

## Discoverability Tags

Keywords:

`webgl` `threejs` `react-three-fiber` `r3f` `nextjs` `typescript` `gsap` `3d-web` `computer-graphics` `interactive-web` `shader` `space-sim` `cinematic` `frontend` `opensource`

Hashtags:

#webgl #threejs #reactthreefiber #nextjs #typescript #gamedev #creativecoding #computergraphics #indiehackers #buildinpublic
