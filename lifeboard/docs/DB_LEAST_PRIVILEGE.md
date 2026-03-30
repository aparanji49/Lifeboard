# Database least-privilege runbook (PostgreSQL)

This app uses Prisma + NextAuth tables in the `public` schema. Use a dedicated role for runtime traffic with only the minimum privileges required by the app.

## Goal

- No superuser credentials in `DATABASE_URL`
- App role limited to one database and schema
- DML permissions only on required tables/sequences
- Separate migration role for schema changes

## Recommended roles

- `lifeboard_app`: used by app runtime (`DATABASE_URL`)
- `lifeboard_migrate`: used only for migrations (`DIRECT_URL` in CI/admin workflows)

## Example SQL (run as admin once)

```sql
-- 1) Create roles
CREATE ROLE lifeboard_app LOGIN PASSWORD 'REPLACE_WITH_STRONG_SECRET';
CREATE ROLE lifeboard_migrate LOGIN PASSWORD 'REPLACE_WITH_STRONG_SECRET';

-- 2) Restrict broad defaults
REVOKE ALL ON DATABASE postgres FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- 3) Database connect
GRANT CONNECT ON DATABASE postgres TO lifeboard_app;
GRANT CONNECT ON DATABASE postgres TO lifeboard_migrate;

-- 4) Schema usage
GRANT USAGE ON SCHEMA public TO lifeboard_app;
GRANT USAGE, CREATE ON SCHEMA public TO lifeboard_migrate;

-- 5) Runtime table/sequence access (existing objects)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lifeboard_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lifeboard_app;

-- 6) Migration role full object control in schema
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO lifeboard_migrate;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO lifeboard_migrate;

-- 7) Default privileges for future objects created by migration role
ALTER DEFAULT PRIVILEGES FOR ROLE lifeboard_migrate IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lifeboard_app;

ALTER DEFAULT PRIVILEGES FOR ROLE lifeboard_migrate IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO lifeboard_app;
```

## Connection strings

- `DATABASE_URL` => `lifeboard_app` role (runtime)
- `DIRECT_URL` => `lifeboard_migrate` role (migrations only)

## Verification checks

Run these as `lifeboard_app`:

```sql
-- Should fail:
CREATE TABLE should_fail(id int);

-- Should work for existing app tables:
SELECT 1 FROM "User" LIMIT 1;
SELECT 1 FROM "Task" LIMIT 1;
```

## Notes for hosted Postgres/Supabase

- Some managed platforms reserve ownership for provider roles; keep ownership as-is and grant privileges to `lifeboard_app`.
- If your provider does not allow `ALTER DEFAULT PRIVILEGES`, run grants after each migration (or via migration hooks).

## Rotation

- Rotate `lifeboard_app` password periodically and after incidents.
- Rotate `lifeboard_migrate` password and keep it out of runtime environments.
