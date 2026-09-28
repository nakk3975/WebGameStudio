-- Additive, apply transactionally on verification branch before production.
CREATE TABLE ghostdesk.user_saves (
  user_id varchar(128) NOT NULL,
  case_id varchar(80) NOT NULL,
  version_id varchar(80) NOT NULL REFERENCES ghostdesk.case_versions(version_id),
  payload jsonb NOT NULL,
  revision bigint NOT NULL CHECK (revision > 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id,case_id),
  CHECK (jsonb_typeof(payload)='object'),
  CHECK (octet_length(payload::text)<=1048576),
  CHECK (payload->>'format'='ghostdesk-save-1'),
  CHECK (payload->'case'->>'caseId'=case_id),
  CHECK (payload->'case'->>'versionId'=version_id)
);
ALTER TABLE ghostdesk.user_saves ENABLE ROW LEVEL SECURITY;
ALTER TABLE ghostdesk.user_saves FORCE ROW LEVEL SECURITY;
CREATE POLICY own_save ON ghostdesk.user_saves TO ghostdesk_app
  USING (user_id=current_setting('app.user_id',true))
  WITH CHECK (user_id=current_setting('app.user_id',true));
GRANT SELECT,INSERT,UPDATE ON ghostdesk.user_saves TO ghostdesk_app;
-- Catalog grants stay SELECT-only; the role can now write its own save rows.
ALTER ROLE ghostdesk_app SET default_transaction_read_only = off;
INSERT INTO ghostdesk.schema_migrations(version) VALUES (3);
