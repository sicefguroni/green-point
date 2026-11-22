/**
 * Every API handler that can change data or spend money (POST, PUT, PATCH,
 * DELETE) must check who is calling. /api is not covered by middleware, so a
 * handler without a check is public.
 *
 * This test reads each route file and fails when a mutating handler has no
 * auth call and is not on the reviewed allowlist below. If it fails for a new
 * route, add `requireUser()` / `requireAdmin()` from `@/lib/auth/session`.
 * Only add an allowlist entry when the handler is meant to be public, and say
 * why.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const API_DIR = path.resolve(__dirname);
const MUTATING = ["POST", "PUT", "PATCH", "DELETE"] as const;

const AUTH_CALL =
  /\b(requireUser|requireAdmin|getAuthenticatedUser|requireAuthenticatedUser)\s*\(|\bauth\.getUser\s*\(|process\.env\.CRON_SECRET/;

/** "<route dir relative to src/app/api> <METHOD>" → why it may be public. */
const PUBLIC_HANDLERS: Record<string, string> = {
  "auth/check-email POST": "Pre-sign-up check; runs before the caller has an account.",
  "auth/signout POST": "Ends the caller's own session; harmless when signed out.",
  "cost-estimate POST": "Pure calculation; no writes and no AI calls.",
};

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return routeFiles(full);
    return entry.name === "route.ts" ? [full] : [];
  });
}

/** Source of each exported handler: from its `export` to the next top-level export. */
function handlers(source: string) {
  const pattern = /^export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/gm;
  const starts = [...source.matchAll(pattern)];
  return starts.map((match, i) => {
    const end = source.slice(match.index! + 1).search(/^export\s/m);
    const body =
      end === -1
        ? source.slice(match.index!)
        : source.slice(match.index!, match.index! + 1 + end);
    return { method: match[1], body, i, total: starts.length };
  });
}

function routeKey(file: string) {
  return path.relative(API_DIR, path.dirname(file)).split(path.sep).join("/");
}

/** Local helpers defined in the same file count when the handler calls them. */
function localAuthHelpers(source: string) {
  const names = new Set<string>();
  for (const match of source.matchAll(/^(?:async\s+)?function\s+(\w+)\s*\(/gm)) {
    const start = match.index!;
    const next = source.slice(start + 1).search(/^(?:export\s|(?:async\s+)?function\s)/m);
    const body = next === -1 ? source.slice(start) : source.slice(start, start + 1 + next);
    if (AUTH_CALL.test(body)) names.add(match[1]);
  }
  return names;
}

describe("API route auth", () => {
  const files = routeFiles(API_DIR);

  it("finds the route files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("checks the caller in every mutating handler", () => {
    const unguarded: string[] = [];

    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      const helpers = localAuthHelpers(source);
      const helperCall = helpers.size
        ? new RegExp(`\\b(${[...helpers].join("|")})\\s*\\(`)
        : null;

      for (const { method, body } of handlers(source)) {
        if (!(MUTATING as readonly string[]).includes(method)) continue;
        const key = `${routeKey(file)} ${method}`;
        if (key in PUBLIC_HANDLERS) continue;
        if (AUTH_CALL.test(body) || helperCall?.test(body)) continue;
        unguarded.push(key);
      }
    }

    expect(unguarded, "Mutating API handlers with no auth check").toEqual([]);
  });

  it("keeps the public allowlist current", () => {
    const existing = new Set(
      files.flatMap((file) =>
        handlers(fs.readFileSync(file, "utf8")).map(
          ({ method }) => `${routeKey(file)} ${method}`,
        ),
      ),
    );

    const stale = Object.keys(PUBLIC_HANDLERS).filter((key) => !existing.has(key));
    expect(stale, "Allowlisted handlers that no longer exist").toEqual([]);
  });
});
