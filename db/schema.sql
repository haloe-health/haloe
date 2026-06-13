CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  date_of_birth TEXT,
  first_seen TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS intake_forms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  address TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  how_heard TEXT,
  gp_name TEXT,
  gp_surgery TEXT,
  current_medications TEXT,
  medical_conditions TEXT,
  allergies TEXT,
  recent_surgery TEXT,
  is_pregnant TEXT,
  takes_blood_thinners TEXT,
  insulin_dependent_diabetic TEXT,
  chemo_or_radiotherapy TEXT,
  has_anaemia TEXT,
  bleeding_disorder TEXT,
  infectious_condition TEXT,
  had_hijama_before TEXT,
  consent_treatment INTEGER,
  consent_complementary INTEGER,
  consent_accurate_info INTEGER,
  consent_data_storage INTEGER,
  signature_name TEXT,
  submitted_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  session_date TEXT DEFAULT (datetime('now')),
  treatment TEXT,
  duration TEXT,
  areas_treated TEXT,
  observations TEXT,
  aftercare_given TEXT,
  notes TEXT
);
