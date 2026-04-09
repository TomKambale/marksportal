const express = require("express");
const app = express();

app.use(express.json());

// ─── Config ────────────────────────────────────────────────────────────────

// const API_BASE = "https://portal2.ttu.ac.ke";
// const EXAM_BASE = `${API_BASE}/api/exam/v1`;

// const CREDENTIALS = {
//   username: "hostel-checker",
//   password: "rt0[([etx7gvOnSOx4@[CzaAmS][%{",
// };

// ─── Token Cache ────────────────────────────────────────────────────────────

let cachedToken = null;
let tokenExpiresAt = null;

/**
 * Fetches a fresh JWT access token from the auth endpoint and caches it.
 * Re-uses the cached token if it is still valid (with a 60 s safety buffer).
 * @returns {Promise<string>} The access token
 */
async function getAccessToken() {
  const now = Date.now();

  if (cachedToken && tokenExpiresAt && now < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const response = await fetch(`${API_BASE}/api/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(CREDENTIALS),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token request failed (${response.status}): ${text}`);
  }

  const data = await response.json();
  cachedToken = data.access;

  // Standard JWT lifetime is 5 min (300 s). Adjust if your server differs.
  tokenExpiresAt = now + 5 * 60 * 1000;

  console.log("✔  New access token obtained");
  return cachedToken;
}

// ─── Helper ─────────────────────────────────────────────────────────────────

/**
 * Wrapper around fetch that automatically injects the Bearer token and
 * forwards a JSON body for GET requests (some APIs use GET + body).
 *
 * @param {string} path   - Path relative to EXAM_BASE
 * @param {object} body   - JSON body to send
 * @param {string} method - HTTP method (default "GET")
 */
async function apiRequest(path, body = {}, method = "GET") {
  const token = await getAccessToken();

  const options = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  // Attach body for GET requests that expect it, and always for POST/PUT/PATCH
  if (Object.keys(body).length > 0) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${EXAM_BASE}${path}`, options);
  const responseData = await response.json();

  if (!response.ok) {
    const error = new Error(`API error (${response.status})`);
    error.status = response.status;
    error.data = responseData;
    throw error;
  }

  return responseData;
}

// ─── Error handler middleware helper ────────────────────────────────────────

function handleError(res, err) {
  console.error("Error:", err.message);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message,
    details: err.data || null,
  });
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * Health check
 * GET /health
 */
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ────────────────────────────────────────────────────────────────────────────
// Stage 1 – Get Lecturer Details
// GET /lecturer/details
// Body: { email_address, pf_no }
// ────────────────────────────────────────────────────────────────────────────
app.get("/lecturer/details", async (req, res) => {
  const { email_address, pf_no } = req.body;

  if (!email_address || !pf_no) {
    return res
      .status(400)
      .json({ error: "email_address and pf_no are required" });
  }

  try {
    const data = await apiRequest("/lecturer/details", { email_address, pf_no });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Stage 2 – Get Semesters Taught
// GET /lecturer/semesters
// Body: { email_address, pf_no }
// ────────────────────────────────────────────────────────────────────────────
app.get("/lecturer/semesters", async (req, res) => {
  const { email_address, pf_no } = req.body;

  if (!email_address || !pf_no) {
    return res
      .status(400)
      .json({ error: "email_address and pf_no are required" });
  }

  try {
    const data = await apiRequest("/lecturer/semesters", { email_address, pf_no });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Stage 3 – Get Classes for a Semester
// GET /lecturer/classes
// Body: { semester, pf_no }
// ────────────────────────────────────────────────────────────────────────────
app.get("/lecturer/classes", async (req, res) => {
  const { semester, pf_no } = req.body;

  if (!semester || !pf_no) {
    return res
      .status(400)
      .json({ error: "semester and pf_no are required" });
  }

  try {
    const data = await apiRequest("/lecturer/classes", { semester, pf_no });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Stage 4 – Get Student Marks for a Class
// GET /lecturer/class-list/
// Body: { program_code, stage, unit_code }
// ────────────────────────────────────────────────────────────────────────────
app.get("/lecturer/class-list", async (req, res) => {
  const { program_code, stage, unit_code } = req.body;

  if (!program_code || !stage || !unit_code) {
    return res
      .status(400)
      .json({ error: "program_code, stage, and unit_code are required" });
  }

  try {
    const data = await apiRequest("/lecturer/class-list/", {
      program_code,
      stage,
      unit_code,
    });
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Eagerly fetch a token on startup so the first real request is fast
  try {
    await getAccessToken();
  } catch (err) {
    console.warn("⚠  Could not pre-fetch token on startup:", err.message);
  }
});