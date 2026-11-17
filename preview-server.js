const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const publicDirectory = path.resolve(__dirname, "public");
const sampleIncidents = [
  {
    id: 3,
    incidentType: "Break-in",
    description: "Attempted entry reported near the rear access point.",
    location: "Gate 2, Block C",
    incidentDate: "2025-02-14",
    severity: "High",
    reportedBy: "Amina OBrien",
    status: "Under Investigation",
  },
  {
    id: 2,
    incidentType: "Suspicious Activity",
    description: "Unfamiliar vehicle observed circling the visitor parking area.",
    location: "Visitor parking",
    incidentDate: "2025-02-12",
    severity: "Medium",
    reportedBy: "James Kioi",
    status: "Open",
  },
  {
    id: 1,
    incidentType: "Vandalism",
    description: "Exterior light cover damaged overnight.",
    location: "Block A entrance",
    incidentDate: "2025-02-10",
    severity: "Low",
    reportedBy: "Robinson Kimani",
    status: "Resolved",
  },
];

let nextId = sampleIncidents[0].id + 1;

function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(value === null ? "" : JSON.stringify(value));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 16 * 1024) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON."));
      }
    });
    req.on("error", reject);
  });
}

http
  .createServer(async (req, res) => {
    if (req.url === "/api/session") {
      sendJson(res, 200, { authenticated: true });
      return;
    }
    if (req.url === "/api/incidents" && req.method === "GET") {
      sendJson(res, 200, sampleIncidents);
      return;
    }
    if (req.url === "/api/incidents" && req.method === "POST") {
      try {
        const incident = await readBody(req);
        const created = { ...incident, id: nextId++ };
        sampleIncidents.unshift(created);
        sendJson(res, 201, { id: created.id });
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
      return;
    }

    const incidentMatch = /^\/api\/incidents\/(\d+)$/.exec(req.url || "");
    if (incidentMatch && (req.method === "PUT" || req.method === "DELETE")) {
      const index = sampleIncidents.findIndex(
        (incident) => incident.id === Number(incidentMatch[1]),
      );
      if (index < 0) {
        sendJson(res, 404, { error: "Incident not found." });
        return;
      }
      if (req.method === "DELETE") {
        sampleIncidents.splice(index, 1);
        sendJson(res, 204, null);
        return;
      }
      try {
        const incident = await readBody(req);
        sampleIncidents[index] = { ...incident, id: Number(incidentMatch[1]) };
        sendJson(res, 204, null);
      } catch (error) {
        sendJson(res, 400, { error: error.message });
      }
      return;
    }
    if (req.url?.startsWith("/api/")) {
      sendJson(res, 404, { error: "Preview API route not found." });
      return;
    }

    const requestPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const filePath = path.resolve(
      publicDirectory,
      `.${requestPath === "/" ? "/index.html" : requestPath}`,
    );
    if (!filePath.startsWith(`${publicDirectory}${path.sep}`)) {
      res.statusCode = 403;
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, content) => {
      if (error) {
        res.statusCode = 404;
        res.end("Not found");
        return;
      }
      const contentTypes = {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "text/javascript",
      };
      res.setHeader(
        "Content-Type",
        contentTypes[path.extname(filePath)] || "application/octet-stream",
      );
      res.end(content);
    });
  })
  .listen(4173, "127.0.0.1", () => {
    console.log("Preview ready at http://127.0.0.1:4173");
  });
