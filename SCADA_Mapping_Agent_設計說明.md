# SCADA Mapping Agent — 專案設計說明

> 文件建立日期：2026-05-27
> 狀態：待確認事項與同事討論中

---

## 一、系統目的

提供工廠工程師一個安全、一次性的入口，透過上傳含有 `tag_name` 欄位的 CSV / Excel 檔案，自動從 SCADA 資料庫查詢對應的 IO 資訊，並轉換為 Kepware 匯入格式輸出。

---

## 二、整體流程

```
工程師輸入工號
      │
      ▼
系統查詢員工資料庫取得信箱
      │
      ▼
產生一次性密碼（OTP）並寄出 Email
      │
      ▼
工程師輸入 OTP 完成登入
      │
      ▼
上傳 CSV / Excel（需含 tag_name 欄位）
      │
      ▼
後端查詢 PostgreSQL（scada_iolist_master）
      │
      ├─► 找到的 tag → 轉換為 Kepware 格式
      └─► 找不到的 tag → 列為 error list
      │
      ▼
回傳結果 / 提供下載（Kepware Excel + Error List）
      │
      ▼
Session 結束，OTP 失效
```

---

## 三、模組結構

```
ScadaMappingAgent/
├── app.py                        # Flask 主程式，路由與 Session 管理
├── tag_name_checker.py           # SCADA tag 查詢 + Kepware 格式轉換
├── guest_account_manager.py      # 一次性帳號管理（原始版本，待評估是否保留）
├── lib/
│   ├── py_sqlite_manager.py      # SQLite 基礎操作（建表、插入）
│   └── env_management.py         # 環境變數解密
├── database/
│   └── tag_name_checker.db       # SQLite DB（存放 OTP / 員工資料）
└── templates/
    ├── logging.html              # 登入頁面
    └── excel_upload.html         # 檔案上傳頁面
```

---

## 四、資料庫設計（目前 SQLite）

### 現有 Table

#### `users` — 暫存 OTP 帳號
| 欄位 | 型別 | 說明 |
|------|------|------|
| account | TEXT (PK) | 工號 |
| password | TEXT | 一次性密碼（OTP） |

> 登入成功後立即刪除該筆資料，確保 OTP 僅能使用一次。

### 待新增 Table（視確認結果）

#### `employees` — 員工工號與信箱對照（若無其他來源）
| 欄位 | 型別 | 說明 |
|------|------|------|
| employee_id | TEXT (PK) | 工號 |
| email | TEXT | 員工信箱 |
| name | TEXT | 姓名（選填） |

---

## 五、已完成模組說明

### `app.py`
- `GET /login` — 顯示登入頁
- `POST /login_query` — 驗證工號 + OTP，成功後刪除帳號並建立 Session
- `POST /receive_file` — 接收上傳檔案，呼叫 tag_name_checker 處理
- `GET /` — Dashboard（需登入，否則導回登入頁）

### `tag_name_checker.py`
- 連接 PostgreSQL 查詢 `scada_iolist_master` table
- 欄位對照：

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

- 自動從 Tag Name 解析新增欄位：`Site`、`System`、`SCADA Node Name`
- 預留空白欄位：`專案名稱`、`DataOwner`

### `guest_account_manager.py`
- 從 Excel 讀取工程師名單 → 批次產生 OTP → 寫入 SQLite → 匯出 CSV
- 目前為手動執行腳本（非 Web 觸發）

### `lib/py_sqlite_manager.py`
- 基礎 SQLite 操作封裝（建表、批次插入）
- 作為 `GuestAccountManager` 的父類別

---

## 六、已知問題 / 待修正項目

| # | 問題 | 說明 | 優先度 |
|---|------|------|--------|
| 1 | `receive_file` 缺少登入驗證 | 任何人不需登入即可呼叫上傳 API | 高 |
| 2 | 處理結果未回傳前端 | `kepware_tag_list` 和 `error_tag` 沒有傳給使用者看 | 高 |
| 3 | 缺少下載功能 | 工程師無法下載 Kepware 格式 Excel | 高 |
| 4 | `errol_tag` 拼字錯誤 | 應為 `error_tag` | 低 |
| 5 | OTP 無過期機制 | 目前 OTP 只要不登入就永遠有效 | 中 |

---

## 七、待確認事項

### Q1 — 員工資料來源
工號對應信箱的資料，現有資料從哪裡來？

- [ ] A. 已有現成資料庫或 AD（Active Directory），系統直接查詢
- [ ] B. 需要另外建 `employees` table，手動維護
- [ ] C. 從 HR 系統 / Excel 定期匯入

---

### Q2 — 寄信機制
OTP 信件要用哪種方式發送？

- [ ] A. 公司內部 SMTP Server（需提供 host / port）
- [ ] B. Gmail SMTP（需 App Password）
- [ ] C. Office 365 SMTP
- [ ] D. 第三方服務（SendGrid、Mailgun 等）

---

### Q3 — 登入介面流程
登入頁面的互動方式？

- [ ] A. **兩步驟**：第一頁輸入工號 → 系統寄信 → 第二頁輸入 OTP
- [ ] B. **一頁式**：同時輸入工號 + OTP（工程師先去收信再回來填）

---

### Q4 — 原有 `guest_account_manager.py`
更新為 Email 寄送 OTP 後，原本手動預建帳號的腳本是否保留？

- [ ] A. 完全取代，改為 Web 上即時觸發產生並寄出 OTP
- [ ] B. 兩個機制並存（某些情境仍需手動預建）

---

### Q5 — 結果輸出格式
工程師上傳完成後，結果如何呈現？

- [ ] A. 直接在網頁顯示表格
- [ ] B. 提供 Excel 檔案下載
- [ ] C. 兩者都要（網頁預覽 + 下載）

---

## 八、技術依賴

```
Flask
pandas
openpyxl / xlrd     # Excel 讀取
SQLAlchemy
psycopg2            # PostgreSQL 連線
python-dotenv       # 環境變數
smtplib / email     # 寄信（待確認服務後決定是否改用第三方 SDK）
```

---

## 九、安全性注意事項

- OTP 應設定有效期限（建議 10–30 分鐘）
- Session 已設定 30 分鐘 timeout
- 登入成功後立即刪除 OTP，防止重複使用
- 所有 API 路由需加入登入驗證（目前 `/receive_file` 缺少）
- 環境變數（DB 帳密）透過加密 `.env.enc` 管理，不可寫入 repo
