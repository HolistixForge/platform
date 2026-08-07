package auth

import (
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"

	"github.com/holistixforge/auth-guard/proxy"
)

// Middleware provides HTTP middleware for authentication.
type Middleware struct {
	sessions      *SessionStore
	jwtValidator  *JWTValidator
	permChecker   *PermissionChecker
	oauthHandler  *OAuthHandler
	relayHandler  *RelayHandler
	router        *proxy.Router
	customDomains []string
	baseFQDN      string
	portSuffix    string
	upstreamToken string
}

// guardOrigin is where this guard is reachable from a browser.
//
// `baseFQDN` is deliberately portless: it is a cookie domain and a routing key,
// and neither of those may carry a port. Every *absolute URL* built from it has
// to put the port back, or a deployment that does not serve on 443 sends people
// to an address nothing is listening on.
//
// The two were consistent while both were wrong — the redirect URI had no port
// either — so adding the port to the OAuth redirect alone is what made them
// disagree. One helper, used everywhere an absolute URL is built.
func guardOrigin(baseFQDN, portSuffix string) string {
	return "https://" + baseFQDN + portSuffix
}

// MiddlewareConfig holds configuration for the auth middleware.
type MiddlewareConfig struct {
	Sessions      *SessionStore
	JWTValidator  *JWTValidator
	PermChecker   *PermissionChecker
	OAuthHandler  *OAuthHandler
	RelayHandler  *RelayHandler
	Router        *proxy.Router
	CustomDomains []string
	BaseFQDN      string
	// PortSuffix is ":8443" or "", and belongs to every absolute URL built
	// from BaseFQDN — never to a cookie domain or a Router lookup.
	PortSuffix string
	// UpstreamToken authenticates the guard to the service it fronts. Added
	// only to requests the guard has already authorized, and never sent to a
	// browser. Empty where the service needs nothing.
	UpstreamToken string
}

// NewMiddleware creates a new auth Middleware.
func NewMiddleware(cfg MiddlewareConfig) *Middleware {
	return &Middleware{
		sessions:      cfg.Sessions,
		jwtValidator:  cfg.JWTValidator,
		permChecker:   cfg.PermChecker,
		oauthHandler:  cfg.OAuthHandler,
		relayHandler:  cfg.RelayHandler,
		router:        cfg.Router,
		customDomains: cfg.CustomDomains,
		baseFQDN:      cfg.BaseFQDN,
		portSuffix:    cfg.PortSuffix,
		upstreamToken: cfg.UpstreamToken,
	}
}

// Handler returns an http.Handler that enforces authentication.
// The next handler is called with auth headers set if authentication succeeds.
func (m *Middleware) Handler(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Handle internal auth endpoints
		if m.handleAuthEndpoints(w, r) {
			return
		}

		// Priority 1: Check session cookie
		if session := m.sessions.GetSessionFromRequest(r); session != nil {
			r.Header.Set("X-Auth-User-Id", session.UserID)
			r.Header.Set("X-Auth-User-Name", session.Username)
			r.Header.Set("X-Auth-Display-Name", session.DisplayName)
			r.Header.Set("X-Auth-Verified", "true")
			m.presentUpstreamToken(r)
			next.ServeHTTP(w, r)
			return
		}

		// Priority 2: Check Authorization: Bearer header
		if token := extractBearerToken(r); token != "" {
			claims, err := m.jwtValidator.Validate(token)
			if err != nil {
				log.Printf("[middleware] JWT validation failed: %v", err)
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Check permission via gateway
			if m.permChecker != nil {
				allowed, _, err := m.permChecker.CheckAccessCached(claims.UserID, token)
				if err != nil {
					log.Printf("[middleware] permission check failed: %v", err)
					http.Error(w, "Permission check failed", http.StatusInternalServerError)
					return
				}
				if !allowed {
					http.Error(w, "Forbidden", http.StatusForbidden)
					return
				}
			}

			r.Header.Set("X-Auth-User-Id", claims.UserID)
			r.Header.Set("X-Auth-User-Name", claims.Username)
			r.Header.Set("X-Auth-Display-Name", claims.DisplayName)
			r.Header.Set("X-Auth-Verified", "true")
			m.presentUpstreamToken(r)
			next.ServeHTTP(w, r)
			return
		}

		// Priority 3: Check token query parameter (for WebSocket connections)
		//
		// A browser cannot put an Authorization header on a WebSocket handshake,
		// so the credential travels in the query instead. It is consumed here
		// and removed before the request goes on — see `consumeQueryToken`.
		if token := r.URL.Query().Get("token"); token != "" {
			claims, err := m.jwtValidator.Validate(token)
			if err != nil {
				log.Printf("[middleware] token query param validation failed: %v", err)
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}

			// Check permission via gateway
			if m.permChecker != nil {
				allowed, _, err := m.permChecker.CheckAccessCached(claims.UserID, token)
				if err != nil {
					log.Printf("[middleware] permission check failed: %v", err)
					http.Error(w, "Permission check failed", http.StatusInternalServerError)
					return
				}
				if !allowed {
					http.Error(w, "Forbidden", http.StatusForbidden)
					return
				}
			}

			r.Header.Set("X-Auth-User-Id", claims.UserID)
			r.Header.Set("X-Auth-User-Name", claims.Username)
			r.Header.Set("X-Auth-Display-Name", claims.DisplayName)
			r.Header.Set("X-Auth-Verified", "true")
			consumeQueryToken(r)
			m.presentUpstreamToken(r)
			next.ServeHTTP(w, r)
			return
		}

		// No authentication found
		// Priority 4: If API request, return 401
		if isAPIRequest(r) {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		// Priority 5: If custom domain, redirect to cross-domain login
		if m.router.IsCustomDomain(r.Host, m.customDomains) {
			originalURL := fmt.Sprintf("https://%s%s", r.Host, r.RequestURI)
			crossDomainURL := fmt.Sprintf("%s/__auth/cross-domain-login?origin=%s&return_to=%s",
				guardOrigin(m.baseFQDN, m.portSuffix),
				url.QueryEscape(stripPort(r.Host)),
				url.QueryEscape(originalURL),
			)
			http.Redirect(w, r, crossDomainURL, http.StatusFound)
			return
		}

		// Priority 6: Platform domain - redirect to OAuth
		originalURL := fmt.Sprintf("https://%s%s", r.Host, r.RequestURI)
		m.oauthHandler.RedirectToAuth(w, r, originalURL)
	})
}

// handleAuthEndpoints handles internal /__auth/* paths.
// Returns true if the request was handled.
func (m *Middleware) handleAuthEndpoints(w http.ResponseWriter, r *http.Request) bool {
	path := r.URL.Path

	switch {
	case path == "/__auth/callback":
		m.oauthHandler.HandleCallback(w, r)
		return true
	case path == "/__auth/cross-domain-login":
		m.relayHandler.HandleCrossDomainLogin(w, r)
		return true
	case path == "/__auth/relay":
		m.relayHandler.HandleRelay(w, r)
		return true
	}

	return false
}

// extractBearerToken extracts the token from the Authorization: Bearer header.
// extractBearerToken reads the credential a caller presents, under either name.
//
// `Bearer` is the HTTP one. `token` is Jupyter's, and it is not a detail we can
// wave away: the gateway drives a notebook with `@jupyterlab/services`, which
// writes `Authorization: token <credential>` and offers no way to change it —
// so the very client this guard exists to front could not authenticate to it.
// Measured: creating a terminal from a service card failed with
// "Invalid response: 401 Unauthorized", raised by the gateway against its own
// container.
//
// Accepting both costs nothing. What follows validates the credential as a JWT
// and checks the permission with the gateway, so a scheme name is only a label
// on the envelope — nothing is trusted because of how it was spelled.
func extractBearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		return ""
	}
	parts := strings.SplitN(auth, " ", 2)
	if len(parts) != 2 {
		return ""
	}
	if !strings.EqualFold(parts[0], "Bearer") && !strings.EqualFold(parts[0], "token") {
		return ""
	}
	return parts[1]
}

// stripPort removes the port from a host string.
func stripPort(host string) string {
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		if !strings.Contains(host[idx:], "]") {
			return host[:idx]
		}
	}
	return host
}

// presentUpstreamToken authenticates this request to the service behind.
//
// Only on a request the guard has just authorized — that is the whole
// arrangement: the browser proves who it is with a session, the guard checks
// with the gateway that this user may reach this container, and the token that
// opens the service is added here and never leaves the container's network.
//
// A caller's own Authorization header is replaced rather than kept. It has
// already been consumed by the guard if it meant anything, and forwarding it
// would let a caller choose what the service sees.
func (m *Middleware) presentUpstreamToken(r *http.Request) {
	if m.upstreamToken == "" {
		return
	}
	r.Header.Set("Authorization", "token "+m.upstreamToken)
}

// consumeQueryToken removes the credential the guard just used.
//
// The platform's own JWT travelled in `?token=` because a WebSocket handshake
// carries no Authorization header. Left in place, it reaches the service —
// which reads a parameter of that name as *its* token. Measured: JupyterLab
// answered 403 to every terminal WebSocket, then asked its hub who the user
// was and was refused too, while the guard had authenticated the request
// perfectly well and said so in the headers it added.
//
// The same reasoning as replacing the Authorization header: the guard consumes
// the caller's credential and presents its own. A caller does not get to choose
// what the service behind sees.
func consumeQueryToken(r *http.Request) {
	q := r.URL.Query()
	if !q.Has("token") {
		return
	}
	q.Del("token")
	r.URL.RawQuery = q.Encode()
}
