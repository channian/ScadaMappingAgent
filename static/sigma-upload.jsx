// SIGMA TAG — Upload page
const { useState: useSU, useEffect: useSUEffect, useRef: useSURef } = React;

function SigmaUpload({ user, onNavigate, onLogout }) {
  const [phase, setPhase] = useSU('idle');
  const [file, setFile] = useSU(null);
  const [drag, setDrag] = useSU(false);
  const [tab, setTab] = useSU('mapped');
  const [proc, setProc] = useSU(0);
  const [sessionLeft, setSessionLeft] = useSU(28 * 60);
  const [rawData, setRawData] = useSU([]);
  const [mappedData, setMappedData] = useSU([]);
  const [errorData, setErrorData] = useSU([]);
  const [rawCount, setRawCount] = useSU(0);
  const [uploadErr, setUploadErr] = useSU('');
  const fileObjRef = useSURef(null);

  useSUEffect(() => {
    const t = setInterval(() => setSessionLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const fmtSize = (b) => b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1024 / 1024).toFixed(2)} MB`;

  const onPick = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.csv,.xls,.xlsx';
    inp.onchange = (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); };
    inp.click();
  };

  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleFile = (f) => {
    fileObjRef.current = f;
    setFile({ name: f.name, size: f.size });
    setPhase('previewing');
    setTab('raw');
    setUploadErr('');
    setRawData([]);
    setMappedData([]);
    setErrorData([]);
  };

  const process = async () => {
    if (!fileObjRef.current) return;
    setProc(0);
    setPhase('processing');
    setUploadErr('');

    // Fake progress animation
    let p = 0;
    const ticker = setInterval(() => {
      p += Math.random() * 12 + 3;
      if (p < 85) setProc(Math.round(p));
    }, 200);

    try {
      const formData = new FormData();
      formData.append('file', fileObjRef.current);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();

      clearInterval(ticker);
      if (!res.ok) {
        setUploadErr(data.error || '上傳失敗');
        setPhase('previewing');
        return;
      }

      setProc(100);
      setRawCount(data.raw_count);
      setRawData(Array.from({ length: data.raw_count }, (_, i) => ({ tag_name: `（共 ${data.raw_count} 筆，詳見下載檔）` })).slice(0, 1));
      setMappedData(data.mapped || []);
      setErrorData(data.errors || []);
      setTimeout(() => { setPhase('done'); setTab('mapped'); }, 300);

    } catch {
      clearInterval(ticker);
      setUploadErr('網路錯誤，請重試');
      setPhase('previewing');
    }
  };

  const reset = () => {
    fileObjRef.current = null;
    setFile(null); setPhase('idle'); setProc(0); setTab('mapped');
    setRawData([]); setMappedData([]); setErrorData([]); setUploadErr('');
  };

  const downloadKepware = () => { window.location.href = '/api/download/kepware'; };
  const downloadErrors  = () => { window.location.href = '/api/download/errors'; };

  return (
    <div className="sigma-app">
      <header className="sigma-top">
        <div className="sigma-brand">
          <div className="sigma-brand-mark"><span className="sym">Σ</span><span className="pulse" /></div>
          <div className="sigma-brand-info"><h1>SIGMA TAG</h1><div className="sub">SCADA · KEPWARE · CONVERTER</div></div>
        </div>
        <nav className="sigma-nav">
          <button className="sigma-nav-btn active"><Icon.upload />轉檔工作區</button>
          {user?.is_admin === 1 && (
            <button className="sigma-nav-btn" onClick={() => onNavigate && onNavigate('admin')}>
              <Icon.users />帳號權限
            </button>
          )}
        </nav>
        <div className="sigma-session">
          <span><span className="who">{user?.name || '工程師'}</span><span style={{color:'var(--line-2)',margin:'0 6px'}}>·</span>{user?.empId}</span>
          <span className="timer">Session {fmt(sessionLeft)}</span>
          <Button variant="ghost" size="sm" icon={<Icon.logout />} onClick={onLogout}>登出</Button>
        </div>
      </header>

      <div className="sigma-upload-page">
        {/* ---- Left: upload + actions ---- */}
        <section className="sigma-upload-main">
          <div className="page-head">
            <h2>上傳 Tag 清單</h2>
            <span className="meta">SCADA → KEPWARE TRANSFORM</span>
          </div>
          <div className="page-sub">
            選擇含 <code>tag_name</code> 欄位的 CSV / Excel，系統會自動到 <code>scada_iolist_master</code> 查 I/O Device、Address、Scale，並產出 Kepware 匯入檔。
          </div>

          <div className={`drop-zone ${drag ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
               onClick={phase === 'idle' ? onPick : undefined}
               onDragOver={e => { e.preventDefault(); setDrag(true); }}
               onDragLeave={() => setDrag(false)}
               onDrop={onDrop}>
            <div className="drop-icon">
              {file ? <Icon.check /> : <Icon.upload />}
              {!file && <span className="scan" />}
            </div>
            {!file && (
              <>
                <div className="drop-title">拖曳檔案到此處</div>
                <div className="drop-hint">或 <span className="link">點擊選擇檔案</span><span className="or">·</span>支援 <b>.csv  .xls  .xlsx</b></div>
                <div className="drop-meta-grid">
                  <div className="drop-meta"><div className="l">REQUIRED COLUMN</div><div className="v" style={{color:'var(--accent-2)'}}>tag_name</div></div>
                  <div className="drop-meta"><div className="l">MAX SIZE</div><div className="v">10 MB</div></div>
                  <div className="drop-meta"><div className="l">MAX ROWS</div><div className="v">50,000</div></div>
                </div>
              </>
            )}
            {file && (
              <>
                <div className="drop-title" style={{color:'#86efac'}}>檔案已選擇</div>
                <div className="drop-hint" style={{color:'var(--fg-2)'}}>
                  <span style={{fontFamily:'var(--font-mono)',color:'var(--fg-1)',fontWeight:600}}>{file.name}</span>
                  <span className="or">·</span>{fmtSize(file.size)}
                </div>
              </>
            )}
          </div>

          <div className="schema-banner">
            <Icon.shield_check />
            <div className="body">
              <h4>FILE SCHEMA · CSV / EXCEL</h4>
              <p>檔案必須包含 <code>tag_name</code> 欄位（不分大小寫）；其他欄位會被忽略。範例：<code>A_1F_AHU01_RetTemp</code>。</p>
            </div>
          </div>

          {uploadErr && (
            <div className="err-line" style={{marginTop: 12}}>
              <Icon.alert />{uploadErr}
            </div>
          )}

          {file && phase === 'previewing' && (
            <div className="action-bar">
              <span className="status">檔案已就緒</span>
              <span className="grow" />
              <Button variant="ghost" size="sm" onClick={reset}>重新選擇</Button>
              <button className="btn btn-primary" onClick={process}>
                <span className="btn-icon"><Icon.play /></span>開始查詢 SCADA
              </button>
            </div>
          )}

          {phase === 'processing' && (
            <div className="proc-progress">
              <div className="spin" />
              <div className="lbl">查詢 <b>scada_iolist_master</b> · 處理中… <b>{proc}%</b></div>
              <div className="bar"><div style={{width: proc + '%'}} /></div>
            </div>
          )}

          {phase === 'done' && (
            <>
              <div className="result-cards">
                <div className="result-card"><div className="l">INPUT ROWS</div><div className="v">{rawCount}</div></div>
                <div className="result-card ok"><div className="l">MAPPED · 找到</div><div className="v">{mappedData.length}</div></div>
                <div className="result-card err"><div className="l">ERROR · 查無</div><div className="v">{errorData.length}</div></div>
                <div className="result-card info">
                  <div className="l">SUCCESS RATE</div>
                  <div className="v">{rawCount > 0 ? Math.round(mappedData.length / rawCount * 100) : 0}%</div>
                </div>
              </div>

              <div className="download-bar">
                <div className="download-tile kepware" onClick={downloadKepware} style={{cursor:'pointer'}}>
                  <div className="ico"><Icon.download /></div>
                  <div className="lbl">
                    <div className="t">下載 Kepware 匯入檔</div>
                    <div className="s">kepware_import.xlsx <span style={{color:'var(--line-2)',margin:'0 6px'}}>·</span> <b>{mappedData.length}</b> 筆</div>
                  </div>
                </div>
                <div className="download-tile error" onClick={errorData.length > 0 ? downloadErrors : undefined}
                     style={{cursor: errorData.length > 0 ? 'pointer' : 'not-allowed', opacity: errorData.length > 0 ? 1 : 0.5}}>
                  <div className="ico"><Icon.alert /></div>
                  <div className="lbl">
                    <div className="t">下載 Error List</div>
                    <div className="s">error_list.csv <span style={{color:'var(--line-2)',margin:'0 6px'}}>·</span> <b>{errorData.length}</b> 筆</div>
                  </div>
                </div>
              </div>

              <div className="action-bar">
                <span className="status">完成 · Session 結束時所有暫存將自動清除</span>
                <span className="grow" />
                <Button variant="ghost" size="sm" onClick={reset}>重新上傳</Button>
              </div>
            </>
          )}
        </section>

        {/* ---- Right: preview ---- */}
        <aside className="sigma-upload-preview">
          <div className="preview-head">
            <h3><Icon.database />檔案內容預覽</h3>
            {file && <Pill kind="info">{file.name.split('.').pop().toUpperCase()}</Pill>}
          </div>

          {!file && (
            <div className="preview-empty">
              <div className="ico"><Icon.upload /></div>
              <div className="t">尚未選擇檔案</div>
              <div className="s">選擇 CSV / Excel 後，此處會顯示轉換結果預覽。</div>
            </div>
          )}

          {file && (
            <>
              <div className="preview-file-info">
                <div className="icon"><Icon.database /></div>
                <div className="meta">
                  <div className="name">{file.name}</div>
                  <div className="sub">
                    {fmtSize(file.size)}
                    {phase === 'done' && <><span className="sep">·</span>{rawCount} → {mappedData.length} 筆</>}
                  </div>
                </div>
              </div>

              <div className="preview-tabs">
                <button className={`preview-tab ${tab === 'mapped' ? 'active' : ''}`}
                        onClick={() => setTab('mapped')} disabled={phase !== 'done'}
                        style={phase !== 'done' ? {opacity:0.4,cursor:'not-allowed'} : {}}>
                  <Icon.check />轉換結果 <span className="count">{phase === 'done' ? mappedData.length : 0}</span>
                </button>
                <button className={`preview-tab ${tab === 'errors' ? 'active' : ''}`}
                        onClick={() => setTab('errors')} disabled={phase !== 'done'}
                        style={phase !== 'done' ? {opacity:0.4,cursor:'not-allowed'} : {}}>
                  <Icon.alert />未匹配 <span className="count">{phase === 'done' ? errorData.length : 0}</span>
                </button>
              </div>

              <div className="preview-table-wrap">
                <div className="preview-table-scroll">
                  {tab === 'mapped' && phase === 'done' && (
                    <table className="preview-table">
                      <thead><tr>
                        <th style={{width:36}}>#</th>
                        <th>Tag Name</th><th>Description</th>
                        <th>I/O Device</th><th>Address</th>
                        <th>Scale</th><th>Raw L/H</th><th>Scaled L/H</th>
                        <th>Site</th><th>System</th><th>SCADA Node</th>
                      </tr></thead>
                      <tbody>
                        {mappedData.map((r, i) => (
                          <tr key={i}>
                            <td className="row-num">{i + 1}</td>
                            <td style={{color:'var(--fg-1)',fontWeight:600}}>{r.tn}</td>
                            <td style={{fontFamily:'var(--font-sans)'}}>{r.desc}</td>
                            <td>{r.dev}</td>
                            <td style={{color:'var(--accent-2)'}}>{r.addr}</td>
                            <td><span className={`b-badge ${r.se === 'YES' ? 'b-create' : 'b-dry'}`}>{r.se}</span></td>
                            <td>{r.rl !== '' ? `${r.rl} / ${r.rh}` : '—'}</td>
                            <td>{r.sl !== '' ? `${r.sl} / ${r.sh}` : '—'}</td>
                            <td>{r.site}</td>
                            <td>{r.sys}</td>
                            <td>{r.node}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {tab === 'errors' && phase === 'done' && (
                    <table className="preview-table">
                      <thead><tr><th style={{width:40}}>#</th><th>tag_name</th><th>原因</th><th>分類</th></tr></thead>
                      <tbody>
                        {errorData.map((r, i) => (
                          <tr key={i} className="row-error">
                            <td className="row-num">{i + 1}</td>
                            <td style={{color:'#fca5a5',fontWeight:600}}>{r.tn}</td>
                            <td style={{fontFamily:'var(--font-sans)',color:'var(--fg-2)'}}>{r.reason}</td>
                            <td><span className="b-badge b-delete">{r.cat}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="preview-foot">
                  <span>
                    {tab === 'mapped' && `顯示 ${mappedData.length} 筆`}
                    {tab === 'errors' && `顯示 ${errorData.length} 筆`}
                  </span>
                  <span>UTF-8</span>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

Object.assign(window, { SigmaUpload });
