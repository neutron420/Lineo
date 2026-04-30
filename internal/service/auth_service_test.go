package service

import (
	"testing"
	"queueless/internal/models"
)

type mockUserRepo struct {
	users map[string]*models.User
}

func (m *mockUserRepo) CreateUser(user *models.User) error {
	m.users[user.Email] = user
	return nil
}

func (m *mockUserRepo) GetUserByEmail(email string) (*models.User, error) {
	return m.users[email], nil
}

func (m *mockUserRepo) GetUserByID(id uint) (*models.User, error) {
	for _, u := range m.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, nil
}

func (m *mockUserRepo) UpdateUser(user *models.User) error {
	m.users[user.Email] = user
	return nil
}

func (m *mockUserRepo) DeleteUser(id uint) error {
	for email, u := range m.users {
		if u.ID == id {
			delete(m.users, email)
			return nil
		}
	}
	return nil
}

func TestRegisterUser(t *testing.T) {
	repo := &mockUserRepo{users: make(map[string]*models.User)}
	svc := NewAuthService(repo)

	req := models.RegisterRequest{
		Email:    "test@example.com",
		Password: "password123",
		Username: "testuser",
		Role:     "user",
	}

	user, err := svc.RegisterUser(req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if user.Email != req.Email {
		t.Errorf("expected email %s, got %s", req.Email, user.Email)
	}
	
	if user.Role != models.RoleUser {
		t.Errorf("expected role user, got %v", user.Role)
	}
}

func TestRegisterAdmin_NoBackdoor(t *testing.T) {
	repo := &mockUserRepo{users: make(map[string]*models.User)}
	svc := NewAuthService(repo)

	req := models.RegisterRequest{
		Email:    "boss@example.com", // This used to trigger the backdoor
		Password: "password123",
		Username: "bossuser",
		Role:     "user",
	}

	user, err := svc.RegisterUser(req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if user.Role != models.RoleUser {
		t.Errorf("backdoor still exists! expected role user for 'boss' email, got %v", user.Role)
	}
}
