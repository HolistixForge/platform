package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	jwtlib "github.com/golang-jwt/jwt/v5"

	"github.com/holistixforge/auth-guard/proxy"
)

func setupMiddleware(t *testing.T) (*Middleware, *SessionStore, func(string) string) {
	t.Helper()

	privateKey, publicKey := generateTestKeyPair(t)

	sessions := NewSessionStore(1 * time.Hour)
	jwtValidator := NewJWTValidatorFromKey(publicKey)

	// Mock gateway for permission checks
	gatewayServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := verifyAccessResponse{
			Allowed:  true,
			UserID:   "user-123",
			Username: "testuser",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))

	permChecker := NewPermissionChecker(gatewayServer.URL, "container-abc", gatewayServer.Client(), 1*time.Hour)

	router := proxy.NewRouter("uc-abc.org-xyz.example.local", "example.local")

	oauthHandler := NewOAuthHandler(OAuthConfig{
		GanymedeURL:  "https://ganymede.example.local",
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		BaseFQDN:     "uc-abc.org-xyz.example.local",
		HTTPClient:   http.DefaultClient,
		Sessions:     sessions,
		CookieDomain: ".example.local",
		JWTValidator: jwtValidator,
		PermChecker:  permChecker,
	})

	relayHandler := NewRelayHandler("test-secret", sessions, ".example.local", "uc-abc.org-xyz.example.local", oauthHandler)

	middleware := NewMiddleware(MiddlewareConfig{
		Sessions:      sessions,
		JWTValidator:  jwtValidator,
		PermChecker:   permChecker,
		OAuthHandler:  oauthHandler,
		RelayHandler:  relayHandler,
		Router:        router,
		CustomDomains: []string{"myapp.com"},
		BaseFQDN:      "uc-abc.org-xyz.example.local",
	})

	// Helper to create signed JWTs
	signJWT := func(userID string) string {
		claims := jwtlib.MapClaims{
			"user_id":      userID,
			"username":     "testuser",
			"display_name": "Test User",
			"exp":          time.Now().Add(1 * time.Hour).Unix(),
		}
		return signTestJWT(t, privateKey, claims)
	}

	t.Cleanup(func() {
		sessions.Stop()
		gatewayServer.Close()
	})

	return middleware, sessions, signJWT
}

func TestMiddlewarePassesThroughWithValidSession(t *testing.T) {
	middleware, sessions, _ := setupMiddleware(t)

	sessionID := sessions.Create("user-123", "testuser", "Test User", "at", "rt", nil, "example.local")

	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		if r.Header.Get("X-Auth-User-Id") != "user-123" {
			t.Errorf("expected X-Auth-User-Id=user-123, got %s", r.Header.Get("X-Auth-User-Id"))
		}
		if r.Header.Get("X-Auth-Verified") != "true" {
			t.Errorf("expected X-Auth-Verified=true, got %s", r.Header.Get("X-Auth-Verified"))
		}
		w.WriteHeader(http.StatusOK)
	})

	handler := middleware.Handler(next)

	req := httptest.NewRequest("GET", "https://uc-abc.org-xyz.example.local/", nil)
	req.Host = "uc-abc.org-xyz.example.local"
	req.AddCookie(&http.Cookie{
		Name:  SessionCookieName,
		Value: sessionID,
	})
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if !nextCalled {
		t.Error("expected next handler to be called")
	}
}

func TestMiddlewarePassesThroughWithValidBearerJWT(t *testing.T) {
	middleware, _, signJWT := setupMiddleware(t)

	jwt := signJWT("user-123")

	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		if r.Header.Get("X-Auth-User-Id") != "user-123" {
			t.Errorf("expected X-Auth-User-Id=user-123, got %s", r.Header.Get("X-Auth-User-Id"))
		}
		w.WriteHeader(http.StatusOK)
	})

	handler := middleware.Handler(next)

	req := httptest.NewRequest("GET", "https://uc-abc.org-xyz.example.local/", nil)
	req.Host = "uc-abc.org-xyz.example.local"
	req.Header.Set("Authorization", "Bearer "+jwt)
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if !nextCalled {
		t.Error("expected next handler to be called with valid Bearer JWT")
	}
}

func TestMiddlewareRedirectsToOAuthForUnauthenticatedPlatformDomain(t *testing.T) {
	middleware, _, _ := setupMiddleware(t)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("next handler should not be called")
	})

	handler := middleware.Handler(next)

	req := httptest.NewRequest("GET", "https://uc-abc.org-xyz.example.local/dashboard", nil)
	req.Host = "uc-abc.org-xyz.example.local"
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusFound {
		t.Errorf("expected 302 redirect, got %d", resp.StatusCode)
	}

	location := resp.Header.Get("Location")
	if location == "" {
		t.Fatal("expected Location header for OAuth redirect")
	}
	if !contains(location, "oauth/authorize") {
		t.Errorf("expected OAuth authorize URL, got %s", location)
	}
}

func TestMiddlewareRedirectsToCrossDomainLoginForCustomDomain(t *testing.T) {
	middleware, _, _ := setupMiddleware(t)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("next handler should not be called")
	})

	handler := middleware.Handler(next)

	req := httptest.NewRequest("GET", "https://myapp.com/page", nil)
	req.Host = "myapp.com"
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusFound {
		t.Errorf("expected 302 redirect, got %d", resp.StatusCode)
	}

	location := resp.Header.Get("Location")
	if !contains(location, "cross-domain-login") {
		t.Errorf("expected cross-domain-login URL, got %s", location)
	}
}

func TestMiddlewareReturns401ForUnauthenticatedAPIRequest(t *testing.T) {
	middleware, _, _ := setupMiddleware(t)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("next handler should not be called")
	})

	handler := middleware.Handler(next)

	req := httptest.NewRequest("GET", "https://uc-abc.org-xyz.example.local/api/data", nil)
	req.Host = "uc-abc.org-xyz.example.local"
	req.Header.Set("Accept", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

func TestMiddlewarePassesThroughWithTokenQueryParam(t *testing.T) {
	middleware, _, signJWT := setupMiddleware(t)

	jwt := signJWT("user-123")

	nextCalled := false
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		nextCalled = true
		w.WriteHeader(http.StatusOK)
	})

	handler := middleware.Handler(next)

	req := httptest.NewRequest("GET", "https://uc-abc.org-xyz.example.local/ws?token="+jwt, nil)
	req.Host = "uc-abc.org-xyz.example.local"
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if !nextCalled {
		t.Error("expected next handler to be called with valid token query param")
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && searchString(s, substr)
}

func searchString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
