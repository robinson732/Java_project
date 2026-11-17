const test = require("node:test");
const assert = require("node:assert/strict");
const { parseIncidentId, validateIncident } = require("../src/incident-validation");

function validIncident(overrides = {}) {
  return {
    incidentType: "Theft",
    description: "A bicycle was taken from the courtyard.",
    location: "Block C",
    incidentDate: "2025-02-14",
    severity: "Medium",
    reportedBy: "Amina O'Brien",
    status: "Open",
    ...overrides,
  };
}

test("accepts valid details and trims text fields", () => {
  const result = validateIncident(validIncident({
    description: "  A report  ",
    location: "  Gate 2 ",
    reportedBy: " Guard One ",
  }));
  assert.equal(result.error, undefined);
  assert.equal(result.incident.description, "A report");
  assert.equal(result.incident.location, "Gate 2");
  assert.equal(result.incident.reportedBy, "Guard One");
});

test("rejects malformed, impossible, and future dates", () => {
  assert.match(validateIncident(validIncident({ incidentDate: "2025-2-14" })).error, /date/i);
  assert.match(validateIncident(validIncident({ incidentDate: "2025-02-30" })).error, /date/i);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  assert.match(validateIncident(validIncident({ incidentDate: tomorrow })).error, /future/i);
});

test("enforces field lengths and name characters", () => {
  assert.match(validateIncident(validIncident({ location: "x".repeat(101) })).error, /location/i);
  assert.match(validateIncident(validIncident({ description: "x".repeat(256) })).error, /description/i);
  assert.match(validateIncident(validIncident({ reportedBy: "Guard 7" })).error, /reported by/i);
});

test("rejects values outside the incident options", () => {
  assert.match(validateIncident(validIncident({ incidentType: "Unknown" })).error, /type/i);
  assert.match(validateIncident(validIncident({ severity: "Urgent" })).error, /severity/i);
  assert.match(validateIncident(validIncident({ status: "Pending" })).error, /status/i);
});

test("accepts only positive safe integer incident IDs", () => {
  assert.equal(parseIncidentId("42"), 42);
  assert.equal(parseIncidentId("0"), null);
  assert.equal(parseIncidentId("-1"), null);
  assert.equal(parseIncidentId("1.2"), null);
  assert.equal(parseIncidentId("9007199254740992"), null);
});
