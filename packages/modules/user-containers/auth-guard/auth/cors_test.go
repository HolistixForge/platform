package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func corsUnder(t *testing.T, domain string) http.Handler {
	t.Helper()
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	return NewCORS(domain).Handler(next)
}

func TestCORSAllowsThePlatformAndItsSubdomains(t *testing.T) {
	h := corsUnder(t, "apollo.test:8443")

	for _, origin := range []string{
		"https://apollo.test:8443",
		"https://org-abc.apollo.test:8443",
		"https://jupyterlab.uc-x.org-abc.apollo.test:8443",
	} {
		r := httptest.NewRequest("GET", "/api/kernels", nil)
		r.Header.Set("Origin", origin)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)

		if got := w.Header().Get("Access-Control-Allow-Origin"); got != origin {
			t.Fatalf("origin %q: got %q, want it echoed", origin, got)
		}
		if got := w.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
			t.Fatalf("origin %q: credentials not allowed — the session cookie is what the guard authorizes on", origin)
		}
	}
}

func TestCORSRefusesAnyoneElseBySayingNothing(t *testing.T) {
	h := corsUnder(t, "apollo.test:8443")

	for _, origin := range []string{
		"https://evil.com",
		// Ends with the platform's name but is not under it — the check must
		// land on a label boundary of an allowed origin.
		"https://apollo.test.evil.com",
		// Right host, wrong port: an origin includes the port.
		"https://apollo.test:9999",
		// Right host, wrong scheme.
		"http://apollo.test:8443",
	} {
		r := httptest.NewRequest("GET", "/api/kernels", nil)
		r.Header.Set("Origin", origin)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)

		if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
			t.Fatalf("origin %q was allowed with %q", origin, got)
		}
	}
}

func TestCORSAnswersThePreflightItself(t *testing.T) {
	// A preflight carries no cookie. Passed through the authentication check it
	// would be refused, and the real request would never be sent — so the
	// guard answers it before anything else looks at it.
	h := corsUnder(t, "apollo.test:8443")

	r := httptest.NewRequest("OPTIONS", "/api/kernels", nil)
	r.Header.Set("Origin", "https://apollo.test:8443")
	r.Header.Set("Access-Control-Request-Method", "POST")
	r.Header.Set("Access-Control-Request-Headers", "authorization, x-xsrftoken")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if w.Code != http.StatusNoContent {
		t.Fatalf("preflight answered %d, want 204", w.Code)
	}
	if got := w.Header().Get("Access-Control-Allow-Headers"); got != "authorization, x-xsrftoken" {
		t.Fatalf("requested headers not echoed, got %q", got)
	}
}

func TestCORSVariesByOrigin(t *testing.T) {
	// Without it a cache can serve one tenant's headers to another.
	h := corsUnder(t, "apollo.test:8443")
	r := httptest.NewRequest("GET", "/", nil)
	r.Header.Set("Origin", "https://apollo.test:8443")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)

	if got := w.Header().Get("Vary"); got != "Origin" {
		t.Fatalf("Vary = %q, want Origin", got)
	}
}
