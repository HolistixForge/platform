package auth

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"sync"
	"time"
)

const (
	// SessionCookieName is the base name of the session cookie.
	//
	// The container id is appended to it — see `sessionCookieName`. Every guard
	// keeps its sessions in its own memory while the cookie is scoped to the
	// whole platform domain, so one shared name means one container's guard
	// receives another's session id, finds nothing, and refuses the request.
	//
	// Two notebooks opened at once in a project is enough to see it: both
	// frames load together, both guards run an OAuth flow, both write
	// `__auth_session` on `.{domain}`, and the last writer wins. The loser's
	// page had already been served, so its document renders and then every
	// script it asks for comes back 401 — a blank panel, and nothing in it that
	// looks like an authentication problem.
	SessionCookieName = "__auth_session"
)

// Session represents an authenticated user session.
type Session struct {
	ID           string
	UserID       string
	Username     string
	DisplayName  string
	AccessToken  string
	RefreshToken string
	Permissions  []string
	OriginDomain string
	CreatedAt    time.Time
	ExpiresAt    time.Time
}

// SessionStore is a thread-safe in-memory session store.
type SessionStore struct {
	mu       sync.RWMutex
	sessions map[string]*Session
	ttl      time.Duration
	stopCh   chan struct{}
	// The cookie this guard owns — see sessionCookieName.
	cookieName string
}

// NewSessionStore creates a new SessionStore with the given session TTL.
// It starts a background goroutine to clean up expired sessions.
// sessionCookieName is the cookie this guard owns.
//
// Scoping by *name* rather than by domain, deliberately: the cookie has to stay
// on the platform domain so that `{service}.uc-X.{domain}` and `uc-X.{domain}`
// — the container's own services and its auth callback — share one session.
// Narrowing the domain to the container would split those instead.
func sessionCookieName(containerID string) string {
	if containerID == "" {
		return SessionCookieName
	}
	return SessionCookieName + "_" + containerID
}

func NewSessionStore(ttl time.Duration, containerID string) *SessionStore {
	s := &SessionStore{
		sessions:   make(map[string]*Session),
		ttl:        ttl,
		stopCh:     make(chan struct{}),
		cookieName: sessionCookieName(containerID),
	}
	go s.cleanupLoop()
	return s
}

// Create creates a new session for the given user data and returns the session ID.
func (s *SessionStore) Create(userID, username, displayName, accessToken, refreshToken string, permissions []string, originDomain string) string {
	id := generateSessionID()
	now := time.Now()

	session := &Session{
		ID:           id,
		UserID:       userID,
		Username:     username,
		DisplayName:  displayName,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		Permissions:  permissions,
		OriginDomain: originDomain,
		CreatedAt:    now,
		ExpiresAt:    now.Add(s.ttl),
	}

	s.mu.Lock()
	s.sessions[id] = session
	s.mu.Unlock()

	return id
}

// Get returns the session for the given ID, or nil if not found or expired.
func (s *SessionStore) Get(id string) *Session {
	s.mu.RLock()
	session, ok := s.sessions[id]
	s.mu.RUnlock()

	if !ok {
		return nil
	}

	if time.Now().After(session.ExpiresAt) {
		s.Delete(id)
		return nil
	}

	return session
}

// Delete removes a session by ID.
func (s *SessionStore) Delete(id string) {
	s.mu.Lock()
	delete(s.sessions, id)
	s.mu.Unlock()
}

// SetSessionCookie writes the session cookie to the response.
func (s *SessionStore) SetSessionCookie(w http.ResponseWriter, sessionID, cookieDomain string) {
	http.SetCookie(w, &http.Cookie{
		Name:     s.cookieName,
		Value:    sessionID,
		Domain:   cookieDomain,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(s.ttl.Seconds()),
	})
}

// GetSessionFromRequest extracts and validates the session from the request cookie.
func (s *SessionStore) GetSessionFromRequest(r *http.Request) *Session {
	cookie, err := r.Cookie(s.cookieName)
	if err != nil {
		return nil
	}
	return s.Get(cookie.Value)
}

// Stop stops the cleanup goroutine.
func (s *SessionStore) Stop() {
	close(s.stopCh)
}

// Count returns the number of active sessions.
func (s *SessionStore) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.sessions)
}

// cleanupLoop runs every minute to remove expired sessions.
func (s *SessionStore) cleanupLoop() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.cleanup()
		case <-s.stopCh:
			return
		}
	}
}

func (s *SessionStore) cleanup() {
	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()

	for id, session := range s.sessions {
		if now.After(session.ExpiresAt) {
			delete(s.sessions, id)
		}
	}
}

// generateSessionID returns a cryptographically random hex string.
func generateSessionID() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic("failed to generate session ID: " + err.Error())
	}
	return hex.EncodeToString(b)
}
