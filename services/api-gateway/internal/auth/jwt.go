package auth

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var (
	ErrMissingToken    = errors.New("missing authorization token")
	ErrInvalidToken    = errors.New("invalid or malformed authorization token")
	ErrExpiredToken    = errors.New("authorization token has expired")
	ErrUnsupportedAlgo = errors.New("unsupported token signing algorithm")
)

// UserClaims represents the standard and custom claims extracted from ZenFit JWTs.
type UserClaims struct {
	UserID string `json:"userId"`
	Email  string `json:"email,omitempty"`
	Role   string `json:"role,omitempty"`
	jwt.RegisteredClaims
}

// Validator validates JWT tokens using RS256 (asymmetric) with HS256 fallback.
type Validator struct {
	rsaPublicKey *rsa.PublicKey
	hs256Secret  []byte
}

// NewValidator initializes a JWT validator. It attempts to load an RSA public key first;
// if not provided, it falls back to the symmetric HS256 secret.
func NewValidator(rsaKeyPEM, rsaKeyPath, hs256Secret string) (*Validator, error) {
	v := &Validator{
		hs256Secret: []byte(hs256Secret),
	}

	// 1. Try loading RSA public key from direct PEM string
	if strings.TrimSpace(rsaKeyPEM) != "" {
		pubKey, err := parseRSAPublicKey([]byte(rsaKeyPEM))
		if err == nil {
			v.rsaPublicKey = pubKey
			return v, nil
		}
	}

	// 2. Try loading RSA public key from file path
	if strings.TrimSpace(rsaKeyPath) != "" {
		data, err := os.ReadFile(rsaKeyPath)
		if err == nil {
			pubKey, err := parseRSAPublicKey(data)
			if err == nil {
				v.rsaPublicKey = pubKey
				return v, nil
			}
		}
	}

	return v, nil
}

// ValidateToken parses and validates a JWT token string, returning verified UserClaims.
func (v *Validator) ValidateToken(tokenStr string) (*UserClaims, error) {
	tokenStr = strings.TrimSpace(tokenStr)
	if tokenStr == "" {
		return nil, ErrMissingToken
	}

	claims := &UserClaims{}

	token, err := jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
		switch token.Method.(type) {
		case *jwt.SigningMethodRSA:
			if v.rsaPublicKey == nil {
				return nil, fmt.Errorf("server has no RSA public key configured to verify %s", token.Method.Alg())
			}
			return v.rsaPublicKey, nil
		case *jwt.SigningMethodHMAC:
			if len(v.hs256Secret) == 0 {
				return nil, errors.New("server has no HMAC secret configured")
			}
			return v.hs256Secret, nil
		default:
			return nil, fmt.Errorf("%w: %s", ErrUnsupportedAlgo, token.Method.Alg())
		}
	})

	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return nil, ErrExpiredToken
		}
		return nil, fmt.Errorf("%w: %v", ErrInvalidToken, err)
	}

	if !token.Valid {
		return nil, ErrInvalidToken
	}

	// Support 'sub' claim as fallback for UserID
	if claims.UserID == "" && claims.Subject != "" {
		claims.UserID = claims.Subject
	}

	if claims.UserID == "" {
		return nil, errors.New("token does not contain a valid userId or sub claim")
	}

	return claims, nil
}

// parseRSAPublicKey parses a PEM-encoded PKCS1 or PKIX RSA public key.
func parseRSAPublicKey(pemBytes []byte) (*rsa.PublicKey, error) {
	block, _ := pem.Decode(pemBytes)
	if block == nil {
		return nil, errors.New("failed to decode PEM block for RSA public key")
	}

	// Try standard PKIX (SubjectPublicKeyInfo)
	pub, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err == nil {
		if rsaPub, ok := pub.(*rsa.PublicKey); ok {
			return rsaPub, nil
		}
	}

	// Try PKCS1
	rsaPub, err := x509.ParsePKCS1PublicKey(block.Bytes)
	if err == nil {
		return rsaPub, nil
	}

	return nil, errors.New("failed to parse RSA public key (tried PKIX and PKCS1)")
}

// Helper: GenerateToken creates a signed token for testing and mocking.
func GenerateTestToken(userID, role, email string, secret []byte, duration time.Duration) (string, error) {
	now := time.Now()
	claims := UserClaims{
		UserID: userID,
		Role:   role,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(duration)),
			Issuer:    "zenfit-auth",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}
