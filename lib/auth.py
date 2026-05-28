from functools import wraps
from flask import session, jsonify


def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'employee_id' not in session:
            return jsonify({'error': '請先登入'}), 401
        return f(*args, **kwargs)
    return decorated


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('is_admin'):
            return jsonify({'error': '權限不足'}), 403
        return f(*args, **kwargs)
    return decorated


def upload_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('can_upload'):
            return jsonify({'error': '您沒有上傳權限'}), 403
        return f(*args, **kwargs)
    return decorated
