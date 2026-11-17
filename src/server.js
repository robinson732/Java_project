const crypto = require("node:crypto");
const path = require("node:path");
const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { Pool } = require("pg");
const { parseIncidentId, validateIncident } = require("./incident-validation");

const port = Number(process.env.PORT || 3000);
const adminPassword = process.env.ADMIN_PASSWORD;
const sessionSecret = process.env.SESSION_SECRET;
const databaseUrl = process.env.DATABASE_URL;

if (!adminPassword || !sessionSecret || !databaseUrl) {
  throw new Error("ADMIN_PASSWORD, SESSION_SECRET, and DATABASE_URL must be set.");
}
if (Buffer.byteLength(adminPassword) < 12) {
  throw new Error("ADMIN_PASSWORD must be at least 12 bytes long.");
}
if (Buffer.byteLength(sessionSecret) < 32) {
  throw new Error("SESSION_SECRET must be at least 32 bytes long.");
}

const pool = new Pool({ connectionString: databaseUrl });
const app = express();
const publicDirectory = path.join(__dirname, "..", "public");
const cookieName = "incident_session";
const sessionLifetimeSeconds = 8 * 60 * 60;

app.set("trust proxy", 1);
app.use(express.json({ limit: "16kb" }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many sign-in attempts. Please wait before trying again." });
  },
});

function signSession(expiration) {
  return crypto
    .createHmac("sha256", sessionSecret)
    .update(String(expiration))
    .digest("base64url");
}

function getSessionExpiration(req) {
  const cookies = req.headers.cookie || "";
  const cookie = cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));

  if (!cookie) return null;

  const token = cookie.slice(cookieName.length + 1);
  const separator = token.indexOf(".");
  if (separator < 1) return null;

  const expirationText = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!/^\d+$/.test(expirationText) || !/^[A-Za-z0-9_-]+$/.test(signature)) {
    return null;
  }

  const expiration = Number(expirationText);
  if (!Number.isSafeInteger(expiration) || expiration <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  const expected = Buffer.from(signSession(expiration));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
    ? expiration
    : null;
}

function setSessionCookie(res) {
  const expiration = Math.floor(Date.now() / 1000) + sessionLifetimeSeconds;
  const token = `${expiration}.${signSession(expiration)}`;
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: sessionLifetimeSeconds * 1000,
    path: "/",
  });
}

function clearSessionCookie(res) {
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
  });
}

function sameOrigin(req, res, next) {
  const origin = req.get("origin");
  const expectedOrigin = `${req.protocol}://${req.get("host")}`;
  if (origin !== expectedOrigin) {
    return res.status(403).json({ error: "Request origin is not allowed." });
  }
  next();
}

function requireSession(req, res, next) {
  if (!getSessionExpiration(req)) {
    return res.status(401).json({ error: "Please sign in to continue." });
  }
  next();
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.get(
  "/api/health",
  asyncRoute(async (_req, res) => {
    await pool.query("SELECT 1");
    res.json({ status: "ok" });
  }),
);

app.post("/api/login", loginLimiter, sameOrigin, (req, res) => {
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const expected = crypto.createHash("sha256").update(adminPassword).digest();
  const actual = crypto.createHash("sha256").update(password).digest();

  if (!crypto.timingSafeEqual(expected, actual)) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  setSessionCookie(res);
  res.json({ authenticated: true });
});

app.post("/api/logout", sameOrigin, (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

app.get("/api/session", (req, res) => {
  res.json({ authenticated: Boolean(getSessionExpiration(req)) });
});

app.use("/api/incidents", requireSession);

app.get(
  "/api/incidents",
  asyncRoute(async (_req, res) => {
    const result = await pool.query(
      `SELECT incident_id AS id, incident_type AS "incidentType",
              description, location, incident_date AS "incidentDate",
              severity, reported_by AS "reportedBy", status
       FROM incidents
       ORDER BY incident_date DESC, incident_id DESC`,
    );
    res.json(result.rows);
  }),
);

app.post(
  "/api/incidents",
  sameOrigin,
  asyncRoute(async (req, res) => {
    const { incident, error } = validateIncident(req.body || {});
    if (error) return res.status(400).json({ error });

    const result = await pool.query(
      `INSERT INTO incidents
         (incident_type, description, location, incident_date, severity, reported_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING incident_id AS id`,
      [
        incident.incidentType,
        incident.description,
        incident.location,
        incident.incidentDate,
        incident.severity,
        incident.reportedBy,
        incident.status,
      ],
    );
    res.status(201).json({ id: result.rows[0].id });
  }),
);

app.put(
  "/api/incidents/:id",
  sameOrigin,
  asyncRoute(async (req, res) => {
    const id = parseIncidentId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid incident ID." });

    const { incident, error } = validateIncident(req.body || {});
    if (error) return res.status(400).json({ error });

    const result = await pool.query(
      `UPDATE incidents
       SET incident_type = $1, description = $2, location = $3,
           incident_date = $4, severity = $5, reported_by = $6, status = $7
       WHERE incident_id = $8`,
      [
        incident.incidentType,
        incident.description,
        incident.location,
        incident.incidentDate,
        incident.severity,
        incident.reportedBy,
        incident.status,
        id,
      ],
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Incident not found." });
    res.status(204).end();
  }),
);

app.delete(
  "/api/incidents/:id",
  sameOrigin,
  asyncRoute(async (req, res) => {
    const id = parseIncidentId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid incident ID." });

    const result = await pool.query("DELETE FROM incidents WHERE incident_id = $1", [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Incident not found." });
    res.status(204).end();
  }),
);

app.use(express.static(publicDirectory));
app.get("*", (_req, res) => res.sendFile(path.join(publicDirectory, "index.html")));

app.use((error, _req, res, _next) => {
  console.error("Request failed:", error);
  if (res.headersSent) return;
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Request body must contain valid JSON." });
  }
  res.status(500).json({ error: "The request could not be completed." });
});

async function start() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS incidents (
      incident_id BIGSERIAL PRIMARY KEY,
      incident_type VARCHAR(50) NOT NULL
        CHECK (incident_type IN ('Theft', 'Break-in', 'Trespassing', 'Vandalism', 'Suspicious Activity', 'Fire', 'Other')),
      description VARCHAR(255) NOT NULL,
      location VARCHAR(100) NOT NULL,
      incident_date DATE NOT NULL,
      severity VARCHAR(10) NOT NULL CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
      reported_by VARCHAR(80) NOT NULL,
      status VARCHAR(24) NOT NULL CHECK (status IN ('Open', 'Under Investigation', 'Resolved'))
    )
  `);

  app.listen(port, "0.0.0.0", () => {
    console.log(`Estate Security Incident Log listening on port ${port}.`);
  });
}

start().catch(async (error) => {
  console.error("Could not start the application:", error);
  await pool.end();
  process.exitCode = 1;
});
