# SCADA Mapping Agent — 專案設計說明

> 文件建立日期：2026-05-28
> 狀態：架構設計中，前端由使用者準備，後端待實作

---

## 一、系統目的

提供工廠工程師一個安全、一次性的入口，透過上傳含有 `tag_name` 欄位的 CSV / Excel 檔案，自動從 SCADA 資料庫查詢對應的 IO 資訊，並轉換為 Kepware 匯入格式輸出。

---

## 二、整體流程

```
工程師輸入工號
      │
      ▼
查 system_permissions 確認是否有權限
      │
      ├─► 無權限 → 回覆「您沒有使用權限」，流程結束
      │
      ▼
查原始員工 table 取得 email
      │
      ▼
產生 OTP → 寫入 otp_sessions → 寄出 Email
      │
      ▼
工程師收信後輸入 OTP 完成登入
      │
      ▼
依權限角色進入對應功能
      │
      ├─► uploader：上傳 CSV / Excel → 查詢 SCADA → 下載結果
      └─► admin：上傳功能 ＋ 帳號權限管理
      │
      ▼
Session 結束，OTP 失效
```

---

## 三、權限角色定義

| 角色 | 說明 | 可用功能 |
|------|------|----------|
| `uploader` | 一般工程師 | 上傳檔案、查詢 tag、下載結果 |
| `admin` | 管理員 | 上傳功能 ＋ 管理 `system_permissions` 帳號清單 |

---

## 四、模組結構

```
ScadaMappingAgent/
├── app.py                        # Flask 主程式，路由與 Session 管理
├── tag_name_checker.py           # SCADA tag 查詢 + Kepware 格式轉換
├── lib/
│   ├── py_sqlite_manager.py      # SQLite 基礎操作（建表、插入）
│   └── env_management.py         # 環境變數解密
├── database/
│   └── tag_name_checker.db       # SQLite DB
└── templates/
    ├── login.html                # 登入頁（工號輸入 + OTP 輸入，兩步驟）
    ├── upload.html               # 檔案上傳頁（uploader / admin 共用）
    └── admin.html                # 帳號管理頁（admin 專屬）
```

> `guest_account_manager.py` — 舊版手動預建帳號腳本，已不再使用，可移除。

---

## 五、資料庫設計（SQLite）

### Table 1：`system_permissions` — 系統使用權限清單（新建）

> 與原始員工 table 分開維護，只記錄「被授權使用本系統」的工號。

| 欄位 | 型別 | 說明 |
|------|------|------|
| employee_id | TEXT (PK) | 工號，對應原始員工 table |
| is_admin | INTEGER | 1 = 管理員，0 = 一般工程師 |
| can_upload | INTEGER | 1 = 有上傳權限，0 = 無 |

範例資料：
```
employee_id | is_admin | can_upload
A001        |    1     |     1      ← 管理員，可上傳
B002        |    0     |     1      ← 一般工程師，可上傳
C003        |    0     |     0      ← 無任何功能權限（不應存在，或保留供未來擴充）
```

### Table 2：`otp_sessions` — 暫存 OTP（新建，取代舊 `users` table）

| 欄位 | 型別 | 說明 |
|------|------|------|
| employee_id | TEXT (PK) | 工號 |
| otp | TEXT | 一次性密碼 |
| expires_at | TEXT | 過期時間（ISO 格式），建議 15 分鐘 |

> 驗證成功後立即刪除該筆資料，確保 OTP 僅能使用一次。

### 原始員工 Table（唯讀，不修改）

> 由同事提供，欄位含工號、email 等資訊，本系統只做查詢。

---

## 六、登入流程（兩步驟）

```
步驟一：輸入工號
  POST /request_otp
  ├── 查 system_permissions：無資料 → 回傳「您沒有使用權限」
  ├── 查原始員工 table：取得 email
  ├── 產生 OTP，寫入 otp_sessions（含過期時間）
  └── 寄信 → 回傳「OTP 已寄出」

步驟二：輸入 OTP
  POST /verify_otp
  ├── 查 otp_sessions：找不到 → 回傳「OTP 無效」
  ├── 檢查 expires_at：過期 → 回傳「OTP 已過期」
  ├── 驗證 OTP 相符 → 刪除該筆 otp_sessions
  ├── 建立 Session（含 employee_id、is_admin、can_upload）
  └── 依角色導向對應頁面
```

---

## 七、路由規劃

| 方法 | 路由 | 說明 | 權限 |
|------|------|------|------|
| GET | `/login` | 登入頁面 | 公開 |
| POST | `/request_otp` | 輸入工號，寄出 OTP | 公開 |
| POST | `/verify_otp` | 驗證 OTP，建立 Session | 公開 |
| GET | `/` | 上傳頁面（uploader / admin） | 需登入 |
| POST | `/receive_file` | 上傳並處理 tag 檔案 | 需登入 + can_upload |
| GET | `/admin` | 帳號管理頁面 | 需登入 + is_admin |
| POST | `/admin/add_user` | 新增使用者權限 | 需登入 + is_admin |
| POST | `/admin/remove_user` | 移除使用者權限 | 需登入 + is_admin |
| POST | `/logout` | 登出，清除 Session | 需登入 |

---

## 八、tag_name_checker 欄位對照

| SCADA 欄位 | Kepware 欄位 |
|------------|--------------|
| a_tag | Tag Name |
| a_desc | Description |
| a_iodv | I/O DEVICE |
| a_ioad | I/O ADDRESS |
| a_scale_enabled | SCALE Enabled |
| a_scale_rawlow | Raw Low |
| a_scale_rawhigh | Raw High |
| a_scale_low | Scaled Low |
| a_scale_high | Scaled High |

自動解析新增欄位：`Site`、`System`、`SCADA Node Name`
預留空白欄位：`專案名稱`、`DataOwner`

---

## 九、已知問題 / 待修正項目

| # | 問題 | 說明 | 優先度 |
|---|------|------|--------|
| 1 | `receive_file` 缺少登入驗證 | 任何人不需登入即可呼叫上傳 API | 高 |
| 2 | 處理結果未回傳前端 | `kepware_tag_list` 和 `error_tag` 沒有傳給使用者 | 高 |
| 3 | 缺少下載功能 | 工程師無法下載 Kepware 格式 Excel | 高 |
| 4 | OTP 無過期機制 | 舊版 OTP 只要不登入就永遠有效 | 中 |
| 5 | `errol_tag` 拼字錯誤 | 應為 `error_tag` | 低 |

---

## 十、待辦事項（實作順序建議）

- [ ] 確認原始員工 table 的欄位名稱與資料庫位置
- [ ] 取得 SMTP server 資訊（由同事提供程式碼）
- [ ] 前端 HTML 備妥後，核對路由與欄位
- [ ] 建立 `system_permissions` 與 `otp_sessions` table
- [ ] 實作 `/request_otp` 與 `/verify_otp`
- [ ] 加入所有路由的登入 + 權限驗證
- [ ] 實作結果下載功能
- [ ] 實作 admin 帳號管理頁面

---

## 十一、技術依賴

```
Flask
pandas
openpyxl / xlrd     # Excel 讀取
SQLAlchemy
psycopg2            # PostgreSQL 連線
python-dotenv       # 環境變數
smtplib / email     # 寄信（SMTP，程式碼由同事提供）
```

---

## 十二、安全性注意事項

- OTP 有效期限 15 分鐘，過期自動失效
- Session timeout 30 分鐘
- 登入成功後立即刪除 OTP，防止重複使用
- 無權限工號統一回覆「您沒有使用權限」，不揭露是否存在於員工 table
- 所有功能路由需驗證 Session 及對應權限
- 環境變數（DB 帳密）透過加密 `.env.enc` 管理，不可寫入 repo
