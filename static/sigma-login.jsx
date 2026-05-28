// SIGMA TAG — Login page (2-step: 工號 → OTP)
const { useState: useSL, useRef: useSLRef, useEffect: useSLEffect } = React;

function SigmaLogin({ onSuccess }) {
  const [step, setStep] = useSL('empid');
  const [empId, setEmpId] = useSL('');
  const [email, setEmail] = useSL('');
  const [otp, setOtp] = useSL(['', '', '', '', '', '']);
  const [err, setErr] = useSL('');
  const [busy, setBusy] = useSL(false);
  const [cooldown, setCooldown] = useSL(0);
  const otpRefs = useSLRef([...Array(6)].map(() => React.createRef()));

  useSLEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const requestOtp = async () => {
    setErr('');
    if (!empId.trim()) { setErr('請輸入工號'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/request_otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empno: empId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.message || '發生錯誤');
      } else {
        setEmail(data.masked_email);
        setStep('otp');
        setCooldown(60);
        setTimeout(() => otpRefs.current[0]?.current?.focus(), 80);
      }
    } catch {
      setErr('網路錯誤，請重試');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setErr('');
    const code = otp.join('');
    if (code.length !== 6) { setErr('請輸入完整 6 位數一次性密碼'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/verify_otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empno: empId, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.message || '驗證失敗');
      } else {
        onSuccess(data.user);
      }
    } catch {
      setErr('網路錯誤，請重試');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setCooldown(60);
    setOtp(['', '', '', '', '', '']);
    setErr('');
    setBusy(true);
    try {
      const res = await fetch('/api/request_otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empno: empId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) setErr(data.message || '重發失敗');
    } catch {
      setErr('網路錯誤，請重試');
    } finally {
      setBusy(false);
    }
  };

  const updateOtp = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...otp];
    next[i] = v;
    setOtp(next);
    if (v && i < 5) otpRefs.current[i + 1]?.current?.focus();
  };

  const onOtpKey = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.current?.focus();
    if (e.key === 'Enter') verifyOtp();
  };

  const onOtpPaste = (e) => {
    const t = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
    if (!t) return;
    e.preventDefault();
    const next = [...otp];
    for (let i = 0; i < 6; i++) next[i] = t[i] || '';
    setOtp(next);
    otpRefs.current[Math.min(t.length, 5)]?.current?.focus();
  };

  return (
    <div className="sigma-app">
      <div className="sigma-login">
        {/* ---- Left aside ---- */}
        <aside className="sigma-login-aside">
          <div className="aside-content">
            <div className="aside-mark">
              <div className="big-mark">
                <span className="sym">Σ</span>
                <span className="pulse" />
              </div>
              <div>
                <h2>SIGMA TAG</h2>
                <div className="tag">SCADA · KEPWARE · CONVERTER</div>
              </div>
            </div>

            <div className="aside-hero">
              <h3>把 SCADA Tag 一鍵<br/>轉成 <em>Kepware 匯入檔</em></h3>
              <p>上傳含 <code>tag_name</code> 的 CSV / Excel，系統會從 SCADA iolist 主檔自動補齊 I/O Device、Address、Scale 範圍，產出可直接匯入 Kepware 的格式。</p>
            </div>

            <div className="flow-steps">
              <div className={`flow-step ${step === 'empid' ? 'active' : 'done'}`}>
                <div className="n">{step === 'empid' ? '1' : <Icon.check />}</div>
                <div>
                  <div className="t">輸入工號</div>
                  <div className="s">SYSTEM LOOKS UP EMPLOYEE EMAIL</div>
                </div>
              </div>
              <div className={`flow-step ${step === 'otp' ? 'active' : ''}`}>
                <div className="n">2</div>
                <div>
                  <div className="t">收信、輸入一次性密碼</div>
                  <div className="s">OTP VALID FOR 10 MIN · ONE-TIME USE</div>
                </div>
              </div>
              <div className="flow-step">
                <div className="n">3</div>
                <div>
                  <div className="t">進入轉檔工作區</div>
                  <div className="s">UPLOAD · MAP · DOWNLOAD KEPWARE FILE</div>
                </div>
              </div>
            </div>
          </div>

          <div className="aside-footer">
            <span className="pulse-dot" />
            <span>SIGMA TAG · v1.0.0</span>
            <span style={{ color: 'var(--line-2)' }}>·</span>
            <span>SCADA DB: scada_iolist_master</span>
          </div>
        </aside>

        {/* ---- Right form ---- */}
        <main className="sigma-login-form">
          <div className="sigma-login-card">
            {step === 'empid' && (
              <>
                <div className="head">
                  <div className="step-label"><span className="dot" />STEP 1 / 2 · IDENTIFY</div>
                  <h2>登入 SIGMA TAG</h2>
                  <p className="hint">請輸入您的<b style={{color: 'var(--fg-1)'}}>工號</b>，系統會將一次性密碼寄到您登記的公司信箱。</p>
                </div>

                <div className="form">
                  <div>
                    <div className="lbl">EMPLOYEE ID · 工號</div>
                    <input className="big-input" placeholder="例如 E12345"
                           value={empId}
                           onChange={e => setEmpId(e.target.value.toUpperCase())}
                           onKeyDown={e => { if (e.key === 'Enter') requestOtp(); }}
                           autoFocus />
                  </div>

                  {err && <div className="err-line"><Icon.alert />{err}</div>}

                  <button className="btn btn-primary sigma-btn-large" onClick={requestOtp} disabled={busy}>
                    {busy ? '寄送中…' : '寄送一次性密碼'}
                    <Icon.send />
                  </button>
                </div>

                <div className="security-notes">
                  <div className="item"><Icon.shield />密碼僅一次有效，登入後立即失效；Session 結束即清除。</div>
                  <div className="item"><Icon.link />本系統不儲存您的轉檔資料，所有暫存檔於 Session 結束自動刪除。</div>
                  <div className="item"><Icon.alert />若您的工號無法登入，請洽 IT (#sigma-tag-help)。</div>
                </div>
              </>
            )}

            {step === 'otp' && (
              <>
                <div className="head">
                  <div className="step-label"><span className="dot" />STEP 2 / 2 · VERIFY</div>
                  <h2>輸入一次性密碼</h2>
                  <p className="hint">已寄出 6 位數 OTP 到您的公司信箱，10 分鐘內有效。</p>
                </div>

                <div className="email-sent">
                  <Icon.send />
                  <div>OTP 已寄至 <span className="e">{email}</span></div>
                </div>

                <div className="form">
                  <div>
                    <div className="lbl">ONE-TIME PASSWORD · 6 位數</div>
                    <div className="otp-boxes" onPaste={onOtpPaste}>
                      {otp.map((v, i) => (
                        <input key={i} ref={otpRefs.current[i]}
                               className={`otp-box ${v ? 'filled' : ''}`}
                               maxLength={1} inputMode="numeric"
                               value={v}
                               onChange={e => updateOtp(i, e.target.value)}
                               onKeyDown={e => onOtpKey(i, e)} />
                      ))}
                    </div>
                  </div>

                  {err && <div className="err-line"><Icon.alert />{err}</div>}

                  <div className="sigma-actions">
                    <Button variant="ghost" onClick={() => { setStep('empid'); setOtp(['','','','','','']); setErr(''); }}>返回</Button>
                    <button className="btn btn-primary sigma-btn-large" onClick={verifyOtp} disabled={busy}>
                      {busy ? '驗證中…' : '驗證並登入'}
                      <Icon.check />
                    </button>
                  </div>

                  <div className="helper-row">
                    <span>沒收到信？檢查垃圾信件夾</span>
                    {cooldown > 0
                      ? <span className="cooldown">{cooldown}s 後可重發</span>
                      : <span className="link" onClick={resend}>重新寄送 OTP</span>
                    }
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

Object.assign(window, { SigmaLogin });
