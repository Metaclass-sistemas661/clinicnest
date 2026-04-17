-- Table: rnds_incoming_statistics
CREATE TABLE IF NOT EXISTS rnds_incoming_statistics (
  tenant_id UUID,
  total_received BIGINT,
  pending_count BIGINT,
  accepted_count BIGINT,
  rejected_count BIGINT,
  merged_count BIGINT,
  error_count BIGINT,
  last_received_at TIMESTAMPTZ
);
