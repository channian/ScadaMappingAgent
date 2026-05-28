import os
from sqlalchemy import create_engine, text


def _get_engine():
    db_user = os.environ.get('DB_USER')
    db_password = os.environ.get('DB_PASSWORD')
    db_dsn = os.environ.get('DB_DSN')
    db_name = os.environ.get('DB_NAME', 'TagSystem')
    return create_engine(f'postgresql+psycopg2://{db_user}:{db_password}@{db_dsn}/{db_name}')


def get_employee_by_empno(empno):
    try:
        engine = _get_engine()
        with engine.connect() as conn:
            result = conn.execute(
                text('SELECT empno, empname, email, department_code, department_name FROM employees WHERE empno = :empno'),
                {'empno': empno}
            ).fetchone()
        return dict(result._mapping) if result else None
    except Exception:
        return None


def get_employees_batch(emp_ids):
    if not emp_ids:
        return {}
    try:
        engine = _get_engine()
        with engine.connect() as conn:
            result = conn.execute(
                text('SELECT empno, empname, email, department_code, department_name FROM employees WHERE empno = ANY(:ids)'),
                {'ids': list(emp_ids)}
            ).fetchall()
        return {row.empno: dict(row._mapping) for row in result}
    except Exception:
        return {}
