package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const (
	// RelayTokenExpiry is the lifetime of a relay token.
	RelayTokenExpiry = 30 * time.Second
	// RelayTokenClockSkew is the allowed clock skew for relay token validation.
	RelayTokenClockSkew = 5 * time.Second
)

// relayTokenPayload is the payload of a relay token.
type relayTokenPayload struct {
	UserID      string   `json:"user_id"`
	Username    string   `json:"username"`
	DisplayName string   `json:"display_name"`
	Permissions []string `json:"permissions"`
	Origin      string   `json:"origin"`
	Nonce       string   `json:"nonce"`
	Exp         int64    `json:"exp"`
}

// RelayHandler manages cross-domain token relay for custom domains.
type RelayHandler struct {
	clientSecret string
	sessions     *SessionStore
	cookieDomain string
	baseFQDN     string
	portSuffix   string
	oauthHandler *OAuthHandler

	// Nonce tracking to prevent replay attacks
	mu         sync.Mutex
	usedNonces map[string]time.Time
}

// NewRelayHandler creates a new RelayHandler.
func NewRelayHandler(clientSecret string, sessions *SessionStore, cookieDomain, baseFQDN, portSuffix string, oauthHandler *OAuthHandler) *RelayHandler {
	r := &RelayHandler{
		clientSecret: clientSecret,
		sessions:     sessions,
		cookieDomain: cookieDomain,
		baseFQDN:     baseFQDN,
		portSuffix:   portSuffix,
		oauthHandler: oauthHandler,
		usedNonces:   make(map[string]time.Time),
	}
	go r.cleanupNonces()
	return r
}

// GenerateRelayToken creates a signed relay token for cross-domain authentication.
func (r *RelayHandler) GenerateRelayToken(session *Session, targetDomain string) (string, error) {
	nonce, err := generateNonce()
	if err != nil {
		return "", fmt.Errorf("failed to generate nonce: %w", err)
	}

	payload := relayTokenPayload{
		UserID:      session.UserID,
		Username:    session.Username,
		DisplayName: session.DisplayName,
		Permissions: session.Permissions,
		Origin:      targetDomain,
		Nonce:       nonce,
		Exp:         time.Now().Add(RelayTokenExpiry).Unix(),
	}

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal payload: %w", err)
	}

	payloadB64 := base64.URLEncoding.EncodeToString(payloadJSON)

	// Sign with HMAC-SHA256 using derived key
	key := deriveRelayKey(r.clientSecret)
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(payloadB64))
	signature := hex.EncodeToString(mac.Sum(nil))

	return payloadB64 + "." + signature, nil
}

// ValidateRelayToken validates a relay token and returns a session if valid.
func (r *RelayHandler) ValidateRelayToken(token, expectedOrigin string) (*relayTokenPayload, error) {
	parts := strings.SplitN(token, ".", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid token format")
	}

	payloadB64 := parts[0]
	signatureHex := parts[1]

	// Verify signature
	key := deriveRelayKey(r.clientSecret)
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(payloadB64))
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(signatureHex), []byte(expectedSig)) {
		return nil, fmt.Errorf("invalid signature")
	}

	// Decode payload
	payloadJSON, err := base64.URLEncoding.DecodeString(payloadB64)
	if err != nil {
		return nil, fmt.Errorf("invalid payload encoding: %w", err)
	}

	var payload relayTokenPayload
	if err := json.Unmarshal(payloadJSON, &payload); err != nil {
		return nil, fmt.Errorf("invalid payload: %w", err)
	}

	// Check expiration with clock skew
	now := time.Now()
	expTime := time.Unix(payload.Exp, 0).Add(RelayTokenClockSkew)
	if now.After(expTime) {
		return nil, fmt.Errorf("token expired")
	}

	// Check origin
	if payload.Origin != expectedOrigin {
		return nil, fmt.Errorf("origin mismatch: expected %s, got %s", expectedOrigin, payload.Origin)
	}

	// Check nonce not reused
	r.mu.Lock()
	if _, used := r.usedNonces[payload.Nonce]; used {
		r.mu.Unlock()
		return nil, fmt.Errorf("nonce already used")
	}
	r.usedNonces[payload.Nonce] = now
	r.mu.Unlock()

	return &payload, nil
}

// HandleCrossDomainLogin handles the /__auth/cross-domain-login endpoint.
// Query params: origin (the custom domain), return_to (URL to redirect after auth).
func (r *RelayHandler) HandleCrossDomainLogin(w http.ResponseWriter, req *http.Request) {
	origin := req.URL.Query().Get("origin")
	returnTo := req.URL.Query().Get("return_to")

	if origin == "" {
		http.Error(w, "Missing origin parameter", http.StatusBadRequest)
		return
	}

	// Check if user has a platform session
	session := r.sessions.GetSessionFromRequest(req)
	if session != nil {
		// Generate relay token and redirect to custom domain
		token, err := r.GenerateRelayToken(session, origin)
		if err != nil {
			log.Printf("[relay] failed to generate relay token: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		relayURL := fmt.Sprintf("https://%s/__auth/relay?token=%s&return_to=%s",
			origin,
			url.QueryEscape(token),
			url.QueryEscape(returnTo),
		)
		http.Redirect(w, req, relayURL, http.StatusFound)
		return
	}

	// No platform session, redirect to OAuth first
	// After OAuth completes, it will redirect back here
	crossDomainURL := fmt.Sprintf("%s/__auth/cross-domain-login?origin=%s&return_to=%s",
		guardOrigin(r.baseFQDN, r.portSuffix),
		url.QueryEscape(origin),
		url.QueryEscape(returnTo),
	)
	r.oauthHandler.RedirectToAuth(w, req, crossDomainURL)
}

// HandleRelay handles the /__auth/relay endpoint on the custom domain.
// Query params: token (relay token), return_to (final redirect URL).
func (r *RelayHandler) HandleRelay(w http.ResponseWriter, req *http.Request) {
	token := req.URL.Query().Get("token")
	returnTo := req.URL.Query().Get("return_to")

	if token == "" {
		http.Error(w, "Missing token parameter", http.StatusBadRequest)
		return
	}

	// Extract the host as the expected origin
	host := req.Host
	if idx := strings.LastIndex(host, ":"); idx != -1 {
		if !strings.Contains(host[idx:], "]") {
			host = host[:idx]
		}
	}

	payload, err := r.ValidateRelayToken(token, host)
	if err != nil {
		log.Printf("[relay] token validation failed: %v", err)
		http.Error(w, "Invalid relay token", http.StatusUnauthorized)
		return
	}

	// Create session on the custom domain
	sessionID := r.sessions.Create(
		payload.UserID,
		payload.Username,
		payload.DisplayName,
		"", // no access token for relay sessions
		"", // no refresh token for relay sessions
		payload.Permissions,
		host,
	)

	// Set session cookie for the custom domain
	r.sessions.SetSessionCookie(w, sessionID, host)

	// Redirect to return_to or root
	if returnTo == "" {
		returnTo = "/"
	}
	http.Redirect(w, req, returnTo, http.StatusFound)
}

// Stop stops the nonce cleanup goroutine.
func (r *RelayHandler) Stop() {
	// The cleanup goroutine will stop when the process exits
}

// deriveRelayKey derives a signing key from the client secret.
func deriveRelayKey(clientSecret string) []byte {
	mac := hmac.New(sha256.New, []byte(clientSecret))
	mac.Write([]byte("relay-token-key"))
	return mac.Sum(nil)
}

// generateNonce generates a random nonce for relay tokens.
func generateNonce() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// cleanupNonces periodically removes expired nonces.
func (r *RelayHandler) cleanupNonces() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		cutoff := time.Now().Add(-(RelayTokenExpiry + RelayTokenClockSkew))
		r.mu.Lock()
		for nonce, usedAt := range r.usedNonces {
			if usedAt.Before(cutoff) {
				delete(r.usedNonces, nonce)
			}
		}
		r.mu.Unlock()
	}
}
