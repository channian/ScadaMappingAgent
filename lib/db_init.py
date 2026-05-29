import logging
import os
import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = './database/sigma_tag.db'
log = logging.getLogger(__name__)


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


def ensure_default_admin():
    empno = os.environ.get('DEFAULT_ADMIN_EMPNO', '').strip().upper()
    if not empno:
        return

    conn = get_sqlite_conn()
    exists = conn.execute(
        'SELECT 1 FROM system_permissions WHERE employee_id = ?', (empno,)
    ).fetchone()

    if not exists:
        conn.execute(
            'INSERT INTO system_permissions '
            '(employee_id, is_admin, can_upload, status, last_login, created_at) '
            'VALUES (?, 1, 1, ?, NULL, ?)',
            (empno, 'active', datetime.now().isoformat())
        )
        conn.commit()
        log.info('預設管理員 %s 已自動建立', empno)
    else:
        log.info('預設管理員 %s 已存在，略過建立', empno)

    conn.close()
