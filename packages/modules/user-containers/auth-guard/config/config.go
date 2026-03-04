package config

import (
	"flag"
	"fmt"
	"strings"
	"time"
)

// Config holds all configuration for the auth guard proxy.
type Config struct {
	ListenPort         int
	AdminPort          int
	GanymedeURL        string
	GatewayURL         string
	ClientID           string
	ClientSecret       string
	ContainerID        string
	OrganizationID     string
	CookieDomain       string
	SessionTTL         time.Duration
	CustomDomains      []string
	InsecureSkipVerify  bool
	SkipPermissionCheck bool
	BaseFQDN            string // derived: uc-{ContainerID}.org-{OrganizationID}.{domain}
	Domain              string // extracted from CookieDomain
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

	// Derive BaseFQDN
	if cfg.ContainerID != "" && cfg.OrganizationID != "" && cfg.Domain != "" {
		cfg.BaseFQDN = fmt.Sprintf("uc-%s.org-%s.%s", cfg.ContainerID, cfg.OrganizationID, cfg.Domain)
	}

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
