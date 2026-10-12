package auth

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestJWTValidator_HS256(t *testing.T) {
	secret := "test-secret-key-at-least-32-characters-long"
	validator, err := NewValidator("", "", secret)
	if err != nil {
		t.Fatalf("failed to create validator: %v", err)
	}

	// 1. Valid Token
	validToken, err := GenerateTestToken("user_123", "athlete", "athlete@zenfit.app", []byte(secret), 1*time.Hour)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	claims, err := validator.ValidateToken(validToken)
	if err != nil {
		t.Fatalf("expected valid token, got error: %v", err)
	}
	if claims.UserID != "user_123" {
		t.Errorf("expected UserID user_123, got %s", claims.UserID)
	}
	if claims.Role != "athlete" {
		t.Errorf("expected Role athlete, got %s", claims.Role)
	}

	// 2. Expired Token
	expiredToken, err := GenerateTestToken("user_123", "athlete", "athlete@zenfit.app", []byte(secret), -1*time.Minute)
	if err != nil {
		t.Fatalf("failed to generate expired token: %v", err)
	}
	_, err = validator.ValidateToken(expiredToken)
	if err == nil {
		t.Error("expected error for expired token, got nil")
	}

	// 3. Tampered Token
	tamperedToken := validToken + "tampered"
	_, err = validator.ValidateToken(tamperedToken)
	if err == nil {
		t.Error("expected error for tampered token, got nil")
	}
}

func TestJWTValidator_RS256(t *testing.T) {
	// Generate an ephemeral RSA key pair for testing
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}

	pubASN1, err := x509.MarshalPKIXPublicKey(&privateKey.PublicKey)
	if err != nil {
		t.Fatalf("failed to marshal public key: %v", err)
	}

	pubPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: pubASN1,
	})

	validator, err := NewValidator(string(pubPEM), "", "")
	if err != nil {
		t.Fatalf("failed to create RSA validator: %v", err)
	}

	// Sign a token with RS256
	now := time.Now()
	claims := UserClaims{
		UserID: "usr_rsa_999",
		Role:   "trainer",
		Email:  "trainer@zenfit.app",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   "usr_rsa_999",
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(1 * time.Hour)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tokenStr, err := token.SignedString(privateKey)
	if err != nil {
		t.Fatalf("failed to sign RS256 token: %v", err)
	}

	// Validate with public key
	verifiedClaims, err := validator.ValidateToken(tokenStr)
	if err != nil {
		t.Fatalf("expected valid RS256 token, got error: %v", err)
	}
	if verifiedClaims.UserID != "usr_rsa_999" {
		t.Errorf("expected UserID usr_rsa_999, got %s", verifiedClaims.UserID)
	}
	if verifiedClaims.Role != "trainer" {
		t.Errorf("expected Role trainer, got %s", verifiedClaims.Role)
	}
}
