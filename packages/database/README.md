# Database deployment

The project uses Prisma with a PostgreSQL driver adapter. Runtime connections read
`DATABASE_URL`; Prisma migration commands prefer `DIRECT_URL`.

For Supabase shared pooling:

- Use the transaction pooler on port 6543 for the application.
- Use the session pooler on port 5432 for migrations, or a reachable direct connection.
- Store credentials only in the ignored root `.env` file or deployment secrets.
- For verified TLS, download the database root CA from Supabase database settings and
  use `sslmode=verify-full&sslrootcert=/absolute/path/to/the/certificate.crt` in each
  connection URL. The certificate path must exist on the machine running the command;
  provision it separately in production rather than copying a developer's local path.

Check and deploy existing migration history:

```sh
pnpm --filter @repo/database exec dotenv -e ../../.env -- prisma migrate status
pnpm --filter @repo/database exec dotenv -e ../../.env -- prisma migrate deploy
```

Do not use `migrate reset` against a shared database. Inspect schema differences and
back up existing data before upgrading a database containing business records.

`checkout_attribution` and `ad_conversion` contain server-only records. Their RLS
migration intentionally adds no browser policies. The backend database role must
own these tables or have `BYPASSRLS`; use the application's existing server APIs
rather than exposing payment attribution through the Supabase Data API.
