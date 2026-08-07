package proxy

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
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

func TestProxyDropsTheServicesOwnCorsAnswer(t *testing.T) {
	// The guard writes its own CORS headers before this proxy copies the
	// upstream ones, and a browser refuses a header with two values. JupyterLab
	// runs with `--ServerApp.allow_origin='*'`, so the pair reached the browser
	// as `https://platform, *` and every call from the platform's page failed.
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`[]`))
	}))
	defer upstream.Close()

	router := NewRouter("uc-x.org-y.apollo.test", "apollo.test")
	port, _ := strconv.Atoi(strings.Split(upstream.URL, ":")[2])
	if _, err := router.RegisterService("jupyterlab", port); err != nil {
		t.Fatal(err)
	}

	rp := NewReverseProxy(router, false)
	r := httptest.NewRequest("GET", "http://jupyterlab.uc-x.org-y.apollo.test/api/kernels", nil)
	r.Host = "jupyterlab.uc-x.org-y.apollo.test"
	w := httptest.NewRecorder()
	// What the guard would already have written.
	w.Header().Set("Access-Control-Allow-Origin", "https://apollo.test:8443")

	if !rp.ProxyRequest(w, r, nil) {
		t.Fatal("no backend found")
	}

	got := w.Result().Header.Values("Access-Control-Allow-Origin")
	if len(got) != 1 || got[0] != "https://apollo.test:8443" {
		t.Fatalf("Access-Control-Allow-Origin = %v, want only the guard's", got)
	}
	if v := w.Result().Header.Get("Content-Type"); v != "application/json" {
		t.Fatalf("an ordinary header was lost: Content-Type = %q", v)
	}
}
