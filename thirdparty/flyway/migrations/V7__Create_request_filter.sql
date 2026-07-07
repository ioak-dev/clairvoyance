CREATE TABLE request_filter (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER request_filter_set_updated_at
    BEFORE UPDATE ON request_filter
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_request_filter_active_sort ON request_filter(is_active, sort_order);

GRANT SELECT ON request_filter TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON request_filter TO authenticated, service_role;

GRANT INSERT, UPDATE, DELETE ON request_filter TO anon;

-- Seed demo request filters (deterministic IDs)
INSERT INTO request_filter (id, name, description, criteria, sort_order)
VALUES
  (
    (SELECT (
      substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 13, 3) ||
      '-a' || substr(h, 17, 3) || '-' || substr(h, 21, 12)
    )::uuid FROM (SELECT md5('clairvoyance:rf-all') AS h) s),
    'All Requests',
    'No request filter applied',
    '{}'::jsonb,
    0
  ),
  (
    (SELECT (
      substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 13, 3) ||
      '-a' || substr(h, 17, 3) || '-' || substr(h, 21, 12)
    )::uuid FROM (SELECT md5('clairvoyance:rf-pending') AS h) s),
    'Pending Only',
    'Requests awaiting assignment',
    '{"status": "Pending"}'::jsonb,
    1
  ),
  (
    (SELECT (
      substr(h, 1, 8) || '-' || substr(h, 9, 4) || '-4' || substr(h, 13, 3) ||
      '-a' || substr(h, 17, 3) || '-' || substr(h, 21, 12)
    )::uuid FROM (SELECT md5('clairvoyance:rf-unassigned') AS h) s),
    'Unassigned',
    'Requests without an assigned person',
    '{"unassigned_only": true}'::jsonb,
    2
  )
ON CONFLICT (id) DO NOTHING;
