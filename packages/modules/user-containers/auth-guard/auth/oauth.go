package auth

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
)

// OAuthHandler manages the OAuth 2.0 flow with Ganymede.
type OAuthHandler struct {
	ganymedeURL  string
	clientID     string
	clientSecret string
	baseFQDN     string
	httpClient   *http.Client
	sessions     *SessionStore
	cookieDomain string
	jwtValidator *JWTValidator
	permChecker  *PermissionChecker
}

// OAuthConfig holds configuration for the OAuth handler.
type OAuthConfig struct {
	GanymedeURL  string
	ClientID     string
	ClientSecret string
	BaseFQDN     string
	HTTPClient   *http.Client
	Sessions     *SessionStore
	CookieDomain string
	JWTValidator *JWTValidator
	PermChecker  *PermissionChecker
}

// oauthState represents the OAuth state parameter.
type oauthState struct {
	OriginalURL string `json:"original_url"`
	CSRFToken   string `json:"csrf_token"`
}

// tokenResponse represents the response from the token exchange endpoint.
type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
}

// NewOAuthHandler creates a new OAuthHandler.
func NewOAuthHandler(cfg OAuthConfig) *OAuthHandler {
	return &OAuthHandler{
		ganymedeURL:  cfg.GanymedeURL,
		clientID:     cfg.ClientID,
		clientSecret: cfg.ClientSecret,
		baseFQDN:     cfg.BaseFQDN,
		httpClient:   cfg.HTTPClient,
		sessions:     cfg.Sessions,
		cookieDomain: cfg.CookieDomain,
		jwtValidator: cfg.JWTValidator,
		permChecker:  cfg.PermChecker,
	}
}

// RedirectToAuth redirects the user to Ganymede's OAuth authorization endpoint.
func (o *OAuthHandler) RedirectToAuth(w http.ResponseWriter, r *http.Request, originalURL string) {
	csrfToken := generateCSRFToken()

	state := oauthState{
		OriginalURL: originalURL,
		CSRFToken:   csrfToken,
	}

	stateJSON, err := json.Marshal(state)
	if err != nil {
		log.Printf("[oauth] failed to marshal state: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	stateEncoded := base64.URLEncoding.EncodeToString(stateJSON)

	redirectURI := fmt.Sprintf("https://%s/__auth/callback", o.baseFQDN)

	params := url.Values{
		"client_id":     {o.clientID},
		"redirect_uri":  {redirectURI},
		"response_type": {"code"},
		"state":         {stateEncoded},
	}

	authURL := fmt.Sprintf("%s/oauth/authorize?%s", o.ganymedeURL, params.Encode())
	http.Redirect(w, r, authURL, http.StatusFound)
}

// HandleCallback handles the OAuth callback after user authorization.
func (o *OAuthHandler) HandleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	stateParam := r.URL.Query().Get("state")

	if code == "" {
		http.Error(w, "Missing authorization code", http.StatusBadRequest)
		return
	}

	// Decode and parse state
	stateJSON, err := base64.URLEncoding.DecodeString(stateParam)
	if err != nil {
		http.Error(w, "Invalid state parameter", http.StatusBadRequest)
		return
	}

	var state oauthState
	if err := json.Unmarshal(stateJSON, &state); err != nil {
		http.Error(w, "Invalid state parameter", http.StatusBadRequest)
		return
	}

	// Exchange code for tokens
	accessToken, refreshToken, err := o.ExchangeCode(code)
	if err != nil {
		log.Printf("[oauth] token exchange failed: %v", err)
		http.Error(w, "Authentication failed", http.StatusInternalServerError)
		return
	}

	// Validate the access token to get user info
	claims, err := o.jwtValidator.Validate(accessToken)
	if err != nil {
		log.Printf("[oauth] token validation failed: %v", err)
		http.Error(w, "Authentication failed", http.StatusInternalServerError)
		return
	}

	// Check permissions via gateway
	if o.permChecker != nil {
		allowed, _, err := o.permChecker.CheckAccess(accessToken)
		if err != nil {
			log.Printf("[oauth] permission check failed: %v", err)
			http.Error(w, "Permission check failed", http.StatusInternalServerError)
			return
		}
		if !allowed {
			http.Error(w, "Access denied", http.StatusForbidden)
			return
		}
	}

	// Create session
	sessionID := o.sessions.Create(
		claims.UserID,
		claims.Username,
		claims.DisplayName,
		accessToken,
		refreshToken,
		nil, // permissions
		o.baseFQDN,
	)

	// Set session cookie
	o.sessions.SetSessionCookie(w, sessionID, o.cookieDomain)

	// Redirect to original URL
	redirectURL := state.OriginalURL
	if redirectURL == "" {
		redirectURL = fmt.Sprintf("https://%s/", o.baseFQDN)
	}

	http.Redirect(w, r, redirectURL, http.StatusFound)
}

// ExchangeCode exchanges an authorization code for access and refresh tokens.
func (o *OAuthHandler) ExchangeCode(code string) (accessToken, refreshToken string, err error) {
	redirectURI := fmt.Sprintf("https://%s/__auth/callback", o.baseFQDN)

	data := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {redirectURI},
		"client_id":     {o.clientID},
		"client_secret": {o.clientSecret},
	}

	resp, err := o.httpClient.PostForm(o.ganymedeURL+"/oauth/token", data)
	if err != nil {
		return "", "", fmt.Errorf("token request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", fmt.Errorf("failed to read token response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("token exchange failed with status %d: %s", resp.StatusCode, string(body))
	}

	var tokenResp tokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", "", fmt.Errorf("failed to parse token response: %w", err)
	}

	return tokenResp.AccessToken, tokenResp.RefreshToken, nil
}

// RefreshToken refreshes an access token using a refresh token.
func (o *OAuthHandler) RefreshToken(refreshToken string) (newAccessToken, newRefreshToken string, err error) {
	data := url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {refreshToken},
		"client_id":     {o.clientID},
		"client_secret": {o.clientSecret},
	}

	resp, err := o.httpClient.PostForm(o.ganymedeURL+"/oauth/token", data)
	if err != nil {
		return "", "", fmt.Errorf("refresh request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", fmt.Errorf("failed to read refresh response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("refresh failed with status %d: %s", resp.StatusCode, string(body))
	}

	var tokenResp tokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", "", fmt.Errorf("failed to parse refresh response: %w", err)
	}

	return tokenResp.AccessToken, tokenResp.RefreshToken, nil
}

// CallbackPath returns the path used for OAuth callbacks.
func (o *OAuthHandler) CallbackPath() string {
	return "/__auth/callback"
}

// generateCSRFToken generates a random CSRF token.
func generateCSRFToken() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic("failed to generate CSRF token: " + err.Error())
	}
	return hex.EncodeToString(b)
}

// isAPIRequest checks if the request expects a JSON response (API client).
func isAPIRequest(r *http.Request) bool {
	accept := r.Header.Get("Accept")
	return strings.Contains(accept, "application/json")
}
