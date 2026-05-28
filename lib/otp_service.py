import random
import string
from datetime import datetime, timedelta
from lib.db_init import get_sqlite_conn

OTP_VALID_MINUTES = 10


def generate_otp(length=6):
    return ''.join(random.choices(string.digits, k=length))


def store_otp(employee_id, otp):
    expires_at = (datetime.now() + timedelta(minutes=OTP_VALID_MINUTES)).isoformat()
    conn = get_sqlite_conn()
    conn.execute(
        'INSERT OR REPLACE INTO otp_sessions (employee_id, otp, expires_at) VALUES (?, ?, ?)',
        (employee_id, otp, expires_at)
    )
    conn.commit()
    conn.close()


def verify_otp_code(employee_id, otp):
    conn = get_sqlite_conn()
    row = conn.execute(
        'SELECT otp, expires_at FROM otp_sessions WHERE employee_id = ?',
        (employee_id,)
    ).fetchone()

    if not row:
        conn.close()
        return 'not_found'

    if datetime.now() > datetime.fromisoformat(row['expires_at']):
        conn.execute('DELETE FROM otp_sessions WHERE employee_id = ?', (employee_id,))
        conn.commit()
        conn.close()
        return 'expired'

    if row['otp'] != otp:
        conn.close()
        return 'wrong'

    conn.execute('DELETE FROM otp_sessions WHERE employee_id = ?', (employee_id,))
    conn.commit()
    conn.close()
    return 'ok'


def cleanup_expired_otps():
    conn = get_sqlite_conn()
    conn.execute('DELETE FROM otp_sessions WHERE expires_at < ?', (datetime.now().isoformat(),))
    conn.commit()
    conn.close()
