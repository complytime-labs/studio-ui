<!-- SPDX-License-Identifier: Apache-2.0 -->

# Studio UI Architecture

Preact SPA served by Nginx. Single entry point for users — proxies API and workbench traffic to backend services.

## Stack

| Layer | Tech |
|:--|:--|
| Framework | Preact + Signals |
| Build | Vite |
| Proxy | Nginx (Alpine) |
| Tests | Playwright E2E |

## Nginx Routing

Nginx acts as a reverse proxy, routing by path prefix to backend services:

| Path | Target | Purpose |
|:--|:--|:--|
| `/api/*` | Gateway (`:8080`) | Data platform REST API |
| `/auth/*` | Gateway | User identity (`/auth/me`) |
| `/oauth2/*` | Gateway / OAuth2 Proxy | OIDC callbacks, sign-in/out |
| `/workbench/*` | Workbench (`:8090`) | Agent A2A, chat, validation |
| `/*` | Static SPA | Preact app (fallback to `index.html`) |

Upstream addresses are injected at runtime via `docker-entrypoint.sh` using `sed` on `nginx.conf` placeholders. DNS resolver is configured dynamically to handle container networking.

## Runtime Configuration

`env.js` is generated at container startup from environment variables via `envsubst`. The SPA reads it at load time for runtime config (no rebuild needed).

| Variable | Purpose |
|:--|:--|
| `PLATFORM_URL` | Base URL override for API calls |
| `GATEWAY_UPSTREAM` | Nginx upstream for gateway (default: `studio-gateway:8080`) |
| `WORKBENCH_UPSTREAM` | Nginx upstream for workbench (default: `studio-workbench:8090`) |

## Key Views

| View | Route | Data Source |
|:--|:--|:--|
| Dashboard | `/` | `/api/policies`, `/workbench/posture` |
| Posture | `/posture` | `/workbench/posture`, `/workbench/programs` |
| Evidence | `/evidence` | `/api/evidence` |
| Audit Logs | `/audit-logs` | `/api/audit-logs`, `/api/draft-audit-logs` |
| Chat | `/chat` | `/workbench/a2a/*` (SSE) |

## Auth Flow

1. User visits `/` — SPA loads, calls `/auth/me`
2. If 401 → show "Sign In" button → redirect to `/oauth2/sign_in`
3. OAuth2 Proxy handles OIDC flow, sets session cookie
4. Subsequent requests carry cookie → OAuth2 Proxy injects `X-Forwarded-Email` → gateway returns user identity

## Related Docs

| Doc | Topic |
|:--|:--|
| [ADRs](decisions/) | UI/UX design decisions |
| [complytime-core architecture](https://github.com/complytime-labs/complytime-core/blob/main/docs/architecture.md) | Backend API |
