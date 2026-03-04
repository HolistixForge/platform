package auth

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	jwtlib "github.com/golang-jwt/jwt/v5"
)

// JWTValidator validates RS256 JWTs using a public key fetched from Ganymede.
type JWTValidator struct {
	publicKey *rsa.PublicKey
}

// UserClaims represents the claims extracted from a valid JWT.
type UserClaims struct {
	UserID      string `json:"user_id"`
	Username    string `json:"username"`
	DisplayName string `json:"display_name"`
}

// NewJWTValidator creates a new JWTValidator by fetching the public key from Ganymede.
// It retries up to maxRetries times with exponential backoff.
func NewJWTValidator(ganymedeURL string, httpClient *http.Client, maxRetries int) (*JWTValidator, error) {
	var lastErr error

	for i := 0; i < maxRetries; i++ {
		if i > 0 {
			backoff := time.Duration(1<<uint(i-1)) * time.Second
			log.Printf("[jwt] retry %d/%d fetching public key in %v", i+1, maxRetries, backoff)
			time.Sleep(backoff)
		}

		pubKey, err := fetchPublicKey(ganymedeURL, httpClient)
		if err != nil {
			lastErr = err
			log.Printf("[jwt] failed to fetch public key: %v", err)
			continue
		}

		return &JWTValidator{publicKey: pubKey}, nil
	}

	return nil, fmt.Errorf("failed to fetch public key after %d retries: %w", maxRetries, lastErr)
}

// NewJWTValidatorFromKey creates a JWTValidator from an existing RSA public key.
// This is primarily used for testing.
func NewJWTValidatorFromKey(pubKey *rsa.PublicKey) *JWTValidator {
	return &JWTValidator{publicKey: pubKey}
}

// Validate parses and validates a JWT token string.
// Returns the user claims if the token is valid.
func (v *JWTValidator) Validate(tokenString string) (*UserClaims, error) {
	token, err := jwtlib.Parse(tokenString, func(token *jwtlib.Token) (interface{}, error) {
		// Ensure the signing method is RS256
		if _, ok := token.Method.(*jwtlib.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return v.publicKey, nil
	}, jwtlib.WithExpirationRequired())

	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(jwtlib.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}

	// Support both flat claims (user_id, username) and nested claims (user.id, user.username)
	userID, _ := claims["user_id"].(string)
	username, _ := claims["username"].(string)
	displayName, _ := claims["display_name"].(string)

	// Ganymede OAuth tokens use nested user object: {"user": {"id": "...", "username": "..."}}
	if userID == "" {
		if userObj, ok := claims["user"].(map[string]interface{}); ok {
			userID, _ = userObj["id"].(string)
			if username == "" {
				username, _ = userObj["username"].(string)
			}
			if displayName == "" {
				displayName, _ = userObj["display_name"].(string)
			}
		}
	}

	if userID == "" {
		return nil, fmt.Errorf("token missing user_id claim")
	}

	return &UserClaims{
		UserID:      userID,
		Username:    username,
		DisplayName: displayName,
	}, nil
}

// publicKeyResponse represents the JSON response from Ganymede's /oauth/public-key endpoint.
type publicKeyResponse struct {
	PublicKey string `json:"publicKey"`
}

// fetchPublicKey fetches the RSA public key from Ganymede's public-key endpoint.
// Ganymede returns JSON: {"publicKey": "-----BEGIN RSA PUBLIC KEY-----\n..."}
func fetchPublicKey(ganymedeURL string, httpClient *http.Client) (*rsa.PublicKey, error) {
	resp, err := httpClient.Get(ganymedeURL + "/oauth/public-key")
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Ganymede wraps the PEM key in a JSON envelope
	var keyResp publicKeyResponse
	if err := json.Unmarshal(body, &keyResp); err != nil {
		return nil, fmt.Errorf("failed to parse JSON response: %w", err)
	}

	if keyResp.PublicKey == "" {
		return nil, fmt.Errorf("empty publicKey in response")
	}

	return ParseRSAPublicKey([]byte(keyResp.PublicKey))
}

// ParseRSAPublicKey parses a PEM-encoded RSA public key.
func ParseRSAPublicKey(pemBytes []byte) (*rsa.PublicKey, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block")
	}

	// Try PKIX first (most common for public keys)
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		// Try PKCS1
		rsaPub, err2 := x509.ParsePKCS1PublicKey(block.Bytes)
		if err2 != nil {
			return nil, fmt.Errorf("failed to parse public key (PKIX: %v, PKCS1: %v)", err, err2)
		}
		return rsaPub, nil
	}

	rsaPub, ok := pub.(*rsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("key is not an RSA public key")
	}

	return rsaPub, nil
}
