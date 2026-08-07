package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSessionCreate(t *testing.T) {
	store := NewSessionStore(1*time.Hour, "")
	defer store.Stop()

	id := store.Create("user-123", "testuser", "Test User", "access-token", "refresh-token", nil, "example.local")

	if id == "" {
		t.Fatal("expected non-empty session ID")
	}

	session := store.Get(id)
	if session == nil {
		t.Fatal("expected session to exist")
	}

	if session.UserID != "user-123" {
		t.Errorf("expected UserID=user-123, got %s", session.UserID)
	}
	if session.Username != "testuser" {
		t.Errorf("expected Username=testuser, got %s", session.Username)
	}
	if session.DisplayName != "Test User" {
		t.Errorf("expected DisplayName=Test User, got %s", session.DisplayName)
	}
	if session.AccessToken != "access-token" {
		t.Errorf("expected AccessToken=access-token, got %s", session.AccessToken)
	}
	if session.RefreshToken != "refresh-token" {
		t.Errorf("expected RefreshToken=refresh-token, got %s", session.RefreshToken)
	}
}

func TestSessionExpired(t *testing.T) {
	store := NewSessionStore(1*time.Millisecond, "")
	defer store.Stop()

	id := store.Create("user-123", "testuser", "Test User", "at", "rt", nil, "example.local")

	// Wait for expiration
	time.Sleep(10 * time.Millisecond)

	session := store.Get(id)
	if session != nil {
		t.Error("expected expired session to return nil")
	}
}

func TestSessionDelete(t *testing.T) {
	store := NewSessionStore(1*time.Hour, "")
	defer store.Stop()

	id := store.Create("user-123", "testuser", "Test User", "at", "rt", nil, "example.local")

	store.Delete(id)

	session := store.Get(id)
	if session != nil {
		t.Error("expected deleted session to return nil")
	}
}

func TestSessionGetNonExistent(t *testing.T) {
	store := NewSessionStore(1*time.Hour, "")
	defer store.Stop()

	session := store.Get("non-existent")
	if session != nil {
		t.Error("expected non-existent session to return nil")
	}
}

func TestSessionCleanup(t *testing.T) {
	// Use a very short TTL to test cleanup
	store := &SessionStore{
		sessions: make(map[string]*Session),
		ttl:      1 * time.Millisecond,
		stopCh:   make(chan struct{}),
	}
	defer store.Stop()

	store.Create("user-1", "user1", "User 1", "at1", "rt1", nil, "example.local")
	store.Create("user-2", "user2", "User 2", "at2", "rt2", nil, "example.local")

	if store.Count() != 2 {
		t.Errorf("expected 2 sessions, got %d", store.Count())
	}

	// Wait for sessions to expire
	time.Sleep(10 * time.Millisecond)

	// Run manual cleanup
	store.cleanup()

	if store.Count() != 0 {
		t.Errorf("expected 0 sessions after cleanup, got %d", store.Count())
	}
}

func TestGetSessionFromRequest(t *testing.T) {
	store := NewSessionStore(1*time.Hour, "")
	defer store.Stop()

	id := store.Create("user-123", "testuser", "Test User", "at", "rt", nil, "example.local")

	req := httptest.NewRequest("GET", "http://example.local/", nil)
	req.AddCookie(&http.Cookie{
		Name:  SessionCookieName,
		Value: id,
	})

	session := store.GetSessionFromRequest(req)
	if session == nil {
		t.Fatal("expected session from request")
	}
	if session.UserID != "user-123" {
		t.Errorf("expected UserID=user-123, got %s", session.UserID)
	}
}

func TestGetSessionFromRequestNoCookie(t *testing.T) {
	store := NewSessionStore(1*time.Hour, "")
	defer store.Stop()

	req := httptest.NewRequest("GET", "http://example.local/", nil)

	session := store.GetSessionFromRequest(req)
	if session != nil {
		t.Error("expected nil session when no cookie")
	}
}

func TestSetSessionCookie(t *testing.T) {
	store := NewSessionStore(1*time.Hour, "")
	defer store.Stop()

	w := httptest.NewRecorder()
	store.SetSessionCookie(w, "session-123", ".example.local")

	cookies := w.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("expected 1 cookie, got %d", len(cookies))
	}

	cookie := cookies[0]
	if cookie.Name != SessionCookieName {
		t.Errorf("expected cookie name %s, got %s", SessionCookieName, cookie.Name)
	}
	if cookie.Value != "session-123" {
		t.Errorf("expected cookie value session-123, got %s", cookie.Value)
	}
	if !cookie.HttpOnly {
		t.Error("expected HttpOnly=true")
	}
	if !cookie.Secure {
		t.Error("expected Secure=true")
	}
	if cookie.SameSite != http.SameSiteLaxMode {
		t.Errorf("expected SameSite=Lax, got %v", cookie.SameSite)
	}
}

func TestSessionCookieIsScopedToTheContainer(t *testing.T) {
	// The cookie lives on the whole platform domain while each guard keeps its
	// sessions in its own memory. Sharing one name means one container's guard
	// receives another's session id, finds nothing, and refuses — which is what
	// two notebooks open at once in a project did to each other.
	a := NewSessionStore(time.Minute, "uc_aaa")
	b := NewSessionStore(time.Minute, "uc_bbb")

	id := a.Create("user-1", "u", "U", "at", "rt", nil, "")

	wa := httptest.NewRecorder()
	a.SetSessionCookie(wa, id, ".apollo.test")
	cookies := wa.Result().Cookies()
	if len(cookies) != 1 || cookies[0].Name != "__auth_session_uc_aaa" {
		t.Fatalf("got cookie %+v, want __auth_session_uc_aaa", cookies)
	}

	// The browser sends every cookie on the domain to both guards.
	r := httptest.NewRequest("GET", "/static/lab/main.js", nil)
	r.AddCookie(cookies[0])

	if a.GetSessionFromRequest(r) == nil {
		t.Fatal("the guard that minted the session no longer recognises it")
	}
	if b.GetSessionFromRequest(r) != nil {
		t.Fatal("a second container's guard accepted a session it never minted")
	}
}

func TestSessionCookieKeepsItsNameWithoutAContainerId(t *testing.T) {
	s := NewSessionStore(time.Minute, "")
	w := httptest.NewRecorder()
	s.SetSessionCookie(w, "sid", ".apollo.test")
	if got := w.Result().Cookies()[0].Name; got != SessionCookieName {
		t.Fatalf("got %q, want %q", got, SessionCookieName)
	}
}
