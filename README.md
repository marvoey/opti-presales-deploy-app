# Opti Deploy

A simple internal tool for deploying Optimizely CMS demo sites to Vercel — no technical knowledge required.

## What it does

- **Launch a demo** — pick a branch from the GitHub repo and click Deploy
- **Track deployments** — see live status, build progress, and the public URL
- **Override env vars** — adjust environment variables per deployment
- **Clean up** — delete demos when they're no longer needed

---

## Setup

### 1. Prerequisites

- [Node.js 18+](https://nodejs.org)
- A [Vercel](https://vercel.com) account with the target project already created
- A GitHub Personal Access Token with `repo` scope

### 2. Clone and install

```bash
git clone <this-repo>
cd opti-deploy
npm install
```

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in:

| Variable | Where to find it |
|---|---|
| `OPTI_VERCEL_TOKEN` | [vercel.com/account/tokens](https://vercel.com/account/tokens) — must NOT be named `VERCEL_TOKEN` as Vercel injects its own system variable with that name |
| `VERCEL_PROJECT_ID` | Vercel → Project Settings → General → Project ID |
| `VERCEL_DEMO_SITE_PROJECT_NAME` | The slug name of your Vercel project |
| `VERCEL_TEAM_ID` | *(Optional)* Team Settings → General → Team ID |
| `GITHUB_TOKEN` | [github.com/settings/tokens](https://github.com/settings/tokens) — needs `repo` scope |
| `GITHUB_REPO_OWNER` | GitHub org or username |
| `GITHUB_REPO_NAME` | Repository name |
| `GITHUB_REPO_ID` | Run: `curl -H "Authorization: Bearer <token>" https://api.github.com/repos/<owner>/<repo> \| grep '"id"' \| head -1` |

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Deploy the tool itself (optional)

You can host this app on Vercel too — just add the same env vars to the Vercel project settings.

```bash
npx vercel --prod
```

---

## Project structure

```
opti-deploy/
├── app/
│   ├── page.tsx                    # Dashboard — lists all deployments
│   ├── deploy/page.tsx             # New deployment form
│   ├── deployments/[id]/page.tsx   # Deployment detail + build logs
│   └── api/
│       ├── deployments/route.ts    # GET list, POST create
│       ├── deployments/[id]/route.ts      # GET detail, DELETE
│       ├── deployments/[id]/logs/route.ts # GET build logs
│       ├── branches/route.ts       # GET GitHub branches
│       └── env/route.ts            # GET project env var keys
├── components/
│   ├── DeploymentCard.tsx          # Card shown on dashboard
│   ├── StatusBadge.tsx             # Coloured status pill
│   └── EnvVarEditor.tsx            # Key/value env var editor
├── lib/
│   ├── vercel.ts                   # Vercel API helpers
│   └── github.ts                   # GitHub API helpers
└── .env.local.example              # Environment variable template
```

---

## Usage guide (for non-technical users)

1. **Open the app** in your browser
2. Click **New Demo** (top right)
3. Choose the **branch** you want to demo
4. *(Optional)* Expand **Environment variable overrides** to customise settings
5. Click **Deploy Demo Site** — the build takes ~2 minutes
6. Once live, the green **Live** badge appears with a link to your demo URL
7. To clean up, click the **trash icon** next to any deployment