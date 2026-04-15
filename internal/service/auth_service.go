package service

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"queueless/internal/models"
	"queueless/internal/repository"
	"queueless/pkg/db"
	"queueless/pkg/config"
	"queueless/pkg/utils"
	"golang.org/x/crypto/bcrypt"
)

type AuthService interface {
	RegisterUser(req models.RegisterRequest) (*models.User, error)
	LoginUser(req models.LoginRequest) (string, *models.User, error)
	ForgotPassword(email string) error
	ResetPassword(token, newPass string) error
	VerifyTurnstile(token string) bool
}

type authService struct {
	userRepo repository.UserRepository
}

func NewAuthService(repo repository.UserRepository) AuthService {
	return &authService{userRepo: repo}
}

func (s *authService) RegisterUser(req models.RegisterRequest) (*models.User, error) {
	if config.Secret("TURNSTILE_SECRET_KEY") != "" {
		if req.TurnstileToken == "" {
			return nil, errors.New("captcha token is required")
		}
		if !s.VerifyTurnstile(req.TurnstileToken) {
			return nil, errors.New("invalid captcha token")
		}
	}

	existingUser, err := s.userRepo.GetUserByEmail(req.Email)
	if err != nil { return nil, err }
	if existingUser != nil { return nil, errors.New("email already registered") }

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)

	user := &models.User{
		Username:       req.Username,
		Email:          req.Email,
		Password:       string(hashedPassword),
		Role:           models.RoleUser,
		OrganizationID: req.OrganizationID,
		PhoneNumber:    req.PhoneNumber,
	}

	err = s.userRepo.CreateUser(user)
	return user, err
}

func (s *authService) LoginUser(req models.LoginRequest) (string, *models.User, error) {
	if config.Secret("TURNSTILE_SECRET_KEY") != "" {
		if req.TurnstileToken == "" {
			return "", nil, errors.New("captcha token is required")
		}
		if !s.VerifyTurnstile(req.TurnstileToken) {
			return "", nil, errors.New("invalid captcha token")
		}
	}

	user, err := s.userRepo.GetUserByEmail(req.Email)
	if err != nil || user == nil { return "", nil, errors.New("invalid email or password") }

	err = bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil { return "", nil, errors.New("invalid email or password") }

	token, _ := utils.GenerateToken(user)
	return token, user, nil
}

func (s *authService) ForgotPassword(email string) error {
	user, err := s.userRepo.GetUserByEmail(email)
	if err != nil || user == nil { return errors.New("user not found") }

	bytes := make([]byte, 16)
	rand.Read(bytes)
	resetToken := hex.EncodeToString(bytes)

	exp := time.Now().Add(1 * time.Hour)
	user.ResetToken = resetToken
	user.ResetTokenExp = &exp

	db.DB.Save(user)
	slog.Info("password reset token generated", "email", email)
	return nil
}

func (s *authService) ResetPassword(token, newPass string) error {
	var user models.User
	if err := db.DB.Where("reset_token = ? AND reset_token_exp > ?", token, time.Now()).First(&user).Error; err != nil {
		return errors.New("invalid or expired token")
	}

	hashed, _ := bcrypt.GenerateFromPassword([]byte(newPass), bcrypt.DefaultCost)
	user.Password = string(hashed)
	user.ResetToken = ""
	user.ResetTokenExp = nil
	
	db.DB.Save(&user)
	return nil
}

func (s *authService) VerifyTurnstile(token string) bool {
	secret := config.Secret("TURNSTILE_SECRET_KEY")
	if secret == "" {
		return true // Skip for dev if no secret
	}

	verifyURL := "https://challenges.cloudflare.com/turnstile/v0/siteverify"
	data := url.Values{}
	data.Set("secret", secret)
	data.Set("response", token)

	resp, err := http.PostForm(verifyURL, data)
	if err != nil {
		slog.Error("turnstile api error", "error", err)
		return false
	}
	defer resp.Body.Close()

	var result struct {
		Success bool `json:"success"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false
	}

	return result.Success
}
