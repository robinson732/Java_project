CREATE TABLE IF NOT EXISTS incidents (
    incident_id BIGSERIAL PRIMARY KEY,
    incident_type VARCHAR(50) NOT NULL
        CHECK (incident_type IN ('Theft', 'Break-in', 'Trespassing', 'Vandalism', 'Suspicious Activity', 'Fire', 'Other')),
    description VARCHAR(255) NOT NULL,
    location VARCHAR(100) NOT NULL,
    incident_date DATE NOT NULL,
    severity VARCHAR(10) NOT NULL
        CHECK (severity IN ('Low', 'Medium', 'High', 'Critical')),
    reported_by VARCHAR(80) NOT NULL,
    status VARCHAR(24) NOT NULL
        CHECK (status IN ('Open', 'Under Investigation', 'Resolved'))
);
