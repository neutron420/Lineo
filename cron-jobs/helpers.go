package cronjobs

import (
	"queueless/internal/models"
	"queueless/pkg/db"
)

// fetchAllQueueDefs loads all queue definitions from the database.
// This is used by the queue reminder service to iterate over all active queues.
func fetchAllQueueDefs(defs *[]models.QueueDef) error {
	return db.DB.Find(defs).Error
}
