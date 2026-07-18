-- Provisioning script for apps/mcp-server's two narrowly-scoped Postgres roles.
-- Not a Prisma migration (this repo has no Prisma migration history yet) — run once,
-- by hand, against the target Postgres instance as an ops step, after the schema has
-- already been applied (via `prisma db push` or a hand-authored migration).
--
-- humanfirst_mcp_reader: read-only DB-level backstop for apps/mcp-server's normal
-- Prisma client (SELECT only, all tables, including future ones via default privileges).
CREATE ROLE humanfirst_mcp_reader LOGIN PASSWORD '<set via ops secret>';
GRANT CONNECT ON DATABASE humanfirst TO humanfirst_mcp_reader;
GRANT USAGE ON SCHEMA public TO humanfirst_mcp_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO humanfirst_mcp_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO humanfirst_mcp_reader;

-- humanfirst_mcp_audit: insert-only role for apps/mcp-server's non-Prisma pg client
-- (src/audit.ts), the one legitimately-needed write path. INSERT on "AuditLog" only —
-- no SELECT, no other tables. Table name is case-sensitive/quoted because schema.prisma
-- has no @@map("audit_log") on AuditLog, so the physical table is "AuditLog".
CREATE ROLE humanfirst_mcp_audit LOGIN PASSWORD '<set via ops secret>';
GRANT CONNECT ON DATABASE humanfirst TO humanfirst_mcp_audit;
GRANT USAGE ON SCHEMA public TO humanfirst_mcp_audit;
GRANT INSERT ON "AuditLog" TO humanfirst_mcp_audit;
