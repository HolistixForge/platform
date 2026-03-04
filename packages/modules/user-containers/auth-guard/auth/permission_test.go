package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"
)

func TestCheckAccessAllowed(t *testing.T) {
	gatewayServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify authorization header
		auth := r.Header.Get("Authorization")
		if auth != "Bearer test-jwt" {
			t.Errorf("expected Authorization: Bearer test-jwt, got %s", auth)
		}

		resp := verifyAccessResponse{
			Allowed:     true,
			UserID:      "user-123",
			Username:    "testuser",
			DisplayName: "Test User",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer gatewayServer.Close()

	checker := NewPermissionChecker(gatewayServer.URL, "container-abc", gatewayServer.Client(), 1*time.Hour)

	allowed, user, err := checker.CheckAccess("test-jwt")
	if err != nil {
		t.Fatalf("CheckAccess failed: %v", err)
	}

	if !allowed {
		t.Error("expected allowed=true")
	}
	if user.UserID != "user-123" {
		t.Errorf("expected UserID=user-123, got %s", user.UserID)
	}
	if user.Username != "testuser" {
		t.Errorf("expected Username=testuser, got %s", user.Username)
	}
}

func TestCheckAccessDenied(t *testing.T) {
	gatewayServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	defer gatewayServer.Close()

	checker := NewPermissionChecker(gatewayServer.URL, "container-abc", gatewayServer.Client(), 1*time.Hour)

	allowed, _, err := checker.CheckAccess("test-jwt")
	if err != nil {
		t.Fatalf("CheckAccess failed: %v", err)
	}

	if allowed {
		t.Error("expected allowed=false for forbidden response")
	}
}

func TestCheckAccessCached(t *testing.T) {
	var callCount int64

	gatewayServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt64(&callCount, 1)
		resp := verifyAccessResponse{
			Allowed:  true,
			UserID:   "user-123",
			Username: "testuser",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer gatewayServer.Close()

	checker := NewPermissionChecker(gatewayServer.URL, "container-abc", gatewayServer.Client(), 1*time.Hour)

	// First call - should hit gateway
	allowed, _, err := checker.CheckAccessCached("user-123", "test-jwt")
	if err != nil {
		t.Fatalf("first CheckAccessCached failed: %v", err)
	}
	if !allowed {
		t.Error("expected allowed=true")
	}

	// Second call - should use cache
	allowed, _, err = checker.CheckAccessCached("user-123", "test-jwt")
	if err != nil {
		t.Fatalf("second CheckAccessCached failed: %v", err)
	}
	if !allowed {
		t.Error("expected allowed=true from cache")
	}

	// Only one gateway call should have been made
	if count := atomic.LoadInt64(&callCount); count != 1 {
		t.Errorf("expected 1 gateway call, got %d", count)
	}
}

func TestCheckAccessCacheMiss(t *testing.T) {
	var callCount int64

	// Gateway returns user_id based on the JWT to simulate different users
	gatewayServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt64(&callCount, 1)
		auth := r.Header.Get("Authorization")
		var resp verifyAccessResponse
		if auth == "Bearer jwt-1" {
			resp = verifyAccessResponse{Allowed: true, UserID: "user-123", Username: "testuser"}
		} else {
			resp = verifyAccessResponse{Allowed: true, UserID: "user-456", Username: "otheruser"}
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer gatewayServer.Close()

	checker := NewPermissionChecker(gatewayServer.URL, "container-abc", gatewayServer.Client(), 1*time.Hour)

	// Different user IDs should cause cache misses
	checker.CheckAccessCached("user-123", "jwt-1")
	checker.CheckAccessCached("user-456", "jwt-2")

	if count := atomic.LoadInt64(&callCount); count != 2 {
		t.Errorf("expected 2 gateway calls for different users, got %d", count)
	}
}

func TestCheckAccessCacheExpiry(t *testing.T) {
	var callCount int64

	gatewayServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt64(&callCount, 1)
		resp := verifyAccessResponse{
			Allowed:  true,
			UserID:   "user-123",
			Username: "testuser",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer gatewayServer.Close()

	// Very short cache TTL
	checker := NewPermissionChecker(gatewayServer.URL, "container-abc", gatewayServer.Client(), 1*time.Millisecond)

	// First call
	checker.CheckAccessCached("user-123", "test-jwt")

	// Wait for cache to expire
	time.Sleep(10 * time.Millisecond)

	// Second call should hit gateway again
	checker.CheckAccessCached("user-123", "test-jwt")

	if count := atomic.LoadInt64(&callCount); count != 2 {
		t.Errorf("expected 2 gateway calls after cache expiry, got %d", count)
	}
}

func TestInvalidateCache(t *testing.T) {
	var callCount int64

	gatewayServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt64(&callCount, 1)
		resp := verifyAccessResponse{
			Allowed:  true,
			UserID:   "user-123",
			Username: "testuser",
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	}))
	defer gatewayServer.Close()

	checker := NewPermissionChecker(gatewayServer.URL, "container-abc", gatewayServer.Client(), 1*time.Hour)

	// First call - populates cache
	checker.CheckAccessCached("user-123", "test-jwt")

	// Invalidate cache
	checker.InvalidateCache("user-123")

	// Next call should hit gateway again
	checker.CheckAccessCached("user-123", "test-jwt")

	if count := atomic.LoadInt64(&callCount); count != 2 {
		t.Errorf("expected 2 gateway calls after cache invalidation, got %d", count)
	}
}

func TestCheckAccessGatewayError(t *testing.T) {
	gatewayServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("internal error"))
	}))
	defer gatewayServer.Close()

	checker := NewPermissionChecker(gatewayServer.URL, "container-abc", gatewayServer.Client(), 1*time.Hour)

	_, _, err := checker.CheckAccess("test-jwt")
	if err == nil {
		t.Fatal("expected error for 500 gateway response")
	}
}
