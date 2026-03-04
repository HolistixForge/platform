package admin

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/holistixforge/auth-guard/proxy"
)

// RegisterRequest is the request body for service registration.
type RegisterRequest struct {
	Name       string `json:"name"`
	Port       int    `json:"port"`
	HealthPath string `json:"health_path"`
}

// RegisterResponse is the response body for service registration.
type RegisterResponse struct {
	Registered bool   `json:"registered"`
	FQDN       string `json:"fqdn"`
}

// ServiceInfo describes a registered service.
type ServiceInfo struct {
	FQDN    string `json:"fqdn"`
	Backend string `json:"backend"`
}

// HealthResponse is the response body for the health endpoint.
type HealthResponse struct {
	Status   string `json:"status"`
	Services int    `json:"services"`
}

// Server is the localhost-only admin API server.
type Server struct {
	router *proxy.Router
	mux    *http.ServeMux
}

// NewServer creates a new admin API server.
func NewServer(router *proxy.Router) *Server {
	s := &Server{
		router: router,
		mux:    http.NewServeMux(),
	}

	s.mux.HandleFunc("/services/register", s.handleRegister)
	s.mux.HandleFunc("/services", s.handleListServices)
	s.mux.HandleFunc("/health", s.handleHealth)

	return s
}

// Handler returns the HTTP handler for the admin API.
func (s *Server) Handler() http.Handler {
	return s.mux
}

// ListenAndServe starts the admin API server on localhost.
func (s *Server) ListenAndServe(port int) error {
	addr := fmt.Sprintf("127.0.0.1:%d", port)
	log.Printf("[admin] listening on %s", addr)
	return http.ListenAndServe(addr, s.mux)
}

func (s *Server) handleRegister(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" || req.Port == 0 {
		http.Error(w, "name and port are required", http.StatusBadRequest)
		return
	}

	fqdn, err := s.router.RegisterService(req.Name, req.Port)
	if err != nil {
		log.Printf("[admin] failed to register service %q: %v", req.Name, err)
		http.Error(w, "Failed to register service", http.StatusInternalServerError)
		return
	}

	log.Printf("[admin] registered service %q on port %d -> %s", req.Name, req.Port, fqdn)

	resp := RegisterResponse{
		Registered: true,
		FQDN:       fqdn,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (s *Server) handleListServices(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	services := s.router.ListServices()

	var result []ServiceInfo
	for fqdn, backend := range services {
		result = append(result, ServiceInfo{
			FQDN:    fqdn,
			Backend: backend,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	services := s.router.ListServices()

	resp := HealthResponse{
		Status:   "ok",
		Services: len(services),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
