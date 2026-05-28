import sqlite3
from pathlib import Path

DB_PATH = './database/sigma_tag.db'


def get_sqlite_conn():
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_sqlite_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS system_permissions (
            employee_id  TEXT NOT NULL PRIMARY KEY,
            is_admin     INTEGER NOT NULL DEFAULT 0,
            can_upload   INTEGER NOT NULL DEFAULT 1,
            status       TEXT NOT NULL DEFAULT 'pending',
            last_login   TEXT,
            created_at   TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS otp_sessions (
            employee_id  TEXT NOT NULL PRIMARY KEY,
            otp          TEXT NOT NULL,
            expires_at   TEXT NOT NULL
        );
    """)
    conn.commit()
    conn.close()
