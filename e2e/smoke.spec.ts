// SPDX-License-Identifier: Apache-2.0
//
// Critical-path smoke tests for ComplyTime Studio UI.
//
// These tests run against a live instance (Compose stack or dev server)
// with the gateway accessible. Auth is bypassed by injecting
// X-Forwarded-Email via the Vite dev proxy or Nginx config
// (in dev mode, the proxy forwards directly to the gateway on :8080).
//
// To run with full auth (OAuth2 Proxy), set AUTHENTICATED=true and
// configure OIDC test credentials via environment variables.

import { test, expect } from "@playwright/test";

const GATEWAY_URL = process.env.GATEWAY_URL || "http://localhost:8080";

test.describe("Health and Config", () => {
  test("gateway healthcheck returns 200", async ({ request }) => {
    const resp = await request.get(`${GATEWAY_URL}/healthz`);
    expect(resp.status()).toBe(200);
  });

  test("public config endpoint returns github_org", async ({ request }) => {
    const resp = await request.get(`${GATEWAY_URL}/api/config`);
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body).toHaveProperty("github_org");
  });
});

test.describe("Login Redirect", () => {
  test("unauthenticated visit redirects to login", async ({ page }) => {
    await page.goto("/");
    // The app shows a login screen when /auth/me returns 401
    await expect(
      page.getByRole("button", { name: /login/i }),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Dashboard (authenticated)", () => {
  test.use({
    extraHTTPHeaders: {
      "X-Forwarded-Email": "e2e-test@complytime.dev",
      "X-Forwarded-User": "e2e-test",
      "X-Forwarded-Preferred-Username": "e2e-test",
    },
  });

  test("dashboard loads after auth", async ({ page }) => {
    await page.goto("/");
    // Wait for the app shell to render (sidebar + main)
    await expect(page.locator(".app-shell")).toBeVisible({ timeout: 10_000 });
    // Dashboard view should be active by default
    await expect(page.locator('[data-view="dashboard"]')).toBeVisible();
  });

  test("policies page loads", async ({ page }) => {
    await page.goto("/#/policies");
    await expect(page.locator('[data-view="policies"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  test("evidence page loads", async ({ page }) => {
    await page.goto("/#/evidence");
    await expect(page.locator('[data-view="evidence"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  test("programs page loads", async ({ page }) => {
    await page.goto("/#/programs");
    await expect(page.locator('[data-view="programs"]')).toBeVisible({
      timeout: 10_000,
    });
  });

  test("settings page loads", async ({ page }) => {
    await page.goto("/#/settings");
    await expect(page.locator('[data-view="settings"]')).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("RBAC visibility", () => {
  test.use({
    extraHTTPHeaders: {
      "X-Forwarded-Email": "reviewer@complytime.dev",
      "X-Forwarded-User": "reviewer",
      "X-Forwarded-Groups": "reviewers",
    },
  });

  test("reviewer can view policies page", async ({ page }) => {
    await page.goto("/#/policies");
    await expect(page.locator('[data-view="policies"]')).toBeVisible({
      timeout: 10_000,
    });
  });
});
