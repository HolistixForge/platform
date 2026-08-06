package config

import (
	"flag"
	"fmt"
	"net/url"
	"strings"
	"time"
)

// Config holds all configuration for the auth guard proxy.
type Config struct {
	ListenPort          int
	AdminPort           int
	GanymedeURL         string
	GatewayURL          string
	ClientID            string
	ClientSecret        string
	ContainerID         string
	OrganizationID      string
	CookieDomain        string
	SessionTTL          time.Duration
	CustomDomains       []string
	InsecureSkipVerify  bool
	SkipPermissionCheck bool
	BaseFQDN            string // derived: uc-{ContainerID}.org-{OrganizationID}.{domain}, portless
	// PortSuffix is ":8443" or "", and belongs to every URL built from
	// BaseFQDN and to nothing that matches a host name. See the derivation.
	PortSuffix string
	Domain     string // extracted from CookieDomain
}

// Parse reads CLI flags and returns a populated Config.
func Parse(args []string) (*Config, error) {
	fs := flag.NewFlagSet("auth-guard", flag.ContinueOnError)

	cfg := &Config{}

	fs.IntVar(&cfg.ListenPort, "listen-port", 8443, "Main proxy listen port")
	fs.IntVar(&cfg.AdminPort, "admin-port", 9999, "Admin API listen port (localhost only)")
	fs.StringVar(&cfg.GanymedeURL, "ganymede-url", "", "Ganymede auth server URL")
	fs.StringVar(&cfg.GatewayURL, "gateway-url", "", "Gateway URL for permission checks")
	fs.StringVar(&cfg.ClientID, "client-id", "", "OAuth client ID")
	fs.StringVar(&cfg.ClientSecret, "client-secret", "", "OAuth client secret")
	fs.StringVar(&cfg.ContainerID, "container-id", "", "Container identifier")
	fs.StringVar(&cfg.OrganizationID, "organization-id", "", "Organization identifier")
	fs.StringVar(&cfg.CookieDomain, "cookie-domain", "", "Cookie domain for sessions")
	fs.BoolVar(&cfg.InsecureSkipVerify, "insecure-skip-verify", false, "Skip TLS verification (dev only)")
	fs.BoolVar(&cfg.SkipPermissionCheck, "skip-permission-check", false, "Skip gateway permission checks (dev only)")

	var sessionTTL string
	fs.StringVar(&sessionTTL, "session-ttl", "24h", "Session TTL duration (e.g. 24h, 1h30m)")

	var customDomains string
	fs.StringVar(&customDomains, "custom-domains", "", "Comma-separated list of custom domains")

	if err := fs.Parse(args); err != nil {
		return nil, err
	}

	ttl, err := time.ParseDuration(sessionTTL)
	if err != nil {
		return nil, fmt.Errorf("invalid session-ttl %q: %w", sessionTTL, err)
	}
	cfg.SessionTTL = ttl

	if customDomains != "" {
		for _, d := range strings.Split(customDomains, ",") {
			d = strings.TrimSpace(d)
			if d != "" {
				cfg.CustomDomains = append(cfg.CustomDomains, d)
			}
		}
	}

	// Derive domain from CookieDomain
	cfg.Domain = strings.TrimPrefix(cfg.CookieDomain, ".")

	// BaseFQDN stays portless, and the port is a value of its own.
	//
	// Three things are derived from this name and they do not agree about the
	// port. A *cookie domain* must not have one — a browser rejects
	// `.apollo.test:8443` outright. A *routing key* must not either, because
	// `Router.GetBackend` strips the port off the Host header before it looks
	// one up. But a *URL* must: the OAuth `redirect_uri` the guard presents is
	// compared byte for byte against the one its client was registered with,
	// and Ganymede refused the whole flow — "Invalid client: `redirect_uri`
	// does not match client value", a 403 on a login the user never saw —
	// because the guard sent `https://uc-….apollo.test/__auth/callback` for a
	// client registered at `…apollo.test:8443/__auth/callback`.
	//
	// Putting the port into BaseFQDN fixes the URL and breaks the routing:
	// measured, every service then answered "Service not found", because the
	// map was keyed with a port and looked up without one. So the two are
	// separate values, and each caller takes the one it needs.
	//
	// The port comes from the gateway URL: the platform's own address, given
	// to this process for exactly that reason.
	if cfg.ContainerID != "" && cfg.OrganizationID != "" && cfg.Domain != "" {
		cfg.BaseFQDN = fmt.Sprintf("uc-%s.org-%s.%s", cfg.ContainerID, cfg.OrganizationID, cfg.Domain)
	}
	cfg.PortSuffix = portSuffix(cfg.GatewayURL)

	// Validate required fields
	if cfg.GanymedeURL == "" {
		return nil, fmt.Errorf("--ganymede-url is required")
	}
	if cfg.GatewayURL == "" {
		return nil, fmt.Errorf("--gateway-url is required")
	}
	if cfg.ClientID == "" {
		return nil, fmt.Errorf("--client-id is required")
	}
	if cfg.ClientSecret == "" {
		return nil, fmt.Errorf("--client-secret is required")
	}
	if cfg.ContainerID == "" {
		return nil, fmt.Errorf("--container-id is required")
	}
	if cfg.OrganizationID == "" {
		return nil, fmt.Errorf("--organization-id is required")
	}
	if cfg.CookieDomain == "" {
		return nil, fmt.Errorf("--cookie-domain is required")
	}

	return cfg, nil
}

// portSuffix returns ":port" from a URL, or "" when it is absent or implied.
//
// Empty for 443 as well as for no port at all: `https://host:443` and
// `https://host` are the same origin, and writing the explicit form into a
// redirect_uri would fail to match a client registered with the implicit one —
// which is the same failure this exists to fix, spelled the other way.
func portSuffix(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	port := u.Port()
	if port == "" || port == "443" {
		return ""
	}
	return ":" + port
}
