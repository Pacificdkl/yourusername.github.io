/**
 * Non-negotiable #1 — No content before verification.
 *
 * This test enumerates EVERY data route on disk (app/api/**, minus the auth and
 * verify flows that must be reachable pre-verification) and asserts that each
 * one returns 403 when called by an unauthenticated session AND by an
 * authenticated-but-unverified session. It calls the route handlers directly,
 * bypassing middleware — so a data route that forgets `withVerified` fails here.
 *
 * Enumeration is filesystem-driven: a new gated route is covered automatically.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { store, __resetStore } from '@/db';
import { signSession, SESSION_COOKIE_NAME } from '@/auth';

const API_DIR = fileURLToPath(new URL('../../app/api', import.meta.url));

// Reachable without verification (auth flows + the verification flow itself).
const UNGATED_PREFIXES = ['/api/auth/', '/api/verify/'];

interface RouteFile {
  routePath: string;
  filePath: string;
}

function collectRoutes(dir: string, base = '/api'): RouteFile[] {
  const out: RouteFile[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      // Next.js segment naming: strip route groups (x) but keep normal segments.
      const seg = name.startsWith('(') && name.endsWith(')') ? '' : `/${name}`;
      out.push(...collectRoutes(full, base + seg));
    } else if (name === 'route.ts' || name === 'route.tsx') {
      out.push({ routePath: base, filePath: full });
    }
  }
  return out;
}

function isGated(routePath: string): boolean {
  return !UNGATED_PREFIXES.some((p) => routePath === p.replace(/\/$/, '') || routePath.startsWith(p));
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

const allRoutes = collectRoutes(API_DIR);
const gatedRoutes = allRoutes.filter((r) => isGated(r.routePath));

async function loadHandlers(filePath: string): Promise<Record<string, unknown>> {
  return import(pathToFileURL(filePath).href);
}

function reqFor(routePath: string, method: string, cookie?: string): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (cookie) headers['cookie'] = cookie;
  const init: RequestInit = { method, headers };
  if (method !== 'GET' && method !== 'DELETE') init.body = '{}';
  return new Request(`http://localhost${routePath}`, init);
}

describe('invariant #1: verification gate', () => {
  beforeEach(() => __resetStore());

  it('found at least one gated data route to test', () => {
    expect(gatedRoutes.length).toBeGreaterThan(0);
  });

  for (const route of gatedRoutes) {
    it(`403 for unauthenticated session on ${route.routePath}`, async () => {
      const mod = await loadHandlers(route.filePath);
      const methods = HTTP_METHODS.filter((m) => typeof mod[m] === 'function');
      expect(methods.length).toBeGreaterThan(0);
      for (const method of methods) {
        const handler = mod[method] as (req: Request) => Promise<Response>;
        const res = await handler(reqFor(route.routePath, method));
        expect(res.status, `${method} ${route.routePath}`).toBe(403);
      }
    });

    it(`403 for authenticated-but-unverified session on ${route.routePath}`, async () => {
      const user = await store.createUser(); // ageVerified defaults to false
      const cookie = `${SESSION_COOKIE_NAME}=${await signSession(user.id)}`;
      const mod = await loadHandlers(route.filePath);
      const methods = HTTP_METHODS.filter((m) => typeof mod[m] === 'function');
      for (const method of methods) {
        const handler = mod[method] as (req: Request) => Promise<Response>;
        const res = await handler(reqFor(route.routePath, method, cookie));
        expect(res.status, `${method} ${route.routePath}`).toBe(403);
      }
    });
  }

  it('a VERIFIED session is allowed through the gate (positive control)', async () => {
    const user = await store.createUser();
    await store.markVerified(user.id, { providerRef: 'ref_x', verifiedAt: new Date() });
    const cookie = `${SESSION_COOKIE_NAME}=${await signSession(user.id)}`;

    const mod = await loadHandlers(join(API_DIR, 'me', 'route.ts'));
    const res = await (mod.GET as (req: Request) => Promise<Response>)(
      reqFor('/api/me', 'GET', cookie),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; ageVerified: boolean };
    expect(body.ageVerified).toBe(true);
    expect(body.id).toBe(user.id);
  });
});
