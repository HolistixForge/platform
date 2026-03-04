package main

import (
	"context"
	"crypto/tls"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/holistixforge/auth-guard/admin"
	"github.com/holistixforge/auth-guard/auth"
	"github.com/holistixforge/auth-guard/config"
	"github.com/holistixforge/auth-guard/proxy"
)

func main() {
	cfg, err := config.Parse(os.Args[1:])
	if err != nil {
		log.Fatalf("Failed to parse config: %v", err)
	}

	log.Printf("[main] starting auth-guard for container=%s org=%s", cfg.ContainerID, cfg.OrganizationID)
	log.Printf("[main] base FQDN: %s", cfg.BaseFQDN)
	log.Printf("[main] ganymede: %s, gateway: %s", cfg.GanymedeURL, cfg.GatewayURL)

	// Create HTTP client (with optional TLS skip for dev)
	httpClient := &http.Client{
		Timeout: 30 * time.Second,
	}
	if cfg.InsecureSkipVerify {
		httpClient.Transport = &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		}
	}

	// Fetch JWT public key from Ganymede
	log.Printf("[main] fetching JWT public key from %s", cfg.GanymedeURL)
	jwtValidator, err := auth.NewJWTValidator(cfg.GanymedeURL, httpClient, 5)
	if err != nil {
		log.Fatalf("Failed to initialize JWT validator: %v", err)
	}
	log.Printf("[main] JWT public key loaded successfully")

	// Create router
	router := proxy.NewRouter(cfg.BaseFQDN, cfg.Domain)

	// Create session store
	sessions := auth.NewSessionStore(cfg.SessionTTL)
	defer sessions.Stop()

	// Create permission checker
	permChecker := auth.NewPermissionChecker(cfg.GatewayURL, cfg.ContainerID, httpClient, cfg.SessionTTL)

	// Create OAuth handler
	oauthHandler := auth.NewOAuthHandler(auth.OAuthConfig{
		GanymedeURL:  cfg.GanymedeURL,
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		BaseFQDN:     cfg.BaseFQDN,
		HTTPClient:   httpClient,
		Sessions:     sessions,
		CookieDomain: cfg.CookieDomain,
		JWTValidator: jwtValidator,
		PermChecker:  permChecker,
	})

	// Create relay handler
	relayHandler := auth.NewRelayHandler(cfg.ClientSecret, sessions, cfg.CookieDomain, cfg.BaseFQDN, oauthHandler)

	// Create reverse proxy
	reverseProxy := proxy.NewReverseProxy(router, cfg.InsecureSkipVerify)

	// Create auth middleware
	middleware := auth.NewMiddleware(auth.MiddlewareConfig{
		Sessions:      sessions,
		JWTValidator:  jwtValidator,
		PermChecker:   permChecker,
		OAuthHandler:  oauthHandler,
		RelayHandler:  relayHandler,
		Router:        router,
		CustomDomains: cfg.CustomDomains,
		BaseFQDN:      cfg.BaseFQDN,
	})

	// Create the main handler
	mainHandler := middleware.Handler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authInfo := &proxy.AuthInfo{
			UserID:      r.Header.Get("X-Auth-User-Id"),
			Username:    r.Header.Get("X-Auth-User-Name"),
			DisplayName: r.Header.Get("X-Auth-Display-Name"),
		}

		if !reverseProxy.ProxyRequest(w, r, authInfo) {
			http.Error(w, "Service not found", http.StatusNotFound)
		}
	}))

	// Start admin API server
	adminServer := admin.NewServer(router)
	go func() {
		if err := adminServer.ListenAndServe(cfg.AdminPort); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[admin] server error: %v", err)
		}
	}()
	log.Printf("[main] admin API listening on 127.0.0.1:%d", cfg.AdminPort)

	// Start main HTTP server
	mainServer := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.ListenPort),
		Handler:      mainHandler,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("[main] proxy listening on :%d", cfg.ListenPort)
		if err := mainServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[main] server error: %v", err)
		}
	}()

	// Graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	sig := <-sigCh
	log.Printf("[main] received signal %s, shutting down...", sig)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := mainServer.Shutdown(ctx); err != nil {
		log.Printf("[main] graceful shutdown error: %v", err)
	}

	log.Printf("[main] shutdown complete")
}
