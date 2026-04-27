package waittime

import (
    "context"
    "database/sql"
)

type WaitTimeRepo struct {
    DB *sql.DB
}

type OrgStats struct {
    AvgServiceSecs int
    P90ServiceSecs int
    TotalSamples   int
}

type CurrentConditions struct {
    QueueDepth      int
    ActiveAgents    int
    RecentAvgSecs   int // last 30 mins average
}

// GetOrgHistoricalStats pulls pre-aggregated stats for an org
func (r *WaitTimeRepo) GetOrgHistoricalStats(ctx context.Context, orgID string) (OrgStats, error) {
    var stats OrgStats
    query := `
        SELECT avg_service_secs, p90_service_secs, total_samples
        FROM org_wait_stats
        WHERE org_id = $1
    `
    err := r.DB.QueryRowContext(ctx, query, orgID).Scan(
        &stats.AvgServiceSecs,
        &stats.P90ServiceSecs,
        &stats.TotalSamples,
    )
    return stats, err
}

// GetRecentVelocity — how fast is the queue moving RIGHT NOW (last 30 mins)
func (r *WaitTimeRepo) GetRecentVelocity(ctx context.Context, orgID string) (int, error) {
    var avgSecs int
    query := `
        SELECT COALESCE(AVG(duration_secs)::INT, 0)
        FROM service_durations
        WHERE org_id = $1
          AND called_at > NOW() - INTERVAL '30 minutes'
    `
    err := r.DB.QueryRowContext(ctx, query, orgID).Scan(&avgSecs)
    return avgSecs, err
}

// GetActiveAgentCount — how many agents are currently logged in / active
func (r *WaitTimeRepo) GetActiveAgentCount(ctx context.Context, orgID string) (int, error) {
    var count int
    query := `
        SELECT COUNT(*)
        FROM users
        WHERE org_id = $1
          AND role = 'agent'
          AND last_active > NOW() - INTERVAL '10 minutes'
    `
    err := r.DB.QueryRowContext(ctx, query, orgID).Scan(&count)
    return count, err
}
