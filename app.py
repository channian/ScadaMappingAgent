import io
import os
import logging
from datetime import datetime, timedelta

import pandas as pd
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request, send_file, session

from lib.auth import admin_required, login_required, upload_required
from lib.db_init import ensure_default_admin, get_sqlite_conn, init_db
from lib.employee_service import get_employee_by_empno, get_employees_batch
from lib.otp_service import cleanup_expired_otps, generate_otp, store_otp, verify_otp_code
from mail_sample import EmailService
from tag_name_checker import tag_name_checker

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-change-in-production')
app.permanent_session_lifetime = timedelta(minutes=30)

TMP_DIR = './tmp'
os.makedirs(TMP_DIR, exist_ok=True)
os.makedirs('./database', exist_ok=True)

init_db()
ensure_default_admin()

logging.basicConfig(level=logging.INFO)


# ── helpers ──────────────────────────────────────────────────────────────────

def _email_service():
    return EmailService(
        smtp_server=os.environ.get('SMTP_SERVER', 'localhost'),
        smtp_port=int(os.environ.get('SMTP_PORT', 25)),
        sender_email=os.environ.get('SMTP_SENDER', 'sigma-tag@company.com'),
        sender_name='SIGMA TAG',
    )


def _result_paths(employee_id):
    safe_id = employee_id.replace('/', '_')
    return (
        os.path.join(TMP_DIR, f'{safe_id}_kepware.xlsx'),
        os.path.join(TMP_DIR, f'{safe_id}_errors.csv'),
    )


def _cleanup_results(employee_id):
    for path in _result_paths(employee_id):
        if os.path.exists(path):
            os.remove(path)


def _mask_email(email):
    at = email.find('@')
    if at <= 1:
        return email
    return email[0] + '**' + email[at - 1:]


# ── pages ─────────────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


# ── auth API ──────────────────────────────────────────────────────────────────

@app.route('/api/session')
def get_session():
    if 'employee_id' not in session:
        return jsonify({'user': None})
    return jsonify({
        'user': {
            'empId':      session['employee_id'],
            'name':       session.get('name', ''),
            'email':      session.get('email', ''),
            'is_admin':   session.get('is_admin', 0),
            'can_upload': session.get('can_upload', 0),
        }
    })


@app.route('/api/request_otp', methods=['POST'])
def request_otp():
    cleanup_expired_otps()
    data = request.get_json() or {}
    empno = data.get('empno', '').strip().upper()
    if not empno:
        return jsonify({'status': 'error', 'message': '請輸入工號'}), 400

    conn = get_sqlite_conn()
    perm = conn.execute(
        'SELECT status FROM system_permissions WHERE employee_id = ?', (empno,)
    ).fetchone()
    conn.close()

    if not perm or perm['status'] == 'suspended':
        return jsonify({'status': 'error', 'message': '您沒有使用權限'}), 403

    employee = get_employee_by_empno(empno)
    if not employee:
        return jsonify({'status': 'error', 'message': '員工資料不存在，請洽 IT'}), 404

    otp = generate_otp()
    store_otp(empno, otp)

    html_body = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#0ea5e9;">SIGMA TAG 一次性登入密碼</h2>
      <p>您好 {employee['empname']}，</p>
      <p>您的一次性密碼（OTP）如下，<strong>10 分鐘內有效</strong>：</p>
      <div style="font-size:36px;font-weight:bold;letter-spacing:12px;color:#0ea5e9;
                  padding:16px;background:#f0f9ff;border-radius:8px;text-align:center;">
        {otp}
      </div>
      <p style="color:#666;font-size:12px;">
        此密碼僅能使用一次，登入後立即失效。若非您本人操作，請忽略此信件。
      </p>
    </div>
    """
    sent = _email_service().send_alert_email(employee['email'], 'SIGMA TAG 登入驗證碼', html_body)
    if not sent:
        return jsonify({'status': 'error', 'message': 'OTP 寄送失敗，請聯繫 IT'}), 500

    return jsonify({'status': 'ok', 'masked_email': _mask_email(employee['email'])})


@app.route('/api/verify_otp', methods=['POST'])
def verify_otp():
    data = request.get_json() or {}
    empno = data.get('empno', '').strip().upper()
    otp = data.get('otp', '').strip()

    result = verify_otp_code(empno, otp)
    msg_map = {
        'not_found': 'OTP 無效，請重新申請',
        'expired':   'OTP 已過期，請重新申請',
        'wrong':     'OTP 不正確',
    }
    if result != 'ok':
        return jsonify({'status': 'error', 'message': msg_map.get(result, '驗證失敗')}), 401

    conn = get_sqlite_conn()
    perm = conn.execute(
        'SELECT is_admin, can_upload FROM system_permissions WHERE employee_id = ?', (empno,)
    ).fetchone()
    conn.execute(
        'UPDATE system_permissions SET last_login = ?, status = ? WHERE employee_id = ?',
        (datetime.now().isoformat(), 'active', empno)
    )
    conn.commit()
    conn.close()

    employee = get_employee_by_empno(empno) or {}
    session.permanent = True
    session['employee_id'] = empno
    session['is_admin'] = int(perm['is_admin'])
    session['can_upload'] = int(perm['can_upload'])
    session['name'] = employee.get('empname', empno)
    session['email'] = employee.get('email', '')

    return jsonify({
        'status': 'ok',
        'user': {
            'empId':      empno,
            'name':       session['name'],
            'email':      session['email'],
            'is_admin':   session['is_admin'],
            'can_upload': session['can_upload'],
        }
    })


@app.route('/api/logout', methods=['POST'])
def logout():
    emp_id = session.get('employee_id')
    if emp_id:
        _cleanup_results(emp_id)
    session.clear()
    return jsonify({'status': 'ok'})


# ── upload API ────────────────────────────────────────────────────────────────

@app.route('/api/upload', methods=['POST'])
@login_required
@upload_required
def upload():
    if 'file' not in request.files:
        return jsonify({'error': '沒有檔案'}), 400

    file = request.files['file']
    if not file.filename:
        return jsonify({'error': '檔名為空'}), 400

    fname = file.filename.lower()
    if not any(fname.endswith(ext) for ext in ('csv', 'xls', 'xlsx')):
        return jsonify({'error': '不支援的檔案格式，請上傳 CSV / XLS / XLSX'}), 400

    try:
        df = pd.read_excel(file) if fname.endswith(('xls', 'xlsx')) else pd.read_csv(file)

        col_lower = {c.lower(): c for c in df.columns}
        if 'tag_name' not in col_lower:
            return jsonify({'error': '檔案缺少 tag_name 欄位'}), 400

        if col_lower['tag_name'] != 'tag_name':
            df = df.rename(columns={col_lower['tag_name']: 'tag_name'})

        df['tag_name'] = df['tag_name'].astype(str).str.strip()
        df = df[df['tag_name'].notna() & (df['tag_name'] != '') & (df['tag_name'] != 'nan')]

        raw_tags = df['tag_name'].tolist()
        kepware_df, error_df = tag_name_checker(df[['tag_name']])

        emp_id = session['employee_id']
        _cleanup_results(emp_id)
        kepware_path, errors_path = _result_paths(emp_id)
        kepware_df.to_excel(kepware_path, index=False)
        error_df[['tag_name']].to_csv(errors_path, index=False, encoding='utf-8-sig')
        session['has_result'] = True

        MAX_PREVIEW = 500

        mapped_records = [
            {
                'tn':   row.get('Tag Name', ''),
                'desc': row.get('Description', ''),
                'dev':  row.get('I/O DEVICE', ''),
                'addr': row.get('I/O ADDRESS', ''),
                'se':   str(row.get('SCALE Enabled', '')),
                'rl':   row.get('Raw Low', ''),
                'rh':   row.get('Raw High', ''),
                'sl':   row.get('Scaled Low', ''),
                'sh':   row.get('Scaled High', ''),
                'site': row.get('Site', ''),
                'sys':  row.get('System', ''),
                'node': row.get('SCADA Node Name', ''),
            }
            for _, row in kepware_df.head(MAX_PREVIEW).iterrows()
        ]

        error_records = [
            {'tn': row['tag_name'], 'reason': 'SCADA 主檔查無此 tag', 'cat': 'NOT_FOUND'}
            for _, row in error_df.head(MAX_PREVIEW).iterrows()
        ]

        return jsonify({
            'status':       'ok',
            'raw_count':    len(raw_tags),
            'mapped_count': len(kepware_df),
            'error_count':  len(error_df),
            'mapped':       mapped_records,
            'errors':       error_records,
        })

    except Exception as e:
        app.logger.error('Upload error: %s', e)
        return jsonify({'error': f'處理失敗：{e}'}), 500


@app.route('/api/download/kepware')
@login_required
def download_kepware():
    kepware_path, _ = _result_paths(session['employee_id'])
    if not os.path.exists(kepware_path):
        return jsonify({'error': '無下載資料，請重新上傳'}), 404
    filename = f"kepware_import_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return send_file(kepware_path, as_attachment=True, download_name=filename)


@app.route('/api/download/errors')
@login_required
def download_errors():
    _, errors_path = _result_paths(session['employee_id'])
    if not os.path.exists(errors_path):
        return jsonify({'error': '無下載資料'}), 404
    filename = f"error_list_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return send_file(errors_path, as_attachment=True, download_name=filename, mimetype='text/csv')


# ── admin API ─────────────────────────────────────────────────────────────────

@app.route('/api/admin/users', methods=['GET'])
@login_required
@admin_required
def admin_get_users():
    conn = get_sqlite_conn()
    perms = conn.execute(
        'SELECT employee_id, is_admin, can_upload, status, last_login, created_at '
        'FROM system_permissions ORDER BY created_at DESC'
    ).fetchall()
    conn.close()

    emp_map = get_employees_batch([p['employee_id'] for p in perms])
    users = []
    for p in perms:
        emp = emp_map.get(p['employee_id'], {})
        users.append({
            'id':        p['employee_id'],
            'name':      emp.get('empname', '（員工資料不存在）'),
            'email':     emp.get('email', ''),
            'dept':      emp.get('department_name', ''),
            'role':      'admin' if p['is_admin'] else 'uploader',
            'status':    p['status'],
            'lastLogin': p['last_login'] or '—',
            'created':   (p['created_at'] or '')[:10],
        })
    return jsonify(users)


@app.route('/api/admin/users', methods=['POST'])
@login_required
@admin_required
def admin_add_users():
    data = request.get_json() or {}
    emp_ids = [i.strip().upper() for i in data.get('employee_ids', []) if i.strip()]
    role = data.get('role', 'uploader')
    is_admin = 1 if role == 'admin' else 0

    if not emp_ids:
        return jsonify({'error': '請提供工號'}), 400

    conn = get_sqlite_conn()
    now = datetime.now().isoformat()
    added = skipped = 0
    for emp_id in emp_ids:
        if conn.execute('SELECT 1 FROM system_permissions WHERE employee_id = ?', (emp_id,)).fetchone():
            skipped += 1
            continue
        conn.execute(
            'INSERT INTO system_permissions (employee_id, is_admin, can_upload, status, last_login, created_at) '
            'VALUES (?, ?, 1, ?, NULL, ?)',
            (emp_id, is_admin, 'pending', now)
        )
        added += 1
    conn.commit()
    conn.close()
    return jsonify({'status': 'ok', 'added': added, 'skipped': skipped})


@app.route('/api/admin/users/<emp_id>', methods=['PUT'])
@login_required
@admin_required
def admin_update_user(emp_id):
    data = request.get_json() or {}
    emp_id = emp_id.upper()
    updates, params = [], []

    if 'role' in data:
        updates.append('is_admin = ?')
        params.append(1 if data['role'] == 'admin' else 0)
    if 'status' in data:
        updates.append('status = ?')
        params.append(data['status'])

    if not updates:
        return jsonify({'error': '沒有要更新的欄位'}), 400

    params.append(emp_id)
    conn = get_sqlite_conn()
    conn.execute(f'UPDATE system_permissions SET {", ".join(updates)} WHERE employee_id = ?', params)
    conn.commit()
    conn.close()
    return jsonify({'status': 'ok'})


@app.route('/api/admin/users', methods=['DELETE'])
@login_required
@admin_required
def admin_remove_users():
    data = request.get_json() or {}
    ids = [i.strip().upper() for i in data.get('ids', []) if i.strip()]
    if not ids:
        return jsonify({'error': '請提供工號'}), 400
    if session.get('employee_id', '').upper() in ids:
        return jsonify({'error': '不能移除自己的帳號'}), 400

    conn = get_sqlite_conn()
    placeholders = ','.join('?' * len(ids))
    conn.execute(f'DELETE FROM system_permissions WHERE employee_id IN ({placeholders})', ids)
    conn.commit()
    conn.close()
    return jsonify({'status': 'ok'})


@app.route('/api/admin/export_csv')
@login_required
@admin_required
def admin_export_csv():
    conn = get_sqlite_conn()
    perms = conn.execute(
        'SELECT employee_id, is_admin, status, last_login, created_at '
        'FROM system_permissions ORDER BY created_at DESC'
    ).fetchall()
    conn.close()

    emp_map = get_employees_batch([p['employee_id'] for p in perms])
    rows = []
    for p in perms:
        emp = emp_map.get(p['employee_id'], {})
        rows.append({
            '工號':     p['employee_id'],
            '姓名':     emp.get('empname', ''),
            'Email':    emp.get('email', ''),
            '部門':     emp.get('department_name', ''),
            '角色':     '管理員' if p['is_admin'] else '使用者',
            '狀態':     p['status'],
            '最後登入': p['last_login'] or '',
            '建立日期': (p['created_at'] or '')[:10],
        })

    buf = io.BytesIO()
    pd.DataFrame(rows).to_csv(buf, index=False, encoding='utf-8-sig')
    buf.seek(0)
    filename = f"sigma_tag_users_{datetime.now().strftime('%Y%m%d')}.csv"
    return send_file(buf, as_attachment=True, download_name=filename, mimetype='text/csv')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
