package config

import "testing"

func TestBaseFQDNCarriesThePortTheGatewayIsOn(t *testing.T) {
	// The cookie domain must be portless — a browser rejects one with a port —
	// and the redirect_uri must not be. One value cannot do both.
	cases := []struct {
		name       string
		gatewayURL string
		want       string
	}{
		{"non-default port is carried", "https://org-o.apollo.test:8443", "uc-c.org-o.apollo.test:8443"},
		{"443 is left implicit", "https://org-o.example.com:443", "uc-c.org-o.example.com"},
		{"no port at all", "https://org-o.example.com", "uc-c.org-o.example.com"},
		{"unparseable url does not panic", "://nonsense", "uc-c.org-o.example.com"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := portSuffix(tc.gatewayURL)
			domain := "apollo.test"
			if tc.name != "non-default port is carried" {
				domain = "example.com"
			}
			full := "uc-c.org-o." + domain + got
			if full != tc.want {
				t.Fatalf("got %q, want %q", full, tc.want)
			}
		})
	}
}
