package proxy

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestProxyRequestForwardsToBackend(t *testing.T) {
	// Create a mock backend server
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify auth headers are set
		if r.Header.Get("X-Auth-User-Id") != "user-123" {
			t.Errorf("expected X-Auth-User-Id=user-123, got %s", r.Header.Get("X-Auth-User-Id"))
		}
		if r.Header.Get("X-Auth-User-Name") != "testuser" {
			t.Errorf("expected X-Auth-User-Name=testuser, got %s", r.Header.Get("X-Auth-User-Name"))
		}
		if r.Header.Get("X-Auth-Display-Name") != "Test User" {
			t.Errorf("expected X-Auth-Display-Name=Test User, got %s", r.Header.Get("X-Auth-Display-Name"))
		}
		if r.Header.Get("X-Auth-Verified") != "true" {
			t.Errorf("expected X-Auth-Verified=true, got %s", r.Header.Get("X-Auth-Verified"))
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("backend response"))
	}))
	defer backend.Close()

	router := NewRouter("uc-abc.org-xyz.example.local", "example.local")

	// Register the backend directly using its URL
	backendURL, _ := url.Parse(backend.URL)
	router.mu.Lock()
	router.backends["terminal.uc-abc.org-xyz.example.local"] = backendURL
	router.mu.Unlock()

	rp := NewReverseProxy(router, false)

	// Create request
	req := httptest.NewRequest("GET", "http://terminal.uc-abc.org-xyz.example.local/", nil)
	req.Host = "terminal.uc-abc.org-xyz.example.local"
	w := httptest.NewRecorder()

	authInfo := &AuthInfo{
		UserID:      "user-123",
		Username:    "testuser",
		DisplayName: "Test User",
	}

	ok := rp.ProxyRequest(w, req, authInfo)
	if !ok {
		t.Fatal("expected proxy request to succeed")
	}

	resp := w.Result()
	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status 200, got %d", resp.StatusCode)
	}
	if string(body) != "backend response" {
		t.Errorf("expected 'backend response', got %q", string(body))
	}
}

func TestProxyRequestUnknownHost(t *testing.T) {
	router := NewRouter("uc-abc.org-xyz.example.local", "example.local")
	rp := NewReverseProxy(router, false)

	req := httptest.NewRequest("GET", "http://unknown.example.local/", nil)
	req.Host = "unknown.example.local"
	w := httptest.NewRecorder()

	ok := rp.ProxyRequest(w, req, nil)
	if ok {
		t.Error("expected proxy request to return false for unknown host")
	}
}

func TestProxyRequestBackendDown(t *testing.T) {
	router := NewRouter("uc-abc.org-xyz.example.local", "example.local")

	// Register a backend on a port that's not listening
	backendURL, _ := url.Parse("http://localhost:19999")
	router.mu.Lock()
	router.backends["terminal.uc-abc.org-xyz.example.local"] = backendURL
	router.mu.Unlock()

	rp := NewReverseProxy(router, false)

	req := httptest.NewRequest("GET", "http://terminal.uc-abc.org-xyz.example.local/", nil)
	req.Host = "terminal.uc-abc.org-xyz.example.local"
	w := httptest.NewRecorder()

	ok := rp.ProxyRequest(w, req, &AuthInfo{UserID: "user-123"})
	if !ok {
		t.Fatal("expected proxy request to find the backend (even if down)")
	}

	resp := w.Result()
	if resp.StatusCode != http.StatusBadGateway {
		t.Errorf("expected status 502, got %d", resp.StatusCode)
	}
}

func TestProxyRequestDetectsWebSocket(t *testing.T) {
	// Create a mock backend
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// For this test, just verify the request arrives
		// The reverse proxy will forward the upgrade headers
		w.WriteHeader(http.StatusOK)
	}))
	defer backend.Close()

	router := NewRouter("uc-abc.org-xyz.example.local", "example.local")
	backendURL, _ := url.Parse(backend.URL)
	router.mu.Lock()
	router.backends["terminal.uc-abc.org-xyz.example.local"] = backendURL
	router.mu.Unlock()

	rp := NewReverseProxy(router, false)

	req := httptest.NewRequest("GET", "http://terminal.uc-abc.org-xyz.example.local/ws", nil)
	req.Host = "terminal.uc-abc.org-xyz.example.local"
	req.Header.Set("Connection", "Upgrade")
	req.Header.Set("Upgrade", "websocket")
	w := httptest.NewRecorder()

	ok := rp.ProxyRequest(w, req, &AuthInfo{UserID: "user-123"})
	if !ok {
		t.Fatal("expected proxy request to succeed for WebSocket")
	}
}
