/**
 * Every registered route is described in the OpenAPI document.
 *
 * This exists because of what happened when it did not. The validator sits in
 * front of the router and, by default, answers 404 for any path the document
 * does not describe — so a route that was registered, compiled and tested was
 * *deleted at runtime by nobody having described it*. `/runners` and the four
 * gateway-only `/internal/…` routes had been gone for as long as they had
 * existed, and nothing said: the broker could not resolve a tenant image, and
 * the headless runner could not enrol.
 *
 * That default is now off — an endpoint must not vanish because someone forgot
 * to write it down. But turning it off trades one silent failure for another:
 * an undescribed route is served with no schema validation at all, which is
 * exactly what the review objected to.
 *
 * So neither. The flag keeps the route alive, and this test makes forgetting
 * loud: adding a route without describing it fails here, at the moment it is
 * added, rather than in production by disappearing or by going unchecked.
 */

import { Express, Router } from 'express';
import { createApp } from '../app';
import oas from '../oas30.json';

/** `/internal/projects/:project_id/members` → `…/{project_id}/members`. */
const toOpenApiPath = (expressPath: string): string =>
  expressPath.replace(/:([A-Za-z0-9_]+)/g, '{$1}');

/**
 * Every path Express will actually serve.
 *
 * Read off the router the app mounts, which is the same thing the validator
 * compares against — not a list someone maintains by hand, because a list
 * maintained by hand is the failure this file is about.
 */
const registeredPaths = (app: Express): Set<string> => {
  const found = new Set<string>();
  type TLayer = {
    route?: { path: string };
    handle?: Router & { stack?: TLayer[] };
    name?: string;
  };

  const walk = (stack: TLayer[]) => {
    for (const layer of stack) {
      if (layer.route?.path) {
        found.add(toOpenApiPath(layer.route.path));
        continue;
      }
      const nested = layer.handle?.stack;
      if (Array.isArray(nested)) walk(nested as TLayer[]);
    }
  };

  const router = (app as unknown as { _router?: { stack?: TLayer[] } })._router;
  walk(router?.stack ?? []);
  return found;
};

/**
 * Paths the document deliberately does not describe.
 *
 * Kept as an explicit list rather than a pattern: an exemption should be an
 * argument someone made, not a shape a path happens to have.
 */
const NOT_DOCUMENTED = new Set<string>([
  // `app.options('*')`, the CORS preflight handler. It answers every path and
  // describes none — there is no operation here for a document to carry.
  '*',
  // Added by tests through `setupAdditionalRoutes`, never served in a
  // deployment.
  '/test-rate-limit/auth',
  '/test-rate-limit/oauth',
  '/test-rate-limit/sensitive',
  '/test-rate-limit/api',
  '/test-rate-limit/none',
]);

describe('OpenAPI coverage', () => {
  let app: Express;

  beforeAll(() => {
    process.env.ALLOWED_ORIGINS = '["http://localhost:4200"]';
    app = createApp({ skipSession: true, skipRateLimiting: true });
  });

  it('describes every route the app registers', () => {
    const documented = new Set(Object.keys(oas.paths ?? {}));
    const missing = [...registeredPaths(app)]
      .filter((path) => !documented.has(path))
      .filter((path) => !NOT_DOCUMENTED.has(path))
      .sort();

    // The message carries the paths, because the useful version of this
    // failure is the list of what to go and write.
    expect(missing).toEqual([]);
  });

  it('reads the route table it is asserting on', () => {
    // A guard that silently found nothing would pass forever. If Express ever
    // changes where it keeps its layers, this is what says so.
    expect(registeredPaths(app).size).toBeGreaterThan(30);
  });
});
