package admin

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/holistixforge/auth-guard/proxy"
)

func TestRegisterService(t *testing.T) {
	router := proxy.NewRouter("uc-abc.org-xyz.example.local", "example.local")
	server := NewServer(router)

	body := RegisterRequest{
		Name:       "terminal",
		Port:       7681,
		HealthPath: "/",
	}
	bodyJSON, _ := json.Marshal(body)

	req := httptest.NewRequest("POST", "/services/register", bytes.NewReader(bodyJSON))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var result RegisterResponse
	json.NewDecoder(resp.Body).Decode(&result)

	if !result.Registered {
		t.Error("expected registered=true")
	}
	if result.FQDN != "terminal.uc-abc.org-xyz.example.local" {
		t.Errorf("expected FQDN terminal.uc-abc.org-xyz.example.local, got %s", result.FQDN)
	}

	// Verify the service is routable
	backend, ok := router.GetBackend("terminal.uc-abc.org-xyz.example.local")
	if !ok {
		t.Fatal("expected service to be registered in router")
	}
	if backend.String() != "http://localhost:7681" {
		t.Errorf("expected backend http://localhost:7681, got %s", backend.String())
	}
}

func TestRegisterServiceBadRequest(t *testing.T) {
	router := proxy.NewRouter("uc-abc.org-xyz.example.local", "example.local")
	server := NewServer(router)

	// Missing name
	body := RegisterRequest{
		Port: 7681,
	}
	bodyJSON, _ := json.Marshal(body)

	req := httptest.NewRequest("POST", "/services/register", bytes.NewReader(bodyJSON))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("expected 400 for missing name, got %d", resp.StatusCode)
	}
}

func TestRegisterServiceMethodNotAllowed(t *testing.T) {
	router := proxy.NewRouter("uc-abc.org-xyz.example.local", "example.local")
	server := NewServer(router)

	req := httptest.NewRequest("GET", "/services/register", nil)
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("expected 405, got %d", resp.StatusCode)
	}
}

func TestListServices(t *testing.T) {
	router := proxy.NewRouter("uc-abc.org-xyz.example.local", "example.local")
	router.RegisterService("terminal", 7681)
	router.RegisterService("code-server", 8080)

	server := NewServer(router)

	req := httptest.NewRequest("GET", "/services", nil)
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var services []ServiceInfo
	json.NewDecoder(resp.Body).Decode(&services)

	if len(services) != 2 {
		t.Errorf("expected 2 services, got %d", len(services))
	}
}

func TestListServicesEmpty(t *testing.T) {
	router := proxy.NewRouter("uc-abc.org-xyz.example.local", "example.local")
	server := NewServer(router)

	req := httptest.NewRequest("GET", "/services", nil)
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}
}

func TestHealthCheck(t *testing.T) {
	router := proxy.NewRouter("uc-abc.org-xyz.example.local", "example.local")
	router.RegisterService("terminal", 7681)

	server := NewServer(router)

	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var health HealthResponse
	json.NewDecoder(resp.Body).Decode(&health)

	if health.Status != "ok" {
		t.Errorf("expected status=ok, got %s", health.Status)
	}
	if health.Services != 1 {
		t.Errorf("expected services=1, got %d", health.Services)
	}
}

func TestHealthCheckNoServices(t *testing.T) {
	router := proxy.NewRouter("uc-abc.org-xyz.example.local", "example.local")
	server := NewServer(router)

	req := httptest.NewRequest("GET", "/health", nil)
	w := httptest.NewRecorder()

	server.Handler().ServeHTTP(w, req)

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var health HealthResponse
	json.NewDecoder(resp.Body).Decode(&health)

	if health.Status != "ok" {
		t.Errorf("expected status=ok, got %s", health.Status)
	}
	if health.Services != 0 {
		t.Errorf("expected services=0, got %d", health.Services)
	}
}
