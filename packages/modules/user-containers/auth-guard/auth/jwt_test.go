package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	jwtlib "github.com/golang-jwt/jwt/v5"
)

// generateTestKeyPair generates a test RSA key pair.
func generateTestKeyPair(t *testing.T) (*rsa.PrivateKey, *rsa.PublicKey) {
	t.Helper()
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}
	return privateKey, &privateKey.PublicKey
}

// signTestJWT signs a JWT with the given claims and private key.
func signTestJWT(t *testing.T, privateKey *rsa.PrivateKey, claims jwtlib.MapClaims) string {
	t.Helper()
	token := jwtlib.NewWithClaims(jwtlib.SigningMethodRS256, claims)
	tokenString, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("failed to sign JWT: %v", err)
	}
	return tokenString
}

// publicKeyToPEM encodes an RSA public key to PEM format.
func publicKeyToPEM(t *testing.T, pubKey *rsa.PublicKey) []byte {
	t.Helper()
	pubASN1, err := x509.MarshalPKIXPublicKey(pubKey)
	if err != nil {
		t.Fatalf("failed to marshal public key: %v", err)
	}
	return pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: pubASN1,
	})
}

func TestValidateGoodJWT(t *testing.T) {
	privateKey, publicKey := generateTestKeyPair(t)
	validator := NewJWTValidatorFromKey(publicKey)

	claims := jwtlib.MapClaims{
		"user_id":      "user-123",
		"username":     "testuser",
		"display_name": "Test User",
		"exp":          time.Now().Add(1 * time.Hour).Unix(),
	}

	tokenString := signTestJWT(t, privateKey, claims)

	userClaims, err := validator.Validate(tokenString)
	if err != nil {
		t.Fatalf("expected valid token, got error: %v", err)
	}

	if userClaims.UserID != "user-123" {
		t.Errorf("expected UserID=user-123, got %s", userClaims.UserID)
	}
	if userClaims.Username != "testuser" {
		t.Errorf("expected Username=testuser, got %s", userClaims.Username)
	}
	if userClaims.DisplayName != "Test User" {
		t.Errorf("expected DisplayName=Test User, got %s", userClaims.DisplayName)
	}
}

func TestValidateExpiredJWT(t *testing.T) {
	privateKey, publicKey := generateTestKeyPair(t)
	validator := NewJWTValidatorFromKey(publicKey)

	claims := jwtlib.MapClaims{
		"user_id":  "user-123",
		"username": "testuser",
		"exp":      time.Now().Add(-1 * time.Hour).Unix(),
	}

	tokenString := signTestJWT(t, privateKey, claims)

	_, err := validator.Validate(tokenString)
	if err == nil {
		t.Fatal("expected error for expired token")
	}
}

func TestValidateWrongSignature(t *testing.T) {
	privateKey, _ := generateTestKeyPair(t)
	_, otherPublicKey := generateTestKeyPair(t)

	// Validate with a different public key
	validator := NewJWTValidatorFromKey(otherPublicKey)

	claims := jwtlib.MapClaims{
		"user_id":  "user-123",
		"username": "testuser",
		"exp":      time.Now().Add(1 * time.Hour).Unix(),
	}

	tokenString := signTestJWT(t, privateKey, claims)

	_, err := validator.Validate(tokenString)
	if err == nil {
		t.Fatal("expected error for wrong signature")
	}
}

func TestValidateMissingUserID(t *testing.T) {
	privateKey, publicKey := generateTestKeyPair(t)
	validator := NewJWTValidatorFromKey(publicKey)

	claims := jwtlib.MapClaims{
		"username": "testuser",
		"exp":      time.Now().Add(1 * time.Hour).Unix(),
	}

	tokenString := signTestJWT(t, privateKey, claims)

	_, err := validator.Validate(tokenString)
	if err == nil {
		t.Fatal("expected error for missing user_id")
	}
}

func TestNewJWTValidatorFromServer(t *testing.T) {
	_, publicKey := generateTestKeyPair(t)
	pemData := publicKeyToPEM(t, publicKey)

	// Create a mock Ganymede server that returns JSON like real Ganymede
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/oauth/public-key" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]string{"publicKey": string(pemData)})
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	validator, err := NewJWTValidator(server.URL, server.Client(), 3)
	if err != nil {
		t.Fatalf("expected validator, got error: %v", err)
	}

	if validator.publicKey == nil {
		t.Fatal("expected public key to be set")
	}
}

func TestNewJWTValidatorRetry(t *testing.T) {
	attempts := 0
	_, publicKey := generateTestKeyPair(t)
	pemData := publicKeyToPEM(t, publicKey)

	// Server that fails first 2 attempts, then succeeds with JSON response
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts < 3 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(map[string]string{"publicKey": string(pemData)})
	}))
	defer server.Close()

	validator, err := NewJWTValidator(server.URL, server.Client(), 5)
	if err != nil {
		t.Fatalf("expected validator after retries, got error: %v", err)
	}

	if validator.publicKey == nil {
		t.Fatal("expected public key to be set")
	}
}

func TestParseRSAPublicKey(t *testing.T) {
	_, publicKey := generateTestKeyPair(t)
	pemData := publicKeyToPEM(t, publicKey)

	parsedKey, err := ParseRSAPublicKey(pemData)
	if err != nil {
		t.Fatalf("expected parsed key, got error: %v", err)
	}

	if parsedKey.N.Cmp(publicKey.N) != 0 {
		t.Error("parsed key does not match original")
	}
}

func TestParseRSAPublicKeyInvalidPEM(t *testing.T) {
	_, err := ParseRSAPublicKey([]byte("not a PEM block"))
	if err == nil {
		t.Fatal("expected error for invalid PEM")
	}
}
