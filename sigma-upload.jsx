// SIGMA TAG — Upload page with side-by-side file preview
const { useState: useSU, useEffect: useSUEffect } = React;

// 模擬資料（實際由後端回傳）
const MOCK_RAW = [
  { tag_name: 'A_1F_AHU01_RetTemp' },
  { tag_name: 'A_1F_AHU01_SupTemp' },
  { tag_name: 'A_1F_AHU01_FanSpd' },
  { tag_name: 'A_1F_AHU02_RetTemp' },
  { tag_name: 'A_1F_AHU02_SupTemp' },
  { tag_name: 'A_2F_VAV01_DamperPos' },
  { tag_name: 'A_2F_VAV02_DamperPos' },
  { tag_name: 'B_3F_BLR01_Temp' },
  { tag_name: 'B_3F_BLR01_Pres' },
  { tag_name: 'B_3F_BLR01_FlowRate' },
  { tag_name: 'C_B1_PUMP01_Stat' },
  { tag_name: 'C_B1_PUMP01_Pwr' },
  { tag_name: 'LEGACY_OldTag_001' },
  { tag_name: 'LEGACY_OldTag_002' },
  { tag_name: 'TYPO_AHUX01_ReeTemp' },
];

const MOCK_MAPPED = [
  { tn: 'A_1F_AHU01_RetTemp', desc: '一樓 AHU01 回風溫度', dev: 'iFIX_1F_AHU', addr: 'D00100', se: 'YES', rl: 0, rh: 32767, sl: 0, sh: 100, site: 'A', sys: 'HVAC', node: 'IFIXNode_A' },
  { tn: 'A_1F_AHU01_SupTemp', desc: '一樓 AHU01 送風溫度', dev: 'iFIX_1F_AHU', addr: 'D00102', se: 'YES', rl: 0, rh: 32767, sl: 0, sh: 100, site: 'A', sys: 'HVAC', node: 'IFIXNode_A' },
  { tn: 'A_1F_AHU01_FanSpd',  desc: '一樓 AHU01 風扇轉速', dev: 'iFIX_1F_AHU', addr: 'D00104', se: 'YES', rl: 0, rh: 27648, sl: 0, sh: 50,  site: 'A', sys: 'HVAC', node: 'IFIXNode_A' },
  { tn: 'A_1F_AHU02_RetTemp', desc: '一樓 AHU02 回風溫度', dev: 'iFIX_1F_AHU', addr: 'D00110', se: 'YES', rl: 0, rh: 32767, sl: 0, sh: 100, site: 'A', sys: 'HVAC', node: 'IFIXNode_A' },
  { tn: 'A_1F_AHU02_SupTemp', desc: '一樓 AHU02 送風溫度', dev: 'iFIX_1F_AHU', addr: 'D00112', se: 'YES', rl: 0, rh: 32767, sl: 0, sh: 100, site: 'A', sys: 'HVAC', node: 'IFIXNode_A' },
  { tn: 'A_2F_VAV01_DamperPos', desc: '二樓 VAV01 風門位置', dev: 'iFIX_2F_VAV', addr: 'D00200', se: 'YES', rl: 0, rh: 100, sl: 0, sh: 100, site: 'A', sys: 'HVAC', node: 'IFIXNode_A' },
  { tn: 'A_2F_VAV02_DamperPos', desc: '二樓 VAV02 風門位置', dev: 'iFIX_2F_VAV', addr: 'D00202', se: 'YES', rl: 0, rh: 100, sl: 0, sh: 100, site: 'A', sys: 'HVAC', node: 'IFIXNode_A' },
  { tn: 'B_3F_BLR01_Temp',    desc: '三樓 鍋爐 01 溫度',    dev: 'iFIX_3F_BLR', addr: 'D00300', se: 'YES', rl: 0, rh: 32767, sl: 0, sh: 250, site: 'B', sys: 'Boiler', node: 'IFIXNode_B' },
  { tn: 'B_3F_BLR01_Pres',    desc: '三樓 鍋爐 01 壓力',    dev: 'iFIX_3F_BLR', addr: 'D00302', se: 'YES', rl: 0, rh: 32767, sl: 0, sh: 16,  site: 'B', sys: 'Boiler', node: 'IFIXNode_B' },
  { tn: 'B_3F_BLR01_FlowRate',desc: '三樓 鍋爐 01 流量',    dev: 'iFIX_3F_BLR', addr: 'D00304', se: 'YES', rl: 0, rh: 32767, sl: 0, sh: 500, site: 'B', sys: 'Boiler', node: 'IFIXNode_B' },
  { tn: 'C_B1_PUMP01_Stat',   desc: '地下泵浦 01 狀態',     dev: 'iFIX_B1_PUMP',addr: 'D00400', se: 'NO',  rl: '', rh: '', sl: '', sh: '', site: 'C', sys: 'Pump', node: 'IFIXNode_C' },
  { tn: 'C_B1_PUMP01_Pwr',    desc: '地下泵浦 01 功率',     dev: 'iFIX_B1_PUMP',addr: 'D00402', se: 'YES', rl: 0, rh: 32767, sl: 0, sh: 75,  site: 'C', sys: 'Pump', node: 'IFIXNode_C' },
];

const MOCK_ERRORS = [
  { tn: 'LEGACY_OldTag_001',    reason: 'SCADA 主檔查無此 tag', cat: 'NOT_FOUND' },
  { tn: 'LEGACY_OldTag_002',    reason: 'SCADA 主檔查無此 tag', cat: 'NOT_FOUND' },
  { tn: 'TYPO_AHUX01_ReeTemp',  reason: 'Tag Name 拼字疑似錯誤（無法解析 Site/System）', cat: 'PARSE_ERR' },
];

function SigmaUpload({ user, onNavigate, onLogout }) {
  // phase: 'idle' | 'previewing' | 'processing' | 'done'
  const [phase, setPhase] = useSU('idle');
  const [file,  setFile]  = useSU(null);
  const [drag,  setDrag]  = useSU(false);
  const [tab,   setTab]   = useSU('mapped'); // 'raw' | 'mapped' | 'errors'
  const [proc,  setProc]  = useSU(0);
  const [sessionLeft, setSessionLeft] = useSU(28 * 60);

  // session countdown
  useSUEffect(() => {
    const t = setInterval(() => setSessionLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  // processing animation
  useSUEffect(() => {
    if (phase !== 'processing') return;
    let p = 0;
    const t = setInterval(() => {
      p += Math.random() * 18 + 4;
      if (p >= 100) { p = 100; setProc(100); setTimeout(() => { setPhase('done'); setTab('mapped'); }, 280); clearInterval(t); }
      else setProc(p);
    }, 180);
    return () => clearInterval(t);
  }, [phase]);

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
    setFile({ name: f.name, size: f.size, type: f.type });
    setPhase('previewing');
    setTab('raw');
  };
  const process = () => { setProc(0); setPhase('processing'); };
  const reset = () => { setFile(null); setPhase('idle'); setProc(0); setTab('mapped'); };

  const fmt = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const fmtSize = (b) => b < 1024 ? `${b} B` : b < 1024*1024 ? `${(b/1024).toFixed(1)} KB` : `${(b/1024/1024).toFixed(2)} MB`;

  return (
    <div className="sigma-app">
      {/* topbar */}
      <header className="sigma-top">
        <div className="sigma-brand">
          <div className="sigma-brand-mark">
            <span className="sym">Σ</span>
            <span className="pulse" />
          </div>
          <div className="sigma-brand-info">
            <h1>SIGMA TAG</h1>
            <div className="sub">SCADA · KEPWARE · CONVERTER</div>
          </div>
        </div>
        <nav className="sigma-nav">
          <button className="sigma-nav-btn active">
            <Icon.upload />轉檔工作區
          </button>
          <button className="sigma-nav-btn" onClick={() => onNavigate && onNavigate('admin')}>
            <Icon.users />帳號權限
          </button>
        </nav>
        <div className="sigma-session">
          <span><span className="who">{user?.name || '工程師'}</span> <span style={{color: 'var(--line-2)', margin: '0 6px'}}>·</span> {user?.empId}</span>
          <span className="timer">Session {fmt(sessionLeft)}</span>
          <Button variant="ghost" size="sm" icon={<Icon.logout />} onClick={onLogout}>登出</Button>
        </div>
      </header>

      {/* body */}
      <div className="sigma-upload-page">
        {/* ---- Left: upload + actions + results ---- */}
        <section className="sigma-upload-main">
          <div className="page-head">
            <h2>上傳 Tag 清單</h2>
            <span className="meta">SCADA → KEPWARE TRANSFORM</span>
          </div>
          <div className="page-sub">
            選擇含 <code>tag_name</code> 欄位的 CSV / Excel，系統會自動到 <code>scada_iolist_master</code> 查 I/O Device、Address、Scale，並產出 Kepware 匯入檔。
          </div>

          {/* drop zone */}
          <div className={`drop-zone ${drag ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
               onClick={onPick}
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
                <div className="drop-hint">
                  或 <span className="link">點擊選擇檔案</span>
                  <span className="or">·</span>
                  支援 <b style={{color: 'var(--fg-2)'}}>.csv  .xls  .xlsx</b>
                </div>
                <div className="drop-meta-grid">
                  <div className="drop-meta">
                    <div className="l">REQUIRED COLUMN</div>
                    <div className="v" style={{color: 'var(--accent-2)'}}>tag_name</div>
                  </div>
                  <div className="drop-meta">
                    <div className="l">MAX SIZE</div>
                    <div className="v">10 MB</div>
                  </div>
                  <div className="drop-meta">
                    <div className="l">MAX ROWS</div>
                    <div className="v">50,000</div>
                  </div>
                </div>
              </>
            )}
            {file && (
              <>
                <div className="drop-title" style={{color: '#86efac'}}>檔案已選擇</div>
                <div className="drop-hint" style={{color: 'var(--fg-2)'}}>
                  <span style={{fontFamily: 'var(--font-mono)', color: 'var(--fg-1)', fontWeight: 600}}>{file.name}</span>
                  <span className="or">·</span>{fmtSize(file.size)}
                </div>
              </>
            )}
          </div>

          {/* schema banner */}
          <div className="schema-banner">
            <Icon.shield_check />
            <div className="body">
              <h4>FILE SCHEMA · CSV / EXCEL</h4>
              <p>
                檔案必須包含 <code>tag_name</code> 欄位（不分大小寫）；其他欄位會被忽略。
                範例：<code>A_1F_AHU01_RetTemp</code>、<code>B_3F_BLR01_Temp</code>。
                需要範本？<a style={{color: 'var(--accent-2)', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dashed', textUnderlineOffset: 3}}>下載 CSV 範本</a>
              </p>
            </div>
          </div>

          {/* action bar */}
          {file && phase === 'previewing' && (
            <div className="action-bar">
              <span className="status">檔案已解析 · 偵測到 <b style={{color: 'var(--fg-1)'}}>{MOCK_RAW.length}</b> 筆 tag_name</span>
              <span className="grow" />
              <Button variant="ghost" size="sm" onClick={reset}>重新選擇</Button>
              <Button variant="primary" icon={<Icon.play />} onClick={process}>開始查詢 SCADA</Button>
            </div>
          )}

          {phase === 'processing' && (
            <div className="proc-progress">
              <div className="spin" />
              <div className="lbl">
                查詢 <b>scada_iolist_master</b> · 處理中… <b>{Math.round(proc)}%</b>
              </div>
              <div className="bar"><div style={{width: proc + '%'}} /></div>
            </div>
          )}

          {phase === 'done' && (
            <>
              <div className="result-cards">
                <div className="result-card">
                  <div className="l">INPUT ROWS</div>
                  <div className="v">{MOCK_RAW.length}</div>
                </div>
                <div className="result-card ok">
                  <div className="l">MAPPED · 找到</div>
                  <div className="v">{MOCK_MAPPED.length}</div>
                </div>
                <div className="result-card err">
                  <div className="l">ERROR · 查無</div>
                  <div className="v">{MOCK_ERRORS.length}</div>
                </div>
                <div className="result-card info">
                  <div className="l">SUCCESS RATE</div>
                  <div className="v">{Math.round(MOCK_MAPPED.length / MOCK_RAW.length * 100)}%</div>
                </div>
              </div>

              <div className="download-bar">
                <div className="download-tile kepware">
                  <div className="ico"><Icon.download /></div>
                  <div className="lbl">
                    <div className="t">下載 Kepware 匯入檔</div>
                    <div className="s">kepware_import_{Date.now().toString().slice(-6)}.xlsx <span style={{color: 'var(--line-2)', margin: '0 6px'}}>·</span> <b>{MOCK_MAPPED.length}</b> 筆</div>
                  </div>
                </div>
                <div className="download-tile error">
                  <div className="ico"><Icon.alert /></div>
                  <div className="lbl">
                    <div className="t">下載 Error List</div>
                    <div className="s">error_list_{Date.now().toString().slice(-6)}.csv <span style={{color: 'var(--line-2)', margin: '0 6px'}}>·</span> <b>{MOCK_ERRORS.length}</b> 筆</div>
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

        {/* ---- Right: file content preview ---- */}
        <aside className="sigma-upload-preview">
          <div className="preview-head">
            <h3><Icon.database />檔案內容預覽</h3>
            {file && <Pill kind="info">{file.name.split('.').pop().toUpperCase()}</Pill>}
          </div>

          {!file && (
            <div className="preview-empty">
              <div className="ico"><Icon.upload /></div>
              <div className="t">尚未選擇檔案</div>
              <div className="s">選擇 CSV / Excel 後，此處會顯示原始內容與轉換結果預覽。</div>
            </div>
          )}

          {file && (
            <>
              <div className="preview-file-info">
                <div className="icon"><Icon.database /></div>
                <div className="meta">
                  <div className="name">{file.name}</div>
                  <div className="sub">
                    {fmtSize(file.size)}<span className="sep">·</span>
                    {phase === 'previewing' ? `${MOCK_RAW.length} 筆原始資料` : phase === 'done' ? `${MOCK_RAW.length} → ${MOCK_MAPPED.length} 筆` : '處理中…'}
                    <span className="sep">·</span>UTF-8
                  </div>
                </div>
              </div>

              <div className="preview-tabs">
                <button className={`preview-tab ${tab === 'raw' ? 'active' : ''}`} onClick={() => setTab('raw')}>
                  <Icon.upload />原始檔 <span className="count">{MOCK_RAW.length}</span>
                </button>
                <button className={`preview-tab ${tab === 'mapped' ? 'active' : ''}`}
                        onClick={() => setTab('mapped')}
                        disabled={phase !== 'done'}
                        style={phase !== 'done' ? { opacity: 0.4, cursor: 'not-allowed' } : {}}>
                  <Icon.check />轉換結果 <span className="count">{phase === 'done' ? MOCK_MAPPED.length : 0}</span>
                </button>
                <button className={`preview-tab ${tab === 'errors' ? 'active' : ''}`}
                        onClick={() => setTab('errors')}
                        disabled={phase !== 'done'}
                        style={phase !== 'done' ? { opacity: 0.4, cursor: 'not-allowed' } : {}}>
                  <Icon.alert />未匹配 <span className="count">{phase === 'done' ? MOCK_ERRORS.length : 0}</span>
                </button>
              </div>

              <div className="preview-table-wrap">
                <div className="preview-table-scroll">
                  {tab === 'raw' && (
                    <table className="preview-table">
                      <thead><tr><th style={{width: 40}}>#</th><th>tag_name</th></tr></thead>
                      <tbody>
                        {MOCK_RAW.map((r, i) => (
                          <tr key={i}>
                            <td className="row-num">{i + 1}</td>
                            <td style={{ color: 'var(--fg-1)', fontWeight: 600 }}>{r.tag_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {tab === 'mapped' && phase === 'done' && (
                    <table className="preview-table">
                      <thead><tr>
                        <th style={{width: 36}}>#</th>
                        <th>Tag Name</th><th>Description</th>
                        <th>I/O Device</th><th>Address</th>
                        <th>Scale</th><th>Raw L/H</th><th>Scaled L/H</th>
                        <th>Site</th><th>System</th><th>SCADA Node</th>
                      </tr></thead>
                      <tbody>
                        {MOCK_MAPPED.map((r, i) => (
                          <tr key={i}>
                            <td className="row-num">{i + 1}</td>
                            <td style={{ color: 'var(--fg-1)', fontWeight: 600 }}>{r.tn}</td>
                            <td style={{ fontFamily: 'var(--font-sans)' }}>{r.desc}</td>
                            <td>{r.dev}</td>
                            <td style={{ color: 'var(--accent-2)' }}>{r.addr}</td>
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
                      <thead><tr><th style={{width: 40}}>#</th><th>tag_name</th><th>原因</th><th>分類</th></tr></thead>
                      <tbody>
                        {MOCK_ERRORS.map((r, i) => (
                          <tr key={i} className="row-error">
                            <td className="row-num">{i + 1}</td>
                            <td style={{ color: '#fca5a5', fontWeight: 600 }}>{r.tn}</td>
                            <td style={{ fontFamily: 'var(--font-sans)', color: 'var(--fg-2)' }}>{r.reason}</td>
                            <td><span className="b-badge b-delete">{r.cat}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="preview-foot">
                  <span>
                    {tab === 'raw' && `顯示 ${MOCK_RAW.length} / ${MOCK_RAW.length} 筆`}
                    {tab === 'mapped' && `顯示 ${MOCK_MAPPED.length} / ${MOCK_MAPPED.length} 筆`}
                    {tab === 'errors' && `顯示 ${MOCK_ERRORS.length} / ${MOCK_ERRORS.length} 筆`}
                  </span>
                  <span>UTF-8 · CRLF</span>
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
