package proxy

import (
	"fmt"
	"net/url"
	"strings"
	"sync"
)

// Router maps hostnames to backend URLs.
type Router struct {
	mu       sync.RWMutex
	backends map[string]*url.URL
	baseFQDN string
	domain   string
}

// NewRouter creates a new Router with the given base FQDN.
// The baseFQDN is automatically registered to an internal auth handler placeholder.
func NewRouter(baseFQDN, domain string) *Router {
	r := &Router{
		backends: make(map[string]*url.URL),
		baseFQDN: baseFQDN,
		domain:   domain,
	}
	return r
}

// RegisterService registers a named service on a given port and returns its FQDN.
// The FQDN is "{name}.{baseFQDN}" and the backend is "http://localhost:{port}".
func (r *Router) RegisterService(name string, port int) (string, error) {
	fqdn := fmt.Sprintf("%s.%s", name, r.baseFQDN)
	backendURL, err := url.Parse(fmt.Sprintf("http://localhost:%d", port))
	if err != nil {
		return "", fmt.Errorf("invalid backend URL: %w", err)
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	r.backends[fqdn] = backendURL

	return fqdn, nil
}

// GetBackend looks up the backend URL for a given Host header value.
// It strips the port from the host before lookup.
func (r *Router) GetBackend(host string) (*url.URL, bool) {
	// Strip port if present
	h := host
	if idx := strings.LastIndex(h, ":"); idx != -1 {
		// Check if this is not an IPv6 address
		if !strings.Contains(h[idx:], "]") {
			h = h[:idx]
		}
	}

	r.mu.RLock()
	defer r.mu.RUnlock()

	backend, ok := r.backends[h]
	return backend, ok
}

// IsBaseFQDN checks if the given host matches the base FQDN.
func (r *Router) IsBaseFQDN(host string) bool {
	h := host
	if idx := strings.LastIndex(h, ":"); idx != -1 {
		if !strings.Contains(h[idx:], "]") {
			h = h[:idx]
		}
	}
	return h == r.baseFQDN
}

// IsCustomDomain checks if the host is a custom domain (not a sub of baseFQDN).
func (r *Router) IsCustomDomain(host string, customDomains []string) bool {
	h := host
	if idx := strings.LastIndex(h, ":"); idx != -1 {
		if !strings.Contains(h[idx:], "]") {
			h = h[:idx]
		}
	}
	for _, cd := range customDomains {
		if h == cd {
			return true
		}
	}
	return false
}

// ListServices returns a map of all registered service FQDNs to their backend URLs.
func (r *Router) ListServices() map[string]string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make(map[string]string, len(r.backends))
	for fqdn, backend := range r.backends {
		result[fqdn] = backend.String()
	}
	return result
}

// BaseFQDN returns the base FQDN.
func (r *Router) BaseFQDN() string {
	return r.baseFQDN
}

// Domain returns the domain.
func (r *Router) Domain() string {
	return r.domain
}
