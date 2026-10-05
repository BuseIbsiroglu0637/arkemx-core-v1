export const LAND_QUOTA_TABLE = "CREATE TABLE IF NOT EXISTS land_search_quota (owner TEXT NOT NULL, day TEXT NOT NULL, requests INTEGER NOT NULL, PRIMARY KEY(owner, day))";
export const LAND_QUOTA_RESERVATION = "INSERT INTO land_search_quota(owner, day, requests) VALUES (?, ?, 1) ON CONFLICT(owner, day) DO UPDATE SET requests = requests + 1 WHERE requests < 10 RETURNING requests";
