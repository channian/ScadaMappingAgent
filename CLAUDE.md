# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SIGMA TAG is a Flask web application for SCADA engineers. Engineers log in via a one-time password (OTP) sent to their company email, upload a CSV/Excel file containing `tag_name` values, and the system queries a PostgreSQL SCADA database to produce a Kepware-importable Excel file.

## Running the App

```bash
# Install dependencies
pip install -r requirements.txt

# Copy and fill in credentials
cp .env.example .env

# Run (auto-initialises SQLite DB on first start)
python app.py
```

The app listens on `0.0.0.0:5000`. SQLite DB is created at `database/sigma_tag.db`; upload temp files land in `tmp/`.

## Environment Variables (`.env`)

| Variable | Purpose |
|---|---|
| `SECRET_KEY` | Flask session signing key |
| `SMTP_SERVER` / `SMTP_PORT` / `SMTP_SENDER` | OTP email delivery |
| `DB_USER` / `DB_PASSWORD` / `DB_DSN` / `DB_NAME` | PostgreSQL (SCADA + employee data) |

## Architecture

### Two databases in use simultaneously

**SQLite** (`database/sigma_tag.db`) — application-owned, managed by `lib/db_init.py`:
- `system_permissions` — which employee IDs may use the system (`is_admin`, `can_upload`, `status`, `last_login`)
- `otp_sessions` — short-lived OTP tokens with expiry timestamps

**PostgreSQL** (shared corporate DB) — read-only, queried via SQLAlchemy:
- `employees` — corporate directory (`empno`, `empname`, `email`, `department_name`) — used in `lib/employee_service.py`
- `scada_iolist_master` — SCADA IO master table — queried in `tag_name_checker.py`

### Login flow

```
POST /api/request_otp
  1. Check system_permissions (SQLite) — reject if missing/suspended
  2. Fetch employee email from PostgreSQL employees table
  3. Generate 6-digit OTP → store in otp_sessions (10 min TTL) → email via SMTP

POST /api/verify_otp
  1. Validate OTP against otp_sessions, delete on success
  2. Write session: employee_id, is_admin, can_upload, name, email
  3. Update last_login + set status = 'active' in system_permissions
```

### Upload flow

`POST /api/upload` (requires `@login_required` + `@upload_required`):
1. Parse CSV/Excel with pandas — requires a `tag_name` column (case-insensitive)
2. Call `tag_name_checker(df)` → queries `scada_iolist_master` via SQLAlchemy
3. Kepware output is written to `tmp/{employee_id}_kepware.xlsx`; error list to `tmp/{employee_id}_errors.csv`
4. Returns up to 500 preview rows to the frontend; full data available via download endpoints

`tag_name_checker.py` returns two DataFrames: `(kepware_df, error_df)`. The Kepware format adds computed columns `Site`, `System`, `SCADA Node Name` (parsed from tag name segments split by `_`), plus empty `專案名稱` and `DataOwner` columns.

### Frontend

Single-page React app (Babel standalone, no build step) served from `templates/index.html`. JSX files live in `static/`:

- `primitives.jsx` — shared `Icon`, `Button`, `Pill` components
- `sigma-login.jsx` — two-step login (empno → OTP)
- `sigma-upload.jsx` — file drop zone, SCADA query trigger, result preview, download
- `sigma-admin.jsx` — user permission management (admin only)

The App component in `templates/index.html` manages top-level view state (`login` → `upload` / `admin`) and calls `POST /api/logout` (which cleans up temp files) before resetting state.

### Auth decorators (`lib/auth.py`)

Three Flask decorators used on API routes:
- `@login_required` — checks `session['employee_id']`
- `@admin_required` — checks `session['is_admin']`
- `@upload_required` — checks `session['can_upload']`

### Roles

| `is_admin` | `can_upload` | Role |
|---|---|---|
| 1 | 1 | admin — upload + manage permissions |
| 0 | 1 | uploader — upload only |

## Key Files

| File | Responsibility |
|---|---|
| `app.py` | All Flask routes and temp-file lifecycle |
| `tag_name_checker.py` | PostgreSQL SCADA query + Kepware DataFrame transformation |
| `mail_sample.py` | `EmailService` wrapper around `smtplib` |
| `lib/db_init.py` | SQLite schema init + `get_sqlite_conn()` |
| `lib/otp_service.py` | OTP generation, storage, verification, expiry cleanup |
| `lib/employee_service.py` | `get_employee_by_empno()` / `get_employees_batch()` |

## Notes

- Root-level `sigma-*.jsx` and `SIGMA TAG.html` are the original design reference files and are **not served by Flask** — the live versions are in `static/` and `templates/`.
- Temp result files (`tmp/`) are deleted on logout or when a new upload overwrites them for the same employee ID.
- Flask session uses cookie storage (4 KB limit) — result data is kept in temp files, not the session.
