package proxy

import (
	"testing"
)

func TestRegisterService(t *testing.T) {
	r := NewRouter("uc-abc.org-xyz.example.local", "example.local")

	fqdn, err := r.RegisterService("terminal", 7681)
	if err != nil {
		t.Fatalf("RegisterService failed: %v", err)
	}

	expected := "terminal.uc-abc.org-xyz.example.local"
	if fqdn != expected {
		t.Errorf("expected FQDN %q, got %q", expected, fqdn)
	}
}

func TestGetBackend(t *testing.T) {
	r := NewRouter("uc-abc.org-xyz.example.local", "example.local")

	_, err := r.RegisterService("terminal", 7681)
	if err != nil {
		t.Fatalf("RegisterService failed: %v", err)
	}

	// Lookup by exact FQDN
	backend, ok := r.GetBackend("terminal.uc-abc.org-xyz.example.local")
	if !ok {
		t.Fatal("expected backend to be found")
	}
	if backend.String() != "http://localhost:7681" {
		t.Errorf("expected backend http://localhost:7681, got %s", backend.String())
	}

	// Lookup by FQDN with port
	backend, ok = r.GetBackend("terminal.uc-abc.org-xyz.example.local:8443")
	if !ok {
		t.Fatal("expected backend to be found with port in host")
	}
	if backend.String() != "http://localhost:7681" {
		t.Errorf("expected backend http://localhost:7681, got %s", backend.String())
	}
}

func TestGetBackendUnregistered(t *testing.T) {
	r := NewRouter("uc-abc.org-xyz.example.local", "example.local")

	_, ok := r.GetBackend("unknown.uc-abc.org-xyz.example.local")
	if ok {
		t.Error("expected no backend for unregistered host")
	}
}

func TestIsBaseFQDN(t *testing.T) {
	r := NewRouter("uc-abc.org-xyz.example.local", "example.local")

	if !r.IsBaseFQDN("uc-abc.org-xyz.example.local") {
		t.Error("expected IsBaseFQDN to return true for base FQDN")
	}

	if !r.IsBaseFQDN("uc-abc.org-xyz.example.local:8443") {
		t.Error("expected IsBaseFQDN to return true for base FQDN with port")
	}

	if r.IsBaseFQDN("terminal.uc-abc.org-xyz.example.local") {
		t.Error("expected IsBaseFQDN to return false for service FQDN")
	}
}

func TestIsCustomDomain(t *testing.T) {
	r := NewRouter("uc-abc.org-xyz.example.local", "example.local")
	customDomains := []string{"myapp.com", "app.example.org"}

	if !r.IsCustomDomain("myapp.com", customDomains) {
		t.Error("expected IsCustomDomain to return true for custom domain")
	}

	if !r.IsCustomDomain("myapp.com:443", customDomains) {
		t.Error("expected IsCustomDomain to return true for custom domain with port")
	}

	if r.IsCustomDomain("other.com", customDomains) {
		t.Error("expected IsCustomDomain to return false for non-custom domain")
	}
}

func TestListServices(t *testing.T) {
	r := NewRouter("uc-abc.org-xyz.example.local", "example.local")

	r.RegisterService("terminal", 7681)
	r.RegisterService("code-server", 8080)

	services := r.ListServices()
	if len(services) != 2 {
		t.Errorf("expected 2 services, got %d", len(services))
	}

	termFQDN := "terminal.uc-abc.org-xyz.example.local"
	codeFQDN := "code-server.uc-abc.org-xyz.example.local"

	if services[termFQDN] != "http://localhost:7681" {
		t.Errorf("expected terminal backend http://localhost:7681, got %s", services[termFQDN])
	}
	if services[codeFQDN] != "http://localhost:8080" {
		t.Errorf("expected code-server backend http://localhost:8080, got %s", services[codeFQDN])
	}
}

func TestRegisterMultipleServices(t *testing.T) {
	r := NewRouter("uc-abc.org-xyz.example.local", "example.local")

	fqdn1, _ := r.RegisterService("svc1", 3000)
	fqdn2, _ := r.RegisterService("svc2", 3001)

	if fqdn1 == fqdn2 {
		t.Error("expected different FQDNs for different services")
	}

	// Both should be routable
	_, ok1 := r.GetBackend(fqdn1)
	_, ok2 := r.GetBackend(fqdn2)

	if !ok1 || !ok2 {
		t.Error("expected both services to be routable")
	}
}
