# Project Universe

A cinematic 3D space exploration experience built with Next.js and React Three Fiber.

**Features:**
- Continuous procedural travel from Earth to outer planets.
- High-fidelity cinematic lighting and atmospheric effects.
- Real-time performance optimization with tiered graphics settings.
- Seamless "Shell-First" loading architecture.

This project is a [Next.js](https://nextjs.org) application bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy to GitHub Pages

This repo is configured for static export + GitHub Pages.

### Automatic (recommended)

1. In GitHub, open `Settings -> Pages`.
2. Set source to **GitHub Actions**.
3. Push to `main`.

The workflow at `.github/workflows/deploy-pages.yml` will:
- build Next.js as static output (`out/`)
- publish it to GitHub Pages
- use `/${repo-name}` as base path automatically

### Manual (local)

```bash
npm run build
npm run deploy
```

For forks/renamed repos, set:

```bash
NEXT_PUBLIC_BASE_PATH=/your-repo-name npm run build
```

If your machine locks `.next` (common with cloud-synced folders), build to a separate directory:

```powershell
$env:NEXT_DIST_DIR=".next-pages"
npm run build
```


## License & Attribution

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### Assets

*   **Code & Original 3D Models**: Copyright (c) 2026 Frost Protocol Authors. All rights reserved under the MIT License.
*   **Third-Party Assets**:
    *   **Parker Solar Probe Model** (`/models/ship.glb`): Used in the opening scene. This model is a NASA asset (courtesy of NASA/Johns Hopkins APL) and is **excluded** from this project's MIT license. It resides in the public domain or is used under specific NASA usage guidelines, but copyright is held by the respective creators.
