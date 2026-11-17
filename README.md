# Estate Security Incident Log

A browser-based version of the supplied Java Swing incident log. It keeps the original incident types, date/severity/status fields, input validation, and create/read/update/delete workflow. The app uses PostgreSQL and can be deployed to Render.

## Run locally

Requirements: Node.js 20+ and a PostgreSQL database.

1. Create a PostgreSQL database named `estate_security` and run [`database.sql`](./database.sql).
2. In PowerShell, set the required environment variables (replace the example values):

   ```powershell
   $env:DATABASE_URL = "postgres://postgres:your-password@localhost:5432/estate_security"
   $env:ADMIN_PASSWORD = "choose-a-long-private-password"
   $env:SESSION_SECRET = "replace-with-at-least-32-random-characters"
   ```

3. Install and start the app:

   ```powershell
   npm install
   npm start
   ```

4. Open <http://localhost:3000>.

The server also creates the incidents table on startup, so the SQL file is useful for setting up the schema in advance. Do not commit `.env` files, database credentials, or real incident information.

## Open the sample preview

To see the interface without setting up a database, open PowerShell in this folder and run:

```powershell
npm run preview
```

Then open <http://localhost:4173>. This preview uses sample records and in-memory CRUD; its changes disappear when the preview server restarts. Do not use it for real incident records. Press `Ctrl+C` in PowerShell to stop it.

## Deploy to Render

This repository includes a Render Blueprint in [`render.yaml`](./render.yaml). It creates a Node web service and a PostgreSQL database, connects them, generates a session-signing secret, and asks you to provide an `ADMIN_PASSWORD`.

1. Create a GitHub repository and push this project to it.
2. In Render, choose **New + → Blueprint**, connect that GitHub repository, and deploy the Blueprint.
3. When prompted, set a unique `ADMIN_PASSWORD` of at least 12 characters. Keep it private; share it only with authorized estate staff.
4. Open the Render service URL and sign in with that password.

The live database and site do not exist until the Blueprint is deployed from a connected GitHub repository. The free Render database plan is intended for evaluation and may have provider-specific limits or expiration; check Render's current plan terms before storing operational records.

## Access and data handling

All incident APIs require the shared password. Login attempts are rate-limited, and the session cookie is HTTP-only, secure in production, and expires after eight hours. Use HTTPS (Render provides it), keep the password private, and avoid entering unnecessary personal or sensitive details into incident descriptions. This is a small internal-use app, not a substitute for an organization-wide identity-management system, backups, or an incident-response policy.

## Fields and validation

- Incident types: Theft, Break-in, Trespassing, Vandalism, Suspicious Activity, Fire, Other.
- Severity: Low, Medium, High, Critical.
- Status: Open, Under Investigation, Resolved.
- Description and location are limited to the database column lengths.
- Dates must be real dates and cannot be in the future.
- Reported-by values accept names made from letters, spaces, periods, apostrophes, and hyphens.
