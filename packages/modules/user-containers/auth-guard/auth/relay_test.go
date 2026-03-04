package auth

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"testing"
	"time"
)

func TestGenerateAndValidateRelayToken(t *testing.T) {
	sessions := NewSessionStore(1 * time.Hour)
	defer sessions.Stop()

	oauthHandler := NewOAuthHandler(OAuthConfig{
		GanymedeURL:  "https://ganymede.example.local",
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		BaseFQDN:     "uc-abc.org-xyz.example.local",
		Sessions:     sessions,
		CookieDomain: ".example.local",
	})

	relay := NewRelayHandler("test-secret", sessions, ".example.local", "uc-abc.org-xyz.example.local", oauthHandler)

	session := &Session{
		UserID:      "user-123",
		Username:    "testuser",
		DisplayName: "Test User",
		Permissions: []string{"read", "write"},
	}

	token, err := relay.GenerateRelayToken(session, "myapp.com")
	if err != nil {
		t.Fatalf("GenerateRelayToken failed: %v", err)
	}

	if token == "" {
		t.Fatal("expected non-empty token")
	}

	payload, err := relay.ValidateRelayToken(token, "myapp.com")
	if err != nil {
		t.Fatalf("ValidateRelayToken failed: %v", err)
	}

	if payload.UserID != "user-123" {
		t.Errorf("expected UserID=user-123, got %s", payload.UserID)
	}
	if payload.Username != "testuser" {
		t.Errorf("expected Username=testuser, got %s", payload.Username)
	}
	if payload.DisplayName != "Test User" {
		t.Errorf("expected DisplayName=Test User, got %s", payload.DisplayName)
	}
	if len(payload.Permissions) != 2 {
		t.Errorf("expected 2 permissions, got %d", len(payload.Permissions))
	}
}

func TestRelayTokenExpired(t *testing.T) {
	sessions := NewSessionStore(1 * time.Hour)
	defer sessions.Stop()

	oauthHandler := NewOAuthHandler(OAuthConfig{
		GanymedeURL:  "https://ganymede.example.local",
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		BaseFQDN:     "uc-abc.org-xyz.example.local",
		Sessions:     sessions,
		CookieDomain: ".example.local",
	})

	relay := NewRelayHandler("test-secret", sessions, ".example.local", "uc-abc.org-xyz.example.local", oauthHandler)

	// Create a custom expired token
	expiredPayload := relayTokenPayload{
		UserID:   "user-123",
		Username: "testuser",
		Origin:   "myapp.com",
		Nonce:    "test-nonce-expired",
		Exp:      time.Now().Add(-1 * time.Minute).Unix(), // expired 1 minute ago
	}

	expiredToken := createSignedRelayToken(t, "test-secret", expiredPayload)

	_, err := relay.ValidateRelayToken(expiredToken, "myapp.com")
	if err == nil {
		t.Fatal("expected error for expired token")
	}
}

func TestRelayTokenWrongOrigin(t *testing.T) {
	sessions := NewSessionStore(1 * time.Hour)
	defer sessions.Stop()

	oauthHandler := NewOAuthHandler(OAuthConfig{
		GanymedeURL:  "https://ganymede.example.local",
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		BaseFQDN:     "uc-abc.org-xyz.example.local",
		Sessions:     sessions,
		CookieDomain: ".example.local",
	})

	relay := NewRelayHandler("test-secret", sessions, ".example.local", "uc-abc.org-xyz.example.local", oauthHandler)

	session := &Session{
		UserID:   "user-123",
		Username: "testuser",
	}

	token, err := relay.GenerateRelayToken(session, "myapp.com")
	if err != nil {
		t.Fatalf("GenerateRelayToken failed: %v", err)
	}

	// Validate with wrong origin
	_, err = relay.ValidateRelayToken(token, "evil.com")
	if err == nil {
		t.Fatal("expected error for wrong origin")
	}
}

func TestRelayTokenInvalidSignature(t *testing.T) {
	sessions := NewSessionStore(1 * time.Hour)
	defer sessions.Stop()

	oauthHandler := NewOAuthHandler(OAuthConfig{
		GanymedeURL:  "https://ganymede.example.local",
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		BaseFQDN:     "uc-abc.org-xyz.example.local",
		Sessions:     sessions,
		CookieDomain: ".example.local",
	})

	relay := NewRelayHandler("test-secret", sessions, ".example.local", "uc-abc.org-xyz.example.local", oauthHandler)

	// Create a token with a different secret
	otherRelay := NewRelayHandler("other-secret", sessions, ".example.local", "uc-abc.org-xyz.example.local", oauthHandler)

	session := &Session{
		UserID:   "user-123",
		Username: "testuser",
	}

	token, err := otherRelay.GenerateRelayToken(session, "myapp.com")
	if err != nil {
		t.Fatalf("GenerateRelayToken failed: %v", err)
	}

	// Validate with original relay (different secret)
	_, err = relay.ValidateRelayToken(token, "myapp.com")
	if err == nil {
		t.Fatal("expected error for invalid signature")
	}
}

func TestRelayTokenNonceReuse(t *testing.T) {
	sessions := NewSessionStore(1 * time.Hour)
	defer sessions.Stop()

	oauthHandler := NewOAuthHandler(OAuthConfig{
		GanymedeURL:  "https://ganymede.example.local",
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		BaseFQDN:     "uc-abc.org-xyz.example.local",
		Sessions:     sessions,
		CookieDomain: ".example.local",
	})

	relay := NewRelayHandler("test-secret", sessions, ".example.local", "uc-abc.org-xyz.example.local", oauthHandler)

	session := &Session{
		UserID:   "user-123",
		Username: "testuser",
	}

	token, err := relay.GenerateRelayToken(session, "myapp.com")
	if err != nil {
		t.Fatalf("GenerateRelayToken failed: %v", err)
	}

	// First validation should succeed
	_, err = relay.ValidateRelayToken(token, "myapp.com")
	if err != nil {
		t.Fatalf("first validation failed: %v", err)
	}

	// Second validation of same token should fail (nonce reuse)
	_, err = relay.ValidateRelayToken(token, "myapp.com")
	if err == nil {
		t.Fatal("expected error for nonce reuse")
	}
}

func TestRelayTokenInvalidFormat(t *testing.T) {
	sessions := NewSessionStore(1 * time.Hour)
	defer sessions.Stop()

	oauthHandler := NewOAuthHandler(OAuthConfig{
		GanymedeURL:  "https://ganymede.example.local",
		ClientID:     "test-client",
		ClientSecret: "test-secret",
		BaseFQDN:     "uc-abc.org-xyz.example.local",
		Sessions:     sessions,
		CookieDomain: ".example.local",
	})

	relay := NewRelayHandler("test-secret", sessions, ".example.local", "uc-abc.org-xyz.example.local", oauthHandler)

	_, err := relay.ValidateRelayToken("invalid-token-no-dot", "myapp.com")
	if err == nil {
		t.Fatal("expected error for invalid token format")
	}
}

// createSignedRelayToken creates a relay token manually for testing edge cases.
func createSignedRelayToken(t *testing.T, clientSecret string, payload relayTokenPayload) string {
	t.Helper()

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("failed to marshal payload: %v", err)
	}

	payloadB64 := base64.URLEncoding.EncodeToString(payloadJSON)

	key := deriveRelayKey(clientSecret)
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(payloadB64))
	signature := hex.EncodeToString(mac.Sum(nil))

	return payloadB64 + "." + signature
}
