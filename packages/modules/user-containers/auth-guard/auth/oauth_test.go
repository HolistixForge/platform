package auth

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	jwtlib "github.com/golang-jwt/jwt/v5"
)

func TestRedirectToAuth(t *testing.T) {
	sessions := NewSessionStore(1 * time.Hour)
	defer sessions.Stop()

	oauthHandler := NewOAuthHandler(OAuthConfig{
		GanymedeURL:  "https://ganymede.example.local",
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		BaseFQDN:     "uc-abc.org-xyz.example.local",
		HTTPClient:   http.DefaultClient,
		Sessions:     sessions,
		CookieDomain: ".example.local",
	})

	req := httptest.NewRequest("GET", "https://uc-abc.org-xyz.example.local/some/page", nil)
	w := httptest.NewRecorder()

	oauthHandler.RedirectToAuth(w, req, "https://uc-abc.org-xyz.example.local/some/page")

	resp := w.Result()
	if resp.StatusCode != http.StatusFound {
		t.Errorf("expected 302 redirect, got %d", resp.StatusCode)
	}

	location := resp.Header.Get("Location")
	if location == "" {
		t.Fatal("expected Location header")
	}

	// Parse the redirect URL
	redirectURL, err := url.Parse(location)
	if err != nil {
		t.Fatalf("failed to parse redirect URL: %v", err)
	}

	if !strings.HasPrefix(location, "https://ganymede.example.local/oauth/authorize") {
		t.Errorf("expected redirect to ganymede, got %s", location)
	}

	params := redirectURL.Query()
	if params.Get("client_id") != "test-client" {
		t.Errorf("expected client_id=test-client, got %s", params.Get("client_id"))
	}
	if params.Get("response_type") != "code" {
		t.Errorf("expected response_type=code, got %s", params.Get("response_type"))
	}
	if !strings.Contains(params.Get("redirect_uri"), "/__auth/callback") {
		t.Errorf("expected redirect_uri to contain /__auth/callback, got %s", params.Get("redirect_uri"))
	}
	if params.Get("state") == "" {
		t.Error("expected non-empty state parameter")
	}
}

func TestExchangeCodeSuccess(t *testing.T) {
	// Mock Ganymede token endpoint
	ganymedeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oauth/token" && r.Method == "POST" {
			r.ParseForm()
			if r.FormValue("code") != "test-code" {
				http.Error(w, "bad code", http.StatusBadRequest)
				return
			}
			resp := tokenResponse{
				AccessToken:  "access-token-123",
				RefreshToken: "refresh-token-456",
				TokenType:    "Bearer",
				ExpiresIn:    3600,
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
			return
		}
		http.NotFound(w, r)
	}))
	defer ganymedeServer.Close()

	sessions := NewSessionStore(1 * time.Hour)
	defer sessions.Stop()

	oauthHandler := NewOAuthHandler(OAuthConfig{
		GanymedeURL:  ganymedeServer.URL,
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		BaseFQDN:     "uc-abc.org-xyz.example.local",
		HTTPClient:   ganymedeServer.Client(),
		Sessions:     sessions,
		CookieDomain: ".example.local",
	})

	accessToken, refreshToken, err := oauthHandler.ExchangeCode("test-code")
	if err != nil {
		t.Fatalf("ExchangeCode failed: %v", err)
	}

	if accessToken != "access-token-123" {
		t.Errorf("expected access-token-123, got %s", accessToken)
	}
	if refreshToken != "refresh-token-456" {
		t.Errorf("expected refresh-token-456, got %s", refreshToken)
	}
}

func TestExchangeCodeFailure(t *testing.T) {
	// Mock Ganymede that always returns error
	ganymedeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "invalid_grant", http.StatusBadRequest)
	}))
	defer ganymedeServer.Close()

	sessions := NewSessionStore(1 * time.Hour)
	defer sessions.Stop()

	oauthHandler := NewOAuthHandler(OAuthConfig{
		GanymedeURL:  ganymedeServer.URL,
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		BaseFQDN:     "uc-abc.org-xyz.example.local",
		HTTPClient:   ganymedeServer.Client(),
		Sessions:     sessions,
		CookieDomain: ".example.local",
	})

	_, _, err := oauthHandler.ExchangeCode("bad-code")
	if err == nil {
		t.Fatal("expected error for bad code")
	}
}

func TestHandleCallbackSuccess(t *testing.T) {
	privateKey, publicKey := generateTestKeyPair(t)

	// Create a valid JWT for the token exchange response
	claims := jwtlib.MapClaims{
		"user_id":      "user-123",
		"username":     "testuser",
		"display_name": "Test User",
		"exp":          time.Now().Add(1 * time.Hour).Unix(),
	}
	validJWT := signTestJWT(t, privateKey, claims)

	// Mock Ganymede
	ganymedeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oauth/token" {
			resp := tokenResponse{
				AccessToken:  validJWT,
				RefreshToken: "refresh-token",
				TokenType:    "Bearer",
				ExpiresIn:    3600,
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
			return
		}
		http.NotFound(w, r)
	}))
	defer ganymedeServer.Close()

	// Mock Gateway (permission checker)
	gatewayServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := verifyAccessResponse{
			Allowed:  true,
			UserID:   "user-123",
			Username: "testuser",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer gatewayServer.Close()

	sessions := NewSessionStore(1 * time.Hour)
	defer sessions.Stop()

	jwtValidator := NewJWTValidatorFromKey(publicKey)
	permChecker := NewPermissionChecker(gatewayServer.URL, "container-abc", gatewayServer.Client(), 1*time.Hour)

	oauthHandler := NewOAuthHandler(OAuthConfig{
		GanymedeURL:  ganymedeServer.URL,
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		BaseFQDN:     "uc-abc.org-xyz.example.local",
		HTTPClient:   ganymedeServer.Client(),
		Sessions:     sessions,
		CookieDomain: ".example.local",
		JWTValidator: jwtValidator,
		PermChecker:  permChecker,
	})

	// Build a valid state parameter
	stateJSON, _ := json.Marshal(oauthState{
		OriginalURL: "https://uc-abc.org-xyz.example.local/dashboard",
		CSRFToken:   "csrf-123",
	})
	stateEncoded := base64.URLEncoding.EncodeToString(stateJSON)

	reqURL := "https://uc-abc.org-xyz.example.local/__auth/callback?code=test-code&state=" + url.QueryEscape(stateEncoded)
	req := httptest.NewRequest("GET", reqURL, nil)
	w := httptest.NewRecorder()

	oauthHandler.HandleCallback(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusFound {
		t.Errorf("expected 302 redirect, got %d", resp.StatusCode)
	}

	// Check that a session cookie was set
	cookies := resp.Cookies()
	var sessionCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == SessionCookieName {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil {
		t.Fatal("expected session cookie to be set")
	}

	// Verify session exists
	session := sessions.Get(sessionCookie.Value)
	if session == nil {
		t.Fatal("expected session to exist")
	}
	if session.UserID != "user-123" {
		t.Errorf("expected UserID=user-123, got %s", session.UserID)
	}
}

func TestRefreshTokenSuccess(t *testing.T) {
	ganymedeServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oauth/token" {
			r.ParseForm()
			if r.FormValue("grant_type") != "refresh_token" {
				http.Error(w, "wrong grant type", http.StatusBadRequest)
				return
			}
			resp := tokenResponse{
				AccessToken:  "new-access-token",
				RefreshToken: "new-refresh-token",
				TokenType:    "Bearer",
				ExpiresIn:    3600,
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(resp)
			return
		}
		http.NotFound(w, r)
	}))
	defer ganymedeServer.Close()

	sessions := NewSessionStore(1 * time.Hour)
	defer sessions.Stop()

	oauthHandler := NewOAuthHandler(OAuthConfig{
		GanymedeURL:  ganymedeServer.URL,
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		BaseFQDN:     "uc-abc.org-xyz.example.local",
		HTTPClient:   ganymedeServer.Client(),
		Sessions:     sessions,
		CookieDomain: ".example.local",
	})

	newAccess, newRefresh, err := oauthHandler.RefreshToken("old-refresh-token")
	if err != nil {
		t.Fatalf("RefreshToken failed: %v", err)
	}

	if newAccess != "new-access-token" {
		t.Errorf("expected new-access-token, got %s", newAccess)
	}
	if newRefresh != "new-refresh-token" {
		t.Errorf("expected new-refresh-token, got %s", newRefresh)
	}
}

func TestIsAPIRequestDistinguishesNavigationFromFetch(t *testing.T) {
	// A redirect is only an answer to something that can follow one. A
	// `fetch()` cannot follow a cross-origin hop to an endpoint with no CORS
	// headers, so answering one with 302 leaves the caller with a network
	// error — which is how JupyterLab came to render its shell and none of its
	// content inside the project.
	cases := []struct {
		name    string
		headers map[string]string
		want    bool
	}{
		{"a page load", map[string]string{"Sec-Fetch-Mode": "navigate", "Accept": "text/html"}, false},
		{"a page load asking for json still navigates",
			map[string]string{"Sec-Fetch-Mode": "navigate", "Accept": "application/json"}, false},
		{"JupyterLab's own fetch, which asks for anything",
			map[string]string{"Sec-Fetch-Mode": "cors", "Accept": "*/*"}, true},
		{"a no-cors subresource", map[string]string{"Sec-Fetch-Mode": "no-cors"}, true},
		{"a same-origin fetch", map[string]string{"Sec-Fetch-Mode": "same-origin"}, true},
		{"a websocket handshake", map[string]string{"Sec-Fetch-Mode": "websocket"}, true},
		{"a client with no fetch metadata, asking for json",
			map[string]string{"Accept": "application/json"}, true},
		{"a client with no fetch metadata, asking for html",
			map[string]string{"Accept": "text/html"}, false},
		{"an old XHR", map[string]string{"X-Requested-With": "XMLHttpRequest", "Accept": "*/*"}, true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/lab/api/workspaces", nil)
			for k, v := range tc.headers {
				r.Header.Set(k, v)
			}
			if got := isAPIRequest(r); got != tc.want {
				t.Fatalf("isAPIRequest = %v, want %v", got, tc.want)
			}
		})
	}
}
