const allowedTypes = [
  "Theft",
  "Break-in",
  "Trespassing",
  "Vandalism",
  "Suspicious Activity",
  "Fire",
  "Other",
];
const allowedSeverities = ["Low", "Medium", "High", "Critical"];
const allowedStatuses = ["Open", "Under Investigation", "Resolved"];

function validateIncident(body) {
  const incident = {
    incidentType: typeof body.incidentType === "string" ? body.incidentType : "",
    description: typeof body.description === "string" ? body.description.trim() : "",
    location: typeof body.location === "string" ? body.location.trim() : "",
    incidentDate: typeof body.incidentDate === "string" ? body.incidentDate : "",
    severity: typeof body.severity === "string" ? body.severity : "",
    reportedBy: typeof body.reportedBy === "string" ? body.reportedBy.trim() : "",
    status: typeof body.status === "string" ? body.status : "",
  };

  if (!allowedTypes.includes(incident.incidentType)) {
    return { error: "Choose a valid incident type." };
  }
  if (!incident.description || incident.description.length > 255) {
    return { error: "Description is required and must be 255 characters or fewer." };
  }
  if (!incident.location || incident.location.length > 100) {
    return { error: "Location is required and must be 100 characters or fewer." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(incident.incidentDate)) {
    return { error: "Enter a valid incident date." };
  }

  const parsedDate = new Date(`${incident.incidentDate}T00:00:00.000Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== incident.incidentDate
  ) {
    return { error: "Enter a valid incident date." };
  }
  if (incident.incidentDate > new Date().toISOString().slice(0, 10)) {
    return { error: "The incident date cannot be in the future." };
  }
  if (!allowedSeverities.includes(incident.severity)) {
    return { error: "Choose a valid severity." };
  }
  if (
    !incident.reportedBy ||
    incident.reportedBy.length > 80 ||
    !/^[A-Za-z .'-]+$/.test(incident.reportedBy)
  ) {
    return { error: "Reported by must be a name with letters only (up to 80 characters)." };
  }
  if (!allowedStatuses.includes(incident.status)) {
    return { error: "Choose a valid status." };
  }
  return { incident };
}

function parseIncidentId(value) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

module.exports = { parseIncidentId, validateIncident };
