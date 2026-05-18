# Studio UI

Batteries-included Preact SPA for ComplyTime Studio. Deployed as an Nginx container that reverse-proxies to two backends: the [Data Platform](https://github.com/complytime/complytime-studio) and the [Studio Workbench](https://github.com/complytime/complytime-agents).

## Quick Start

```bash
make dev          # Vite dev server (proxies /api to localhost:8080)
make build        # Production build → dist/
make image        # Docker/Podman image → studio-ui:local
```

## Architecture

```
Browser → studio-ui (Nginx :80)
            ├── /             → static SPA files
            ├── /api/*        → proxy → Data Platform (studio-gateway:8080)
            ├── /oauth2/*     → proxy → Data Platform
            ├── /auth/*       → proxy → Data Platform
            └── /workbench/*  → proxy → Studio Workbench (studio-workbench:8090)
```

Runtime configuration is injected via `env.js` (rendered from `env.js.template` at container startup):

| Variable | Purpose | Default |
|:--|:--|:--|
| `PLATFORM_URL` | Base URL for API calls (empty = same-origin proxy) | `""` |
| `GATEWAY_UPSTREAM` | Nginx proxy target for data platform paths | `studio-gateway:8080` |
| `WORKBENCH_UPSTREAM` | Nginx proxy target for workbench paths | `studio-workbench:8090` |

## Development

The Vite dev server proxies `/api` and `/workbench` to local backends. Run both or port-forward:

```bash
kubectl port-forward -n kagent svc/studio-gateway 8080:8080
kubectl port-forward -n kagent svc/studio-workbench 8090:8090
make dev
```

## Container Image

The Dockerfile builds in two stages:
1. `node:22-alpine` — `npm ci` + `vite build`
2. `nginx:1-alpine` — serves static files, reverse-proxies to both backends

Published as `ghcr.io/complytime/studio-ui:<tag>`.
