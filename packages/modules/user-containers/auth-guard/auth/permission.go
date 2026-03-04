package auth

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"sync"
	"time"
)

// UserInfo holds user information returned from a permission check.
type UserInfo struct {
	UserID      string `json:"user_id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
	Allowed     bool   `json:"allowed"`
}

// permCacheEntry is a cached permission check result.
type permCacheEntry struct {
	allowed   bool
	user      UserInfo
	expiresAt time.Time
}

// PermissionChecker checks access permissions via the gateway.
type PermissionChecker struct {
	gatewayURL  string
	containerID string
	httpClient  *http.Client
	cacheTTL    time.Duration

	mu    sync.RWMutex
	cache map[string]*permCacheEntry // key: user_id
}

// verifyAccessResponse is the response from the gateway verify-access endpoint.
type verifyAccessResponse struct {
	Allowed     bool   `json:"allowed"`
	UserID      string `json:"user_id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
}

// NewPermissionChecker creates a new PermissionChecker.
func NewPermissionChecker(gatewayURL, containerID string, httpClient *http.Client, cacheTTL time.Duration) *PermissionChecker {
	return &PermissionChecker{
		gatewayURL:  gatewayURL,
		containerID: containerID,
		httpClient:  httpClient,
		cacheTTL:    cacheTTL,
		cache:       make(map[string]*permCacheEntry),
	}
}

// CheckAccess checks if the bearer token has access to the container.
// Results are cached by user_id.
func (p *PermissionChecker) CheckAccess(jwt string) (allowed bool, user UserInfo, err error) {
	// First, try to extract user_id from JWT to check cache
	// We'll check the cache after the gateway call if needed
	result, err := p.callGateway(jwt)
	if err != nil {
		// Check cache on error for the JWT (we can't extract user_id without parsing)
		return false, UserInfo{}, err
	}

	user = UserInfo{
		UserID:      result.UserID,
		Username:    result.Username,
		DisplayName: result.DisplayName,
		Allowed:     result.Allowed,
	}

	// Cache the result
	p.mu.Lock()
	p.cache[result.UserID] = &permCacheEntry{
		allowed:   result.Allowed,
		user:      user,
		expiresAt: time.Now().Add(p.cacheTTL),
	}
	p.mu.Unlock()

	return result.Allowed, user, nil
}

// CheckAccessCached checks if the user has cached access permission.
// Returns the cached result if available, otherwise calls the gateway.
func (p *PermissionChecker) CheckAccessCached(userID, jwt string) (allowed bool, user UserInfo, err error) {
	// Check cache first
	p.mu.RLock()
	entry, ok := p.cache[userID]
	p.mu.RUnlock()

	if ok && time.Now().Before(entry.expiresAt) {
		return entry.allowed, entry.user, nil
	}

	// Cache miss or expired, call gateway
	return p.CheckAccess(jwt)
}

// InvalidateCache removes the cached entry for a user.
func (p *PermissionChecker) InvalidateCache(userID string) {
	p.mu.Lock()
	delete(p.cache, userID)
	p.mu.Unlock()
}

// callGateway makes the actual HTTP call to the gateway's verify-access endpoint.
func (p *PermissionChecker) callGateway(jwt string) (*verifyAccessResponse, error) {
	url := fmt.Sprintf("%s/containers/%s/verify-access", p.gatewayURL, p.containerID)

	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+jwt)
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("gateway request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read gateway response: %w", err)
	}

	if resp.StatusCode == http.StatusForbidden {
		return &verifyAccessResponse{Allowed: false}, nil
	}

	if resp.StatusCode != http.StatusOK {
		log.Printf("[permission] gateway returned status %d: %s", resp.StatusCode, string(body))
		return nil, fmt.Errorf("gateway returned status %d", resp.StatusCode)
	}

	var result verifyAccessResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse gateway response: %w", err)
	}

	return &result, nil
}
