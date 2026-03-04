package proxy

import (
	"crypto/tls"
	"log"
	"net/http"
	"net/http/httputil"
	"strings"
)

// AuthInfo holds authenticated user information to be injected into proxied requests.
type AuthInfo struct {
	UserID      string
	Username    string
	DisplayName string
}

// ReverseProxy wraps httputil.ReverseProxy with auth-guard specific logic.
type ReverseProxy struct {
	router             *Router
	insecureSkipVerify bool
}

// NewReverseProxy creates a new ReverseProxy with the given router.
func NewReverseProxy(router *Router, insecureSkipVerify bool) *ReverseProxy {
	return &ReverseProxy{
		router:             router,
		insecureSkipVerify: insecureSkipVerify,
	}
}

// ProxyRequest proxies an HTTP request to the backend for the given host.
// It adds auth headers based on the provided AuthInfo.
// Returns false if no backend is found for the host.
func (rp *ReverseProxy) ProxyRequest(w http.ResponseWriter, r *http.Request, authInfo *AuthInfo) bool {
	backend, ok := rp.router.GetBackend(r.Host)
	if !ok {
		return false
	}

	// Check if this is a WebSocket upgrade request
	isWebSocket := isWebSocketRequest(r)

	proxy := &httputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL.Scheme = backend.Scheme
			req.URL.Host = backend.Host
			req.Host = backend.Host

			// Add auth headers
			if authInfo != nil {
				req.Header.Set("X-Auth-User-Id", authInfo.UserID)
				req.Header.Set("X-Auth-User-Name", authInfo.Username)
				req.Header.Set("X-Auth-Display-Name", authInfo.DisplayName)
				req.Header.Set("X-Auth-Verified", "true")
			}

			// Remove hop-by-hop headers that shouldn't be forwarded
			// (except for WebSocket upgrades)
			if !isWebSocket {
				req.Header.Del("Connection")
				req.Header.Del("Upgrade")
			}
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			log.Printf("[proxy] backend error for %s: %v", r.Host, err)
			http.Error(w, "Bad Gateway", http.StatusBadGateway)
		},
	}

	// Configure transport for self-signed certs in dev
	if rp.insecureSkipVerify {
		proxy.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
	}

	// For WebSocket requests, ensure the proxy handles the upgrade
	if isWebSocket {
		proxy.FlushInterval = -1 // Flush immediately for streaming
	}

	proxy.ServeHTTP(w, r)
	return true
}

// isWebSocketRequest checks if the request is a WebSocket upgrade request.
func isWebSocketRequest(r *http.Request) bool {
	connHeader := r.Header.Get("Connection")
	upgradeHeader := r.Header.Get("Upgrade")
	return strings.EqualFold(upgradeHeader, "websocket") ||
		strings.Contains(strings.ToLower(connHeader), "upgrade")
}
