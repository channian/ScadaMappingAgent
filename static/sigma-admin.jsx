// SIGMA TAG — Account & permission management
const { useState: useSA, useEffect: useSAEffect } = React;

const ROLES = {
  admin:    { label: '管理員', kind: 'info',  perms: ['查詢 SCADA', '匯出檔案', '管理帳號'] },
  uploader: { label: '使用者', kind: 'muted', perms: ['查詢 SCADA', '匯出檔案'] },
};

const STATUS = {
  active:    { label: 'ACTIVE',    kind: 'ok' },
  pending:   { label: 'PENDING',   kind: 'warn' },
  suspended: { label: 'SUSPENDED', kind: 'err' },
};

function SigmaAdmin({ user, onNavigate, onLogout }) {
  const [users, setUsers] = useSA([]);
  const [loading, setLoading] = useSA(true);
  const [q, setQ] = useSA('');
  const [filterRole, setFilterRole] = useSA('all');
  const [filterStatus, setFilterStatus] = useSA('all');
  const [showAdd, setShowAdd] = useSA(false);
  const [addMode, setAddMode] = useSA('single');
  const [selected, setSelected] = useSA(new Set());
  const [apiErr, setApiErr] = useSA('');

  const [newEmpId, setNewEmpId] = useSA('');
  const [newRole, setNewRole] = useSA('uploader');
  const [batchText, setBatchText] = useSA('');
  const [addBusy, setAddBusy] = useSA(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) setUsers(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useSAEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter(u => {
    if (filterRole !== 'all' && u.role !== filterRole) return false;
    if (filterStatus !== 'all' && u.status !== filterStatus) return false;
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return u.id.toLowerCase().includes(s) || u.name.includes(q) || u.email.toLowerCase().includes(s) || u.dept.includes(q);
  });

  const stats = {
    total:   users.length,
    active:  users.filter(u => u.status === 'active').length,
    pending: users.filter(u => u.status === 'pending').length,
    admin:   users.filter(u => u.role === 'admin').length,
  };

  const toggleSel = (id) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  };
  const toggleAll = () => {
    setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map(u => u.id)));
  };

  const updateUser = async (id, patch) => {
    setApiErr('');
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setUsers(us => us.map(u => u.id === id ? { ...u, ...patch } : u));
    } else {
      const d = await res.json();
      setApiErr(d.error || '更新失敗');
    }
  };

  const removeUsers = async (ids) => {
    setApiErr('');
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    if (res.ok) {
      setUsers(us => us.filter(u => !ids.includes(u.id)));
      setSelected(new Set());
    } else {
      const d = await res.json();
      setApiErr(d.error || '移除失敗');
    }
  };

  const addUsers = async (emp_ids, role) => {
    setAddBusy(true);
    setApiErr('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employee_ids: emp_ids, role }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchUsers();
        setShowAdd(false);
        setNewEmpId(''); setBatchText(''); setNewRole('uploader');
      } else {
        setApiErr(data.error || '新增失敗');
      }
    } finally {
      setAddBusy(false);
    }
  };

  const addSingle = () => {
    if (!newEmpId.trim()) return;
    addUsers([newEmpId.trim()], newRole);
  };

  const addBatch = () => {
    const ids = batchText.split(/[\s,;\n]+/).map(s => s.trim()).filter(Boolean);
    if (!ids.length) return;
    addUsers(ids, newRole);
  };

  const exportCsv = () => { window.location.href = '/api/admin/export_csv'; };

  return (
    <div className="sigma-app">
      <header className="sigma-top">
        <div className="sigma-brand">
          <div className="sigma-brand-mark"><span className="sym">Σ</span><span className="pulse" /></div>
          <div className="sigma-brand-info"><h1>SIGMA TAG</h1><div className="sub">SCADA · KEPWARE · CONVERTER</div></div>
        </div>
        <nav className="sigma-nav">
          <button className="sigma-nav-btn" onClick={() => onNavigate('upload')}><Icon.upload />轉檔工作區</button>
          <button className="sigma-nav-btn active"><Icon.users />帳號權限</button>
        </nav>
        <div className="sigma-session">
          <span><span className="who">{user?.name || '管理員'}</span><span style={{color:'var(--line-2)',margin:'0 6px'}}>·</span>{user?.empId}</span>
          <Pill kind="info">ADMIN</Pill>
          <Button variant="ghost" size="sm" icon={<Icon.logout />} onClick={onLogout}>登出</Button>
        </div>
      </header>

      <div className="sigma-admin-page">
        <div className="page-head">
          <h2>帳號權限管理</h2>
          <span className="meta">EMPLOYEE ACCESS CONTROL</span>
        </div>
        <div className="page-sub">
          管理可登入 SIGMA TAG 的工號名單。新增工號後，系統會自動從員工目錄同步姓名與信箱；首次登入需驗證 OTP。
        </div>

        {apiErr && <div className="err-line" style={{marginBottom:12}}><Icon.alert />{apiErr}</div>}

        <div className="admin-stats">
          <div className="admin-stat"><div className="l">TOTAL · 全部</div><div className="v">{stats.total}</div></div>
          <div className="admin-stat ok"><div className="l">ACTIVE · 啟用中</div><div className="v">{stats.active}</div></div>
          <div className="admin-stat warn"><div className="l">PENDING · 待啟用</div><div className="v">{stats.pending}</div></div>
          <div className="admin-stat info"><div className="l">ADMINS · 管理員</div><div className="v">{stats.admin}</div></div>
        </div>

        <div className="admin-toolbar">
          <div className="search grow">
            <Icon.search />
            <input className="input" placeholder="搜尋工號 / 姓名 / Email / 部門…"
                   value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <select className="select" value={filterRole} onChange={e => setFilterRole(e.target.value)}>
            <option value="all">全部角色</option>
            <option value="admin">管理員</option>
            <option value="uploader">使用者</option>
          </select>
          <select className="select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="all">全部狀態</option>
            <option value="active">啟用中</option>
            <option value="pending">待啟用</option>
            <option value="suspended">已停用</option>
          </select>
          <Button variant="ghost" size="sm" icon={<Icon.download />} onClick={exportCsv}>匯出 CSV</Button>
          <Button variant="primary" icon={<Icon.plus />} onClick={() => setShowAdd(true)}>新增工號</Button>
        </div>

        {selected.size > 0 && (
          <div className="bulk-bar">
            <span className="bulk-count">已選取 <b>{selected.size}</b> 個工號</span>
            <span className="grow" />
            <Button variant="ghost" size="sm" icon={<Icon.check />}
                    onClick={() => { [...selected].forEach(id => updateUser(id, { status: 'active' })); setSelected(new Set()); }}>啟用</Button>
            <Button variant="ghost" size="sm" icon={<Icon.x />}
                    onClick={() => { [...selected].forEach(id => updateUser(id, { status: 'suspended' })); setSelected(new Set()); }}>停用</Button>
            <Button variant="danger" size="sm" icon={<Icon.trash />} onClick={() => removeUsers([...selected])}>移除</Button>
          </div>
        )}

        <div className="tbl-wrap admin-tbl">
          <table>
            <thead>
              <tr>
                <th style={{width:36}}><input type="checkbox" checked={selected.size > 0 && selected.size === filtered.length} onChange={toggleAll} /></th>
                <th>工號</th><th>姓名</th><th>Email</th><th>部門</th>
                <th>角色</th><th>狀態</th><th>最後登入</th><th>建立日</th>
                <th style={{width:80}}></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} className="tbl-empty">載入中…</td></tr>
              )}
              {!loading && filtered.map(u => (
                <tr key={u.id} className={selected.has(u.id) ? 'row-sel' : ''}>
                  <td><input type="checkbox" checked={selected.has(u.id)} onChange={() => toggleSel(u.id)} /></td>
                  <td className="td-mono" style={{color:'var(--fg-1)',fontWeight:700}}>{u.id}</td>
                  <td>{u.name}</td>
                  <td className="td-mono">{u.email}</td>
                  <td>{u.dept}</td>
                  <td>
                    <select className="role-select" value={u.role}
                            onChange={e => updateUser(u.id, { role: e.target.value })}>
                      {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </td>
                  <td><Pill kind={STATUS[u.status]?.kind || 'muted'}>{STATUS[u.status]?.label || u.status}</Pill></td>
                  <td className="td-mono" style={{color:'var(--fg-3)'}}>{u.lastLogin}</td>
                  <td className="td-mono" style={{color:'var(--fg-3)'}}>{u.created}</td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" title={u.status === 'active' ? '停用' : '啟用'}
                              onClick={() => updateUser(u.id, { status: u.status === 'active' ? 'suspended' : 'active' })}>
                        {u.status === 'active' ? <Icon.x /> : <Icon.check />}
                      </button>
                      <button className="icon-btn danger" title="移除" onClick={() => removeUsers([u.id])}>
                        <Icon.trash />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={10} className="tbl-empty"><Icon.search /><div>沒有符合條件的工號</div></td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pager">
          <span className="info">顯示 {filtered.length} / {users.length} 筆</span>
        </div>

        <div className="perm-matrix">
          <div className="perm-head"><Icon.shield_check /><h3>角色權限對照表</h3></div>
          <div className="perm-grid">
            {Object.entries(ROLES).map(([k, v]) => (
              <div key={k} className="perm-col">
                <div className="perm-title"><Pill kind={v.kind}>{v.label.toUpperCase()}</Pill></div>
                <ul>{v.perms.map((p, i) => <li key={i}><Icon.check />{p}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== Add modal ===== */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal-box admin-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <h3><Icon.plus />新增工號</h3>
              <button className="icon-btn" onClick={() => setShowAdd(false)}><Icon.x /></button>
            </div>

            <div className="mode-tabs">
              <button className={`mode-tab ${addMode === 'single' ? 'active' : ''}`} onClick={() => setAddMode('single')}><Icon.users />單筆新增</button>
              <button className={`mode-tab ${addMode === 'batch' ? 'active' : ''}`} onClick={() => setAddMode('batch')}><Icon.upload />批次新增</button>
            </div>

            {addMode === 'single' && (
              <div className="add-form">
                <div>
                  <div className="lbl">EMPLOYEE ID · 工號 *</div>
                  <input className="big-input" placeholder="例如 E12345"
                         value={newEmpId} onChange={e => setNewEmpId(e.target.value.toUpperCase())} autoFocus />
                  <div className="lf-hint">系統會自動到員工目錄查詢姓名與信箱</div>
                </div>
                <div>
                  <div className="lbl">ROLE · 角色</div>
                  <div className="role-picker">
                    {Object.entries(ROLES).map(([k, v]) => (
                      <button key={k} className={`role-card ${newRole === k ? 'active' : ''}`} onClick={() => setNewRole(k)}>
                        <div className="role-card-head"><Pill kind={v.kind}>{v.label}</Pill>{newRole === k && <Icon.check />}</div>
                        <div className="role-card-perms">{v.perms.join(' · ')}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {addMode === 'batch' && (
              <div className="add-form">
                <div>
                  <div className="lbl">EMPLOYEE IDS · 工號清單</div>
                  <textarea className="batch-input"
                            placeholder={`一行一個工號，或用逗號 / 空格分隔：\nE10023\nE10568\nE12001, E12045`}
                            value={batchText} onChange={e => setBatchText(e.target.value)} />
                  <div className="lf-hint">
                    偵測到 <b style={{color:'var(--accent-2)'}}>{batchText.split(/[\s,;\n]+/).filter(Boolean).length}</b> 個工號 · 已存在的會自動略過
                  </div>
                </div>
                <div>
                  <div className="lbl">DEFAULT ROLE · 預設角色</div>
                  <select className="big-input" value={newRole} onChange={e => setNewRole(e.target.value)}>
                    {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
              </div>
            )}

            {apiErr && <div className="err-line"><Icon.alert />{apiErr}</div>}

            <div className="modal-foot">
              <Button variant="ghost" onClick={() => setShowAdd(false)}>取消</Button>
              <Button variant="primary" icon={<Icon.plus />} disabled={addBusy}
                      onClick={addMode === 'single' ? addSingle : addBatch}>
                {addBusy ? '新增中…' : addMode === 'single' ? '新增工號' : `批次新增 ${batchText.split(/[\s,;\n]+/).filter(Boolean).length} 個工號`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { SigmaAdmin });
