package utils

import (
	"errors"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"queueless/internal/models"
)

var jwtKey []byte

func init() {
	key := os.Getenv("JWT_SECRET")
	if key == "" {
		key = "fallback_secret_key_for_development_only"
	}
	jwtKey = []byte(key)
}

type Claims struct {
	UserID         uint        `json:"user_id"`
	Role           models.Role `json:"role"`
	OrganizationID *uint       `json:"organization_id"`
	jwt.RegisteredClaims
}

func GenerateToken(user *models.User) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		UserID:         user.ID,
		Role:           user.Role,
		OrganizationID: user.OrganizationID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtKey)
}

func ValidateToken(tokenString string) (*Claims, error) {
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtKey, nil
	})

	if err != nil {
		if err == jwt.ErrSignatureInvalid {
			return nil, errors.New("invalid token signature")
		}
		return nil, errors.New("could not parse token")
	}

	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}
