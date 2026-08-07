package auth

import (
	"net/http"
	"strings"
)

// CORS lets the platform's own page call a container's API.
//
// A service is reached two ways. In a frame, the browser navigates to
// `{service}.uc-X.org-Y.{domain}` and everything is same-origin inside it. But
// the platform's modules — the Jupyter one drives kernels and terminals with
// `@jupyterlab/services` — run in the page at `{domain}` and call the container
// across origins. Without these headers the browser discards those responses
// before any code sees them, which reads as a service that answers nothing.
//
// Only the platform's own origins, and only with credentials: the session
// cookie is what the guard authorizes on, so `Allow-Credentials` is the whole
// point, and it forbids the `*` wildcard. Anything else is refused by omission
// — a page elsewhere gets no header and the browser drops the response, which
// is exactly what should happen.
type CORS struct {
	// allowed origins, exact match, lower-cased.
	origins map[string]struct{}
}

// NewCORS builds the policy from the platform domain.
//
// `domain` carries its port where nginx is not on 443, and an origin includes
// one — the same reason `PortSuffix` exists. Both `https://{domain}` and any
// subdomain of it are allowed: an organization's page is at
// `org-Y.{domain}`, and a container's own services are subdomains too, so a
// service calling a sibling is a case that already exists.
func NewCORS(domain string) *CORS {
	c := &CORS{origins: map[string]struct{}{}}
	if domain == "" {
		return c
	}
	c.origins["https://"+strings.ToLower(domain)] = struct{}{}
	return c
}

// allows reports whether this origin may read a response from the container.
func (c *CORS) allows(origin string) bool {
	if origin == "" {
		return false
	}
	o := strings.ToLower(origin)
	if _, ok := c.origins[o]; ok {
		return true
	}
	// A subdomain of the platform. Compared against the allowed origin with its
	// scheme, so `https://evil.com/?x=https://apollo.test` and
	// `https://apollo.test.evil.com` both fail: the first is not a suffix at
	// all, the second does not end at a label boundary of an allowed origin.
	for allowed := range c.origins {
		host := strings.TrimPrefix(allowed, "https://")
		if strings.HasPrefix(o, "https://") && strings.HasSuffix(o, "."+host) {
			return true
		}
	}
	return false
}

// Handler answers preflights and adds the headers to everything else.
//
// The preflight is answered here rather than passed upstream because the
// container behind it has no idea this platform exists — and because a
// preflight carries no cookie, so letting it through the authentication check
// would refuse it and the real request would never be sent.
func (c *CORS) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if c.allows(origin) {
			h := w.Header()
			h.Set("Access-Control-Allow-Origin", origin)
			h.Set("Access-Control-Allow-Credentials", "true")
			// The response varies by Origin, and a cache that missed this
			// would serve one tenant's headers to another.
			h.Add("Vary", "Origin")

			if r.Method == http.MethodOptions &&
				r.Header.Get("Access-Control-Request-Method") != "" {
				h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				// Echoed rather than listed: Jupyter's client sends its own
				// headers and a fixed list would quietly drop the next one.
				if req := r.Header.Get("Access-Control-Request-Headers"); req != "" {
					h.Set("Access-Control-Allow-Headers", req)
				}
				h.Set("Access-Control-Max-Age", "600")
				w.WriteHeader(http.StatusNoContent)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}
