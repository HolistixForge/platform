# Putting an environment on the internet

A local environment normally answers on names only this machine resolves —
`apollo.test`, `ganymede.apollo.test`, `org-<uuid>.apollo.test`. This is how to
put the same environment on a public URL, so a colleague, a phone, an OAuth
provider's callback or a webhook can reach it.

```bash
./scripts/local-dev/tunnel.sh up          # prints the public URL
./scripts/local-dev/tunnel.sh status
./scripts/local-dev/tunnel.sh down
```

`ENV_NAME` picks the environment (default `apollo`).

Everything else is read out of the nginx site that environment already has, so
the public entry point cannot drift from the private ones. Two values can be
overridden when you are exposing a _second_ build of the same environment — a
branch's Ganymede on a spare port, a frontend built in another checkout:

```bash
GANYMEDE_PORT=6199 \
FRONTEND_ROOT=/path/to/checkout/packages/app-frontend/dist \
  ./scripts/local-dev/tunnel.sh up
```

With `GANYMEDE_PORT` set the script will not restart Ganymede — that process is
yours, and `PUBLIC_TUNNEL=1` has to be in its environment.

> Anyone with the URL can reach the environment. There is no gate in front of
> it beyond the application's own sign-in. `down` ends it.

---

## Why this needed anything at all

The platform addresses its three pieces by hostname:

| Piece                         | Name                  |
| ----------------------------- | --------------------- |
| Frontend                      | `<domain>`            |
| Ganymede                      | `ganymede.<domain>`   |
| Gateway, one per organization | `org-<uuid>.<domain>` |

That needs wildcard DNS and a wildcard certificate for `<domain>`. A tunnel
gives neither: a Cloudflare quick tunnel mints one `*.trycloudflare.com` name
at start, a Tailscale funnel is one machine name. There is no `ganymede.` in
front of either, and a name minted at start cannot be in a build or a config
file written beforehand.

So on a tunnel the same three pieces are addressed **by path on one host**:

| Piece    | Path                                      |
| -------- | ----------------------------------------- |
| Frontend | `https://<public-host>/`                  |
| Ganymede | `https://<public-host>/-/ganymede/…`      |
| Gateway  | `https://<public-host>/-/gw/org-<uuid>/…` |

`/-/` is reserved for this. The frontend is a single-page application and owns
every other path under `/`.

Nothing is configured with the public name in advance. Each piece works out
which arrangement it is in, per request or per page load, by comparing the host
it is being reached on against the one it was configured for.

---

## What actually changes when you run it

`tunnel.sh up`:

1. **Starts the tunnel** and learns the public hostname.
2. **Writes one nginx server block** — `holistix-public.conf`, a
   `default_server` that answers for any `Host` matching no other block. It
   serves the frontend at `/`, proxies `/-/ganymede/` to Ganymede, and includes
   one `location` per organization from `nginx-gateways.d/locations/`, which
   Ganymede writes as it allocates gateways.
3. **Restarts Ganymede with `PUBLIC_TUNNEL=1`.**
4. **Checks the frontend and the API answer** through the public URL, and
   prints what it got.

The private server blocks are untouched: `https://apollo.test:8443` keeps
working exactly as before, at the same time.

### `PUBLIC_TUNNEL`

One flag, off by default, and with it off not one byte of behaviour changes.

Every origin decision the platform makes — CORS, CSRF, the session cookie, the
OAuth redirect target — is made against `ALLOWED_ORIGINS`, a list written when
the environment was created. A tunnel hostname cannot be on that list, because
it did not exist yet.

`PUBLIC_TUNNEL=1` adds one rule, stated in
`packages/backend-engine/src/lib/Handler/express/public-origin.ts`:

> a request whose `Origin` is the origin it was _sent to_ is same-origin, and
> same-origin is not cross-site.

A browser sets `Origin` itself and a page cannot forge it, so a cross-site
attacker cannot produce `Origin: https://x` on a request to `https://x` without
already being `https://x`. That is what makes the rule safe to apply to a
hostname nobody configured — which is the entire point.

It is behind a flag anyway, because trusting the forwarded host means trusting
whatever sits in front, and an instance whose names are all known gains nothing
from it.

---

## Providers

### Cloudflare quick tunnel (default)

```bash
brew install cloudflared
./scripts/local-dev/tunnel.sh up cloudflare
```

No account, no domain. A fresh `https://<random>.trycloudflare.com` on every
start, gone when the process stops. Best for "let someone look at this now".

### Tailscale Funnel

```bash
./scripts/local-dev/tunnel.sh up tailscale
```

One stable name per machine — `https://<machine>.<tailnet>.ts.net` — publicly
reachable while the funnel is on. Needs Funnel enabled for the machine in the
tailnet policy; `tailscale funnel status` says whether it is.

### A domain you own

If you have a domain and can point wildcard DNS at the host, you do not need
any of the above: give the environment that domain and the original
hostname-based arrangement works unchanged, with real certificates.

```bash
./scripts/local-dev/create-env.sh myenv app.example.com     # Linux
./scripts/local-dev/build-frontend.sh myenv
```

with `*.app.example.com` and `app.example.com` resolving to the host. This is
what `infra/ansible` provisions for a production server, with Let's Encrypt
instead of mkcert — see [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md).

Behind Cloudflare's proxy, note that Universal SSL covers `example.com` and
`*.example.com` but **not** `uc-<id>.org-<uuid>.example.com` — two labels deep
needs Advanced Certificate Manager.

---

## What is reachable, and what is not

|                                             | Through a single-hostname tunnel | With a domain you own |
| ------------------------------------------- | -------------------------------- | --------------------- |
| Frontend, sign-in, the account pages        | yes                              | yes                   |
| Ganymede API                                | yes                              | yes                   |
| Gateway API and the collaboration WebSocket | yes                              | yes                   |
| A user container's published services       | **no**                           | yes                   |

A container's services keep hostnames of their own, and that is not an
oversight to fix later. Each one behaves as if it owns `/` — the Jupyter image
is started with `JUPYTERHUB_BASE_URL="/"` and an OAuth callback built from its
own name, and an arbitrary catalogue image has no base-path setting to offer at
all. A path prefix breaks them; a hostname each does not. So a single-hostname
tunnel cannot reach them, and no amount of nginx will change that.

With a domain you own they work, and cheaply:

```
uc-<id>.org-<uuid>.example.com             a container
uc-<id>--<service>.org-<uuid>.example.com  one of its services
```

Two labels below the domain, never three — the service is folded into the
container's label precisely so that **one** `*.org-<uuid>.example.com` per
organization covers every container and every service it will ever have. At
three levels each container needed a certificate of its own, minted the moment
somebody pressed a button, which on the internet means an ACME issuance per
container against Let's Encrypt's 50-per-week budget. Organizations are few and
long-lived; containers are neither.

See `packages/modules/user-containers/src/lib/service-fqdn.ts` for the rule and
its tests.

Third-party sign-in (GitHub, GitLab, Discord, LinkedIn) additionally needs the
provider's OAuth app to list the tunnel's callback URL — a quick tunnel's name
changes on every start, so a stable one (Tailscale, or your own domain) is the
practical choice there.

---

## When something does not answer

```bash
./scripts/local-dev/tunnel.sh status
```

**403 `CSRF validation failed`** — Ganymede is not running with
`PUBLIC_TUNNEL=1`. `status` reports it. It is set on restart, so a
`ganymede-apple.sh restart` run by hand while a tunnel is up keeps it, but a
rebuild that never restarted will not have it.

**The page loads and everything under it fails** — the frontend is calling the
local `ganymede.<domain>` because the bundle was served from the domain it was
built for. Check which host the browser is on; the switch to paths keys off
exactly that.

**A gateway 502s while the frontend is fine** — the organization's location
file is missing from `nginx-gateways.d/locations/`. Ganymede writes it when it
allocates a gateway, so an organization whose gateway was allocated before this
existed needs one reallocation:

```bash
./scripts/local-dev/macos/gateway-apple.sh list
```

**nginx refuses to reload** — `nginx -t` prints the reason. The usual one is a
second `default_server` on the same port, which means two environments are
being tunnelled at once; only one can be.

---

## Related

- `scripts/local-dev/tunnel.sh` — the script, commented
- `packages/backend-engine/src/lib/Handler/express/public-origin.ts` — the rule
- `packages/types/src/lib/public-routing.ts` — the paths, shared by all three sides
- `packages/app-ganymede/src/lib/public-routing.ts` — which arrangement a request is in
- [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md), [PRODUCTION_DEPLOYMENT.md](PRODUCTION_DEPLOYMENT.md)
