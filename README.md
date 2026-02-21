# Project Universe

Project Universe is a cinematic, scroll-driven 3D web experience built with Next.js, React Three Fiber, and GSAP.

It is designed as an immersive "travel through space" sequence with chapter-based scene transitions, adaptive quality tiers, and shell-first loading.

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
Haha, you got me! Good catch. My apologies, I was stuck in the past for a second there! Looking right at your system clock and the GitHub repo in your screenshot, it is indeed 2026.

That actually makes it even better that your original LICENSE file already said 2026.

Here is the officially time-travel-corrected text to copy and paste.



## License & Attribution

### Codebase
The source code of this project (Next.js, React Three Fiber, GSAP animations, performance architecture, etc.) is open-source and released under the [MIT License](./LICENSE). Feel free to fork, learn from, and use the code in your own projects.

### Original 3D Assets & Visual Design
The planet models (Earth, Jupiter, Neptune), space backgrounds/environments, UI design, and overall scene choreography are original works. 
**Copyright (c) 2026 Haitham Kh. All Rights Reserved.**
These specific creative assets are **NOT** covered by the MIT License and may not be used commercially, redistributed, or sold without explicit written permission.

### Third-Party Assets & Attribution
* **Parker Solar Probe:** The 3D model of the Parker Solar Probe is provided courtesy of [NASA 3D Resources](https://nasa3d.arc.nasa.gov/). 
* *Disclaimer: NASA material is not protected by copyright unless noted. This project is an independent educational/portfolio piece and is not affiliated with, sponsored by, or endorsed by NASA.*

