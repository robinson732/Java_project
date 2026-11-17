const loginView = document.querySelector("#login-view");
const appView = document.querySelector("#app-view");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const incidentForm = document.querySelector("#incident-form");
const incidentRows = document.querySelector("#incident-rows");
const emptyState = document.querySelector("#empty-state");
const notice = document.querySelector("#notice");
const logoutButton = document.querySelector("#logout-button");
const submitButton = document.querySelector("#submit-incident");
const cancelEditButton = document.querySelector("#cancel-edit");
const descriptionField = incidentForm.elements.description;
const descriptionCount = document.querySelector("#description-count");
const dateField = incidentForm.elements.incidentDate;

let incidents = [];
let editingId = null;
let noticeTimeout;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

dateField.max = localDateString();
dateField.value = dateField.max;

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    if (response.status === 401 && url !== "/api/login") {
      showLogin();
    }
    throw new Error(data?.error || "Something went wrong. Please try again.");
  }
  return data;
}

function showLogin() {
  appView.classList.add("hidden");
  loginView.classList.remove("hidden");
  logoutButton.classList.add("hidden");
}

function showApp() {
  loginView.classList.add("hidden");
  appView.classList.remove("hidden");
  logoutButton.classList.remove("hidden");
}

function showNotice(message, isError = false) {
  window.clearTimeout(noticeTimeout);
  notice.textContent = message;
  notice.classList.toggle("notice-error", isError);
  notice.classList.remove("hidden");
  noticeTimeout = window.setTimeout(() => notice.classList.add("hidden"), 5000);
}

function appendCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value;
  row.append(cell);
  return cell;
}

function incidentIcon(incidentType) {
  const icon = document.createElement("span");
  icon.className = `incident-icon${incidentType === "Vandalism" ? " incident-icon-vandalism" : ""}`;
  icon.setAttribute("aria-hidden", "true");

  if (incidentType === "Vandalism") {
    icon.innerHTML = '<svg viewBox="0 0 32 32"><path d="M7 27c1-5 4-8 9-8s8 3 9 8"/><path d="M10 15c0-6 2-10 6-10s6 4 6 10l-2 4H12z"/><path d="M12 14h8l-1 4h-6z"/><path d="m20 21 4-4 3 2-4 5"/><rect x="25" y="12" width="4" height="7" rx="1" transform="rotate(25 27 15)"/><path d="m26 10 3 1"/><path d="M5 8v3m-1.5-1.5h3"/></svg>';
  } else {
    icon.innerHTML = '<svg viewBox="0 0 32 32"><path d="M16 3 27 7v7c0 7-4 12-11 15C9 26 5 21 5 14V7z"/><path d="m11 16 3 3 7-7"/></svg>';
  }
  return icon;
}

function renderIncidents() {
  incidentRows.replaceChildren();
  document.querySelector("#record-count").textContent = String(incidents.length);
  emptyState.classList.toggle("hidden", incidents.length > 0);

  for (const incident of incidents) {
    const row = document.createElement("tr");
    const incidentCell = document.createElement("td");
    incidentCell.className = "incident-cell";
    const incidentName = document.createElement("strong");
    const description = document.createElement("span");
    const icon = incidentIcon(incident.incidentType);
    const details = document.createElement("span");
    details.className = "incident-details";
    incidentName.textContent = incident.incidentType;
    description.className = "table-description";
    description.textContent = incident.description;
    details.append(incidentName, description);
    incidentCell.append(icon, details);
    row.append(incidentCell);

    appendCell(row, incident.location);
    appendCell(
      row,
      new Date(`${incident.incidentDate}T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    );

    const severityCell = appendCell(row, "");
    const severityBadge = document.createElement("span");
    severityBadge.className = `badge badge-${incident.severity.toLowerCase()}`;
    severityBadge.textContent = incident.severity;
    severityCell.append(severityBadge);

    appendCell(row, incident.reportedBy);

    const statusCell = appendCell(row, "");
    const statusBadge = document.createElement("span");
    statusBadge.className = `badge badge-status badge-${incident.status.toLowerCase().replaceAll(" ", "-")}`;
    statusBadge.textContent = incident.status;
    statusCell.append(statusBadge);

    const actions = document.createElement("td");
    actions.className = "row-actions";
    const editButton = document.createElement("button");
    editButton.className = "text-button";
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => beginEdit(incident));
    const deleteButton = document.createElement("button");
    deleteButton.className = "text-button text-button-danger";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => deleteIncident(incident));
    actions.append(editButton, deleteButton);
    row.append(actions);
    incidentRows.append(row);
  }
}

async function loadIncidents() {
  incidents = await request("/api/incidents");
  renderIncidents();
}

function beginEdit(incident) {
  editingId = incident.id;
  for (const [field, value] of Object.entries(incident)) {
    if (field in incidentForm.elements) {
      incidentForm.elements[field].value = value;
    }
  }
  descriptionCount.textContent = String(incident.description.length);
  document.querySelector("#form-title").textContent = `Edit incident #${incident.id}`;
  submitButton.textContent = "Save changes";
  cancelEditButton.classList.remove("hidden");
  incidentForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  editingId = null;
  incidentForm.reset();
  dateField.value = dateField.max;
  descriptionCount.textContent = "0";
  document.querySelector("#form-title").textContent = "New incident";
  submitButton.textContent = "Save incident";
  cancelEditButton.classList.add("hidden");
}

async function deleteIncident(incident) {
  if (!window.confirm(`Delete the ${incident.incidentType} incident at ${incident.location}? This cannot be undone.`)) {
    return;
  }
  try {
    await request(`/api/incidents/${incident.id}`, { method: "DELETE" });
    if (editingId === incident.id) resetForm();
    await loadIncidents();
    showNotice("Incident deleted.");
  } catch (error) {
    showNotice(error.message, true);
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const password = loginForm.elements.password.value;
  try {
    await request("/api/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    loginForm.reset();
    showApp();
  } catch (error) {
    loginError.textContent = error.message;
    return;
  }
  try {
    await loadIncidents();
  } catch (error) {
    showNotice(error.message, true);
  }
});

incidentForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(incidentForm);
  const incident = Object.fromEntries(formData.entries());
  try {
    if (editingId === null) {
      await request("/api/incidents", {
        method: "POST",
        body: JSON.stringify(incident),
      });
      showNotice("Incident saved.");
    } else {
      await request(`/api/incidents/${editingId}`, {
        method: "PUT",
        body: JSON.stringify(incident),
      });
      showNotice("Incident updated.");
    }
    resetForm();
    await loadIncidents();
  } catch (error) {
    showNotice(error.message, true);
  }
});

descriptionField.addEventListener("input", () => {
  descriptionCount.textContent = String(descriptionField.value.length);
});

cancelEditButton.addEventListener("click", resetForm);
document.querySelector("#refresh-button").addEventListener("click", async () => {
  try {
    await loadIncidents();
    showNotice("Reports refreshed.");
  } catch (error) {
    showNotice(error.message, true);
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await request("/api/logout", { method: "POST" });
    showLogin();
  } catch (error) {
    showNotice(error.message, true);
  }
});

async function start() {
  try {
    const session = await request("/api/session");
    if (!session.authenticated) {
      showLogin();
      return;
    }
    showApp();
    await loadIncidents();
  } catch {
    showLogin();
    loginError.textContent = "Could not connect to the incident service. Please refresh the page.";
  }
}

start();
