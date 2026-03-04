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
			next.ServeHTTP(w, r)
			return
		}

		// Priority 3: Check token query parameter (for WebSocket connections)
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
			crossDomainURL := fmt.Sprintf("https://%s/__auth/cross-domain-login?origin=%s&return_to=%s",
				m.baseFQDN,
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
func extractBearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		return ""
	}
	parts := strings.SplitN(auth, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
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
