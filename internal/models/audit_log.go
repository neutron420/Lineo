package models

import (
	"time"

	"gorm.io/gorm"
)

type AuditLog struct {
	ID         uint           `gorm:"primaryKey" json:"id"`
	OrgID      uint           `gorm:"index:idx_audit_org_created,priority:1;not null" json:"org_id"`
	ActorID    uint           `gorm:"index" json:"actor_id"`
	Action     string         `gorm:"index:idx_audit_action_created,priority:1;not null" json:"action"`
	EntityType string         `gorm:"index:idx_audit_entity,priority:1;not null" json:"entity_type"`
	EntityID   string         `gorm:"index:idx_audit_entity,priority:2;not null" json:"entity_id"`
	Metadata   []byte         `gorm:"type:jsonb" json:"metadata"`
	CreatedAt  time.Time      `gorm:"index:idx_audit_org_created,priority:2;index:idx_audit_action_created,priority:2" json:"created_at"`
	UpdatedAt  time.Time      `json:"updated_at"`
	DeletedAt  gorm.DeletedAt `gorm:"index" json:"-"`
}
