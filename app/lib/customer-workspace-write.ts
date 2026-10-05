export const CUSTOMER_PROJECT_INSERT_SQL = `
  INSERT INTO customer_projects (
    id, owner_email, name, phase, revision, status, payload, created_at, updated_at
  )
  VALUES (?, ?, ?, ?, ?, 'Kaydedildi', ?, ?, ?)
  ON CONFLICT(id) DO NOTHING
`;

export const CUSTOMER_PROJECT_UPDATE_SQL = `
  UPDATE customer_projects
  SET
    name=?,
    phase=?,
    revision=?,
    status='Kaydedildi',
    payload=?,
    updated_at=?
  WHERE id=?
    AND owner_email=?
    AND updated_at=?
    AND payload=?
`;

export const CUSTOMER_PROJECT_ACTIVITY_SQL = `
  INSERT INTO customer_activities (
    owner_email, event_type, title, detail, created_at
  )
  SELECT ?, 'project', 'Proje hesaba kaydedildi', ?, ?
  WHERE EXISTS (
    SELECT 1
    FROM customer_projects
    WHERE id=?
      AND owner_email=?
      AND updated_at=?
      AND payload=?
  )
`;
