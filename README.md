# ⛩️ 日本御神籤探索・Omikuji Database

日本全國御神籤／ゆるみくじ搜尋及收藏網站。

## 第一階段版本

目前這一批檔案先建立：

- Mobile-first 搜尋首頁
- 關鍵字搜尋
- 都道府縣篩選
- 造型／題材篩選
- 材質篩選
- 狀態篩選
- 價格上限
- 排序
- 御神籤詳細資料頁／Modal
- Google Maps 連結欄位
- 我的最愛（localStorage）
- JSON Schema
- 來源優先級及資料規則
- GitHub Pages 可直接部署的靜態網站結構

## 資料夾

```text
/
├── index.html
├── style.css
├── app.js
├── README.md
├── data/
│   ├── omikuji.json
│   ├── schema.json
│   └── sources.json
├── updates/
│   └── changelog.json
└── assets/
    └── favicon.svg
```

## GitHub Pages

1. 將整個資料夾內容上傳到 GitHub repository。
2. Repository → Settings → Pages。
3. Source 選擇 `Deploy from a branch`。
4. Branch 選 `main` / root。
5. 等待 GitHub Pages 發布。

網站不使用 server，因此可直接由 GitHub Pages 讀取 JSON。

## 資料原則

### 1. Accuracy > completeness

資料庫寧願留白，也不應猜測。

### 2. 三個日期必須分開

- `source_published_date`：原始資料來源的刊載日期
- `data_retrieved_date`：資料加入／更新資料庫的日期
- `last_verified_date`：最近一次實際核實目前狀態的日期

### 3. 「曾經有」不等於「現在有」

舊部落格或舊照片只可證明歷史存在。若無近期資料確認，不應標示為 `current_confirmed`。

### 4. 資料來源優先順序

官方網站 → 官方社交平台 → 政府／官方觀光 → 近期可靠照片 → 專門資料庫 → 一般 Blog → 二手／轉售。

### 5. 不刪除歷史資料

如某款御神籤後來停止授與，保留 entry，將狀態改為 `discontinued`，並在 `version_notes` 記錄。

## 下一階段

下一批工作建議建立：

1. 完整 47 都道府縣及造型／日文同義詞搜尋系統
2. 更完整的搜尋解析（例如「京都 兔」「500円以下」）
3. 真實御神籤資料庫第一批資料
4. 圖片來源及版權處理
5. AI 增量更新規格
6. `UPDATE_PROMPT.md`
7. `PROMPT_MASTER.md`
8. 資料驗證／去重／版本更新機制

## 注意

目前 `data/omikuji.json` 是空資料集。這是刻意的：未完成來源核實前，不應以示例資料冒充真實資料。


## 第二階段：搜尋語言層

新增 `data/synonyms.json`，集中管理：

- 47 都道府縣
- 地區
- 中／日／英造型同義詞
- 神佛名稱
- 動物名稱
- 狀態搜尋詞
- 價格搜尋詞

例如：

- `兔` → `兎 / うさぎ / ウサギ / 卯`
- `貓` → `猫 / ねこ / ネコ`
- `龍` → `龍 / 竜 / りゅう / リュウ / 龍神`
- `蛇` → `蛇 / へび / ヘビ / 巳 / 白蛇`
- `京都 兔` → 兩個條件同時搜尋
- `500円以下` → 自動解析為價格上限
- `現在確認` → 映射到 `current_confirmed`

日後新增同義詞時，優先修改 `data/synonyms.json`，而不是直接修改 `app.js`。

### 47 都道府縣資料基礎

47 都道府縣名稱及編號以日本政府／官方資料作為基礎。日本政府資料確認日本有 47 個都道府縣；e-Gov 及北海道政府亦列出完整都道府縣名稱。 
