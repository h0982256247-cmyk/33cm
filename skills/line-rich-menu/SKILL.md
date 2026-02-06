---
name: line-rich-menu
description: LINE Rich Menu (圖文選單) 開發指南 - 包含多層選單、別名切換、使用者綁定
---

# LINE Rich Menu (圖文選單)

## 概述
Rich Menu 是 LINE 官方帳號底部的圖文選單，支援多層切換、使用者個人化設定等功能。本 skill 涵蓋基本選單建立到進階的多層選單實作。

## 觸發條件
當使用者提到以下關鍵字時觸發：
- "Rich Menu"、"圖文選單"
- "多層選單"、"選單切換"
- "richmenu alias"、"選單別名"

---

## ⚠️ 關鍵限制

> [!CAUTION]
> **常見錯誤：**
> - 每帳號最多 **1000 個 Rich Menu**
> - 每帳號最多 **1000 個 Alias**
> - 圖片最大 **1MB**
> - 圖片尺寸 **2500×1686** 或 **2500×843**
> - 最多 **20 個熱區**
> - Alias ID：英數、底線、連字號，1-100 字元
>
> 完整限制請參閱 [references/line-limits.md](references/line-limits.md)

---

## Rich Menu 基礎架構

```
Rich Menu 系統
├── Rich Menu（選單本體）
│   ├── 選單圖片（2500x1686 或 2500x843）
│   ├── 熱區定義（最多 20 個區域）
│   └── Action（點擊動作）
├── Rich Menu Alias（選單別名）
│   └── 用於多層選單切換
└── 使用者綁定
    ├── 預設選單（所有使用者）
    └── 個人選單（特定使用者）
```

---

## API 端點總覽

| 功能 | 方法 | 端點 |
|------|------|------|
| 建立選單 | POST | `/v2/bot/richmenu` |
| 取得選單列表 | GET | `/v2/bot/richmenu/list` |
| 取得單一選單 | GET | `/v2/bot/richmenu/{richMenuId}` |
| 刪除選單 | DELETE | `/v2/bot/richmenu/{richMenuId}` |
| 上傳選單圖片 | POST | `/v2/bot/richmenu/{richMenuId}/content` |
| 下載選單圖片 | GET | `/v2/bot/richmenu/{richMenuId}/content` |
| 設定預設選單 | POST | `/v2/bot/user/all/richmenu/{richMenuId}` |
| 取消預設選單 | DELETE | `/v2/bot/user/all/richmenu` |
| 綁定使用者選單 | POST | `/v2/bot/user/{userId}/richmenu/{richMenuId}` |
| 取消使用者選單 | DELETE | `/v2/bot/user/{userId}/richmenu` |
| 建立別名 | POST | `/v2/bot/richmenu/alias` |
| 取得別名列表 | GET | `/v2/bot/richmenu/alias/list` |
| 刪除別名 | DELETE | `/v2/bot/richmenu/alias/{richMenuAliasId}` |

---

## 選單尺寸規格

### 全尺寸（推薦）
- **圖片尺寸**：2500 x 1686 像素
- **檔案格式**：JPEG 或 PNG
- **檔案大小**：最大 1 MB

### 半尺寸
- **圖片尺寸**：2500 x 843 像素
- **適用場景**：簡單的橫向選單

### 座標系統
```
(0, 0) ─────────────────────────── (2500, 0)
  │                                    │
  │           Rich Menu 區域            │
  │                                    │
(0, 1686) ─────────────────────── (2500, 1686)
```

---

## 建立 Rich Menu

### Rich Menu 物件結構
```typescript
interface RichMenu {
  size: {
    width: 2500;
    height: 1686 | 843;
  };
  selected: boolean;           // 預設是否展開
  name: string;                // 內部名稱（使用者看不到）
  chatBarText: string;         // 聊天欄顯示文字
  areas: RichMenuArea[];       // 熱區定義（最多 20 個）
}

interface RichMenuArea {
  bounds: {
    x: number;      // 左上角 X 座標
    y: number;      // 左上角 Y 座標
    width: number;  // 寬度
    height: number; // 高度
  };
  action: Action;   // 點擊動作
}
```

### 建立選單 API
```typescript
async function createRichMenu(richMenu: RichMenu): Promise<string> {
  const response = await fetch('https://api.line.me/v2/bot/richmenu', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify(richMenu)
  });

  const data = await response.json();
  return data.richMenuId;  // 回傳選單 ID
}
```

### 範例：建立 6 格選單
```typescript
const richMenu: RichMenu = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: "主選單",
  chatBarText: "點擊開啟選單",
  areas: [
    // 第一排
    {
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: { type: "message", text: "功能1" }
    },
    {
      bounds: { x: 833, y: 0, width: 834, height: 843 },
      action: { type: "message", text: "功能2" }
    },
    {
      bounds: { x: 1667, y: 0, width: 833, height: 843 },
      action: { type: "message", text: "功能3" }
    },
    // 第二排
    {
      bounds: { x: 0, y: 843, width: 833, height: 843 },
      action: { type: "message", text: "功能4" }
    },
    {
      bounds: { x: 833, y: 843, width: 834, height: 843 },
      action: { type: "message", text: "功能5" }
    },
    {
      bounds: { x: 1667, y: 843, width: 833, height: 843 },
      action: { type: "message", text: "功能6" }
    }
  ]
};

const richMenuId = await createRichMenu(richMenu);
console.log('Created Rich Menu:', richMenuId);
```

---

## 上傳選單圖片

```typescript
async function uploadRichMenuImage(
  richMenuId: string,
  imageBuffer: Buffer
): Promise<void> {
  const response = await fetch(
    `https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'image/png',  // 或 'image/jpeg'
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: imageBuffer
    }
  );

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }
}

// 使用範例
import fs from 'fs';

const imageBuffer = fs.readFileSync('./rich-menu-image.png');
await uploadRichMenuImage(richMenuId, imageBuffer);
```

---

## 設定預設選單

設定所有使用者看到的預設選單：

```typescript
async function setDefaultRichMenu(richMenuId: string): Promise<void> {
  const response = await fetch(
    `https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Set default failed: ${response.status}`);
  }
}
```

---

## 🌟 多層選單實作 (Rich Menu Alias)

多層選單的核心是使用 **Rich Menu Alias（別名）** 搭配 **richmenuswitch Action**。

### 概念說明
```
使用者看到「主選單」
    ↓ 點擊「更多功能」
透過 richmenuswitch action 切換到別名 "submenu-1"
    ↓
使用者看到「子選單 1」
    ↓ 點擊「返回」
透過 richmenuswitch action 切換回別名 "main-menu"
    ↓
使用者看到「主選單」
```

### 步驟 1：建立所有選單
```typescript
// 建立主選單
const mainMenu: RichMenu = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: "主選單",
  chatBarText: "開啟選單",
  areas: [
    // 前 5 個功能區域...
    {
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: { type: "message", text: "功能1" }
    },
    // ... 其他功能
    
    // 「更多」按鈕 - 切換到子選單
    {
      bounds: { x: 1667, y: 843, width: 833, height: 843 },
      action: {
        type: "richmenuswitch",
        richMenuAliasId: "submenu-more",  // 子選單別名
        data: "action=switch&to=submenu"
      }
    }
  ]
};

// 建立子選單
const subMenu: RichMenu = {
  size: { width: 2500, height: 1686 },
  selected: true,
  name: "子選單",
  chatBarText: "開啟選單",
  areas: [
    // 子選單的功能區域...
    {
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: { type: "message", text: "子功能1" }
    },
    // ... 其他子功能
    
    // 「返回」按鈕 - 切換回主選單
    {
      bounds: { x: 1667, y: 843, width: 833, height: 843 },
      action: {
        type: "richmenuswitch",
        richMenuAliasId: "main-menu",  // 主選單別名
        data: "action=switch&to=main"
      }
    }
  ]
};

const mainMenuId = await createRichMenu(mainMenu);
const subMenuId = await createRichMenu(subMenu);
```

### 步驟 2：上傳選單圖片
```typescript
await uploadRichMenuImage(mainMenuId, mainMenuImageBuffer);
await uploadRichMenuImage(subMenuId, subMenuImageBuffer);
```

### 步驟 3：建立 Rich Menu Alias（別名）

```typescript
interface RichMenuAlias {
  richMenuAliasId: string;  // 別名 ID（自訂，用於 richmenuswitch）
  richMenuId: string;       // 對應的 Rich Menu ID
}

async function createRichMenuAlias(alias: RichMenuAlias): Promise<void> {
  const response = await fetch('https://api.line.me/v2/bot/richmenu/alias', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify(alias)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Create alias failed: ${error}`);
  }
}

// 建立別名
await createRichMenuAlias({
  richMenuAliasId: "main-menu",
  richMenuId: mainMenuId
});

await createRichMenuAlias({
  richMenuAliasId: "submenu-more",
  richMenuId: subMenuId
});
```

> [!IMPORTANT]
> **Rich Menu Alias ID 規則**：
> - 只能使用英文字母、數字、底線、連字號
> - 長度 1-100 字元
> - 必須唯一

### 步驟 4：設定預設選單
```typescript
await setDefaultRichMenu(mainMenuId);
```

---

## richmenuswitch Action 詳解

```typescript
interface RichMenuSwitchAction {
  type: "richmenuswitch";
  richMenuAliasId: string;  // 要切換到的別名
  data: string;             // Postback 資料（必填，會觸發 postback 事件）
}
```

### 處理切換事件（Webhook）
```typescript
async function handlePostback(event: PostbackEvent) {
  const params = new URLSearchParams(event.postback.data);
  const action = params.get('action');
  
  if (action === 'switch') {
    const target = params.get('to');
    console.log(`User switched to menu: ${target}`);
    
    // 可以在這裡記錄使用者的選單切換行為
    await logMenuSwitch(event.source.userId, target);
  }
}
```

> [!NOTE]
> `richmenuswitch` Action 會自動切換選單，不需要你在 Webhook 中手動處理切換邏輯。

---

## 別名管理

### 取得所有別名
```typescript
async function listRichMenuAliases(): Promise<RichMenuAlias[]> {
  const response = await fetch(
    'https://api.line.me/v2/bot/richmenu/alias/list',
    {
      headers: {
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      }
    }
  );

  const data = await response.json();
  return data.aliases;
}
```

### 更新別名指向的選單
```typescript
async function updateRichMenuAlias(
  aliasId: string,
  newRichMenuId: string
): Promise<void> {
  const response = await fetch(
    `https://api.line.me/v2/bot/richmenu/alias/${aliasId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({ richMenuId: newRichMenuId })
    }
  );

  if (!response.ok) {
    throw new Error(`Update alias failed: ${response.status}`);
  }
}
```

### 刪除別名
```typescript
async function deleteRichMenuAlias(aliasId: string): Promise<void> {
  const response = await fetch(
    `https://api.line.me/v2/bot/richmenu/alias/${aliasId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Delete alias failed: ${response.status}`);
  }
}
```

---

## 使用者個人化選單

為特定使用者設定不同的選單：

```typescript
// 為特定使用者綁定選單
async function linkRichMenuToUser(
  userId: string,
  richMenuId: string
): Promise<void> {
  const response = await fetch(
    `https://api.line.me/v2/bot/user/${userId}/richmenu/${richMenuId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Link failed: ${response.status}`);
  }
}

// 取消使用者的個人選單（恢復預設）
async function unlinkRichMenuFromUser(userId: string): Promise<void> {
  const response = await fetch(
    `https://api.line.me/v2/bot/user/${userId}/richmenu`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Unlink failed: ${response.status}`);
  }
}

// 批量綁定多個使用者
async function linkRichMenuToUsers(
  userIds: string[],
  richMenuId: string
): Promise<void> {
  const response = await fetch(
    'https://api.line.me/v2/bot/richmenu/bulk/link',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      body: JSON.stringify({
        richMenuId,
        userIds  // 最多 500 個
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Bulk link failed: ${response.status}`);
  }
}
```

---

## 完整多層選單範例

```typescript
// lib/line/rich-menu.ts

interface CreateMultiLevelMenuOptions {
  mainMenu: {
    name: string;
    image: Buffer;
    areas: RichMenuArea[];
  };
  subMenus: Array<{
    aliasId: string;
    name: string;
    image: Buffer;
    areas: RichMenuArea[];
  }>;
}

async function createMultiLevelRichMenu(
  options: CreateMultiLevelMenuOptions
): Promise<{ mainMenuId: string; subMenuIds: string[] }> {
  const { mainMenu, subMenus } = options;

  // 1. 建立主選單
  const mainMenuId = await createRichMenu({
    size: { width: 2500, height: 1686 },
    selected: true,
    name: mainMenu.name,
    chatBarText: "開啟選單",
    areas: mainMenu.areas
  });
  await uploadRichMenuImage(mainMenuId, mainMenu.image);
  
  // 2. 建立主選單別名
  await createRichMenuAlias({
    richMenuAliasId: "main-menu",
    richMenuId: mainMenuId
  });

  // 3. 建立所有子選單
  const subMenuIds: string[] = [];
  for (const subMenu of subMenus) {
    const subMenuId = await createRichMenu({
      size: { width: 2500, height: 1686 },
      selected: true,
      name: subMenu.name,
      chatBarText: "開啟選單",
      areas: subMenu.areas
    });
    await uploadRichMenuImage(subMenuId, subMenu.image);
    
    // 建立子選單別名
    await createRichMenuAlias({
      richMenuAliasId: subMenu.aliasId,
      richMenuId: subMenuId
    });
    
    subMenuIds.push(subMenuId);
  }

  // 4. 設定主選單為預設
  await setDefaultRichMenu(mainMenuId);

  return { mainMenuId, subMenuIds };
}

// 使用範例
await createMultiLevelRichMenu({
  mainMenu: {
    name: "主選單",
    image: fs.readFileSync('./images/main-menu.png'),
    areas: [
      { bounds: { x: 0, y: 0, width: 1250, height: 843 }, action: { type: "message", text: "商品" } },
      { bounds: { x: 1250, y: 0, width: 1250, height: 843 }, action: { type: "message", text: "訂單" } },
      { bounds: { x: 0, y: 843, width: 1250, height: 843 }, action: { type: "message", text: "客服" } },
      {
        bounds: { x: 1250, y: 843, width: 1250, height: 843 },
        action: { type: "richmenuswitch", richMenuAliasId: "submenu-settings", data: "action=switch&to=settings" }
      }
    ]
  },
  subMenus: [
    {
      aliasId: "submenu-settings",
      name: "設定選單",
      image: fs.readFileSync('./images/settings-menu.png'),
      areas: [
        { bounds: { x: 0, y: 0, width: 833, height: 843 }, action: { type: "message", text: "會員資料" } },
        { bounds: { x: 833, y: 0, width: 834, height: 843 }, action: { type: "message", text: "通知設定" } },
        { bounds: { x: 1667, y: 0, width: 833, height: 843 }, action: { type: "message", text: "語言設定" } },
        {
          bounds: { x: 0, y: 843, width: 2500, height: 843 },
          action: { type: "richmenuswitch", richMenuAliasId: "main-menu", data: "action=switch&to=main" }
        }
      ]
    }
  ]
});
```

---

## 錯誤處理

| 狀態碼 | 說明 | 解決方式 |
|--------|------|----------|
| 400 | 請求格式錯誤 | 檢查 JSON 結構和區域座標 |
| 400 | 圖片尺寸錯誤 | 確認為 2500x1686 或 2500x843 |
| 400 | 別名 ID 重複 | 使用不同的別名 ID |
| 404 | 選單或別名不存在 | 確認 ID 正確 |
| 413 | 圖片檔案過大 | 壓縮至 1MB 以下 |

---

## 最佳實踐

1. **命名規範**：為選單和別名使用有意義的命名（如 `main-menu`、`submenu-settings`）
2. **版本管理**：更新選單時，先建立新選單，更新別名指向，再刪除舊選單
3. **熱區測試**：使用 LINE 的 Rich Menu Maker 測試熱區位置
4. **圖片優化**：使用 PNG-8 或壓縮 JPEG 減少檔案大小
5. **返回按鈕**：所有子選單都應該有返回主選單的按鈕

---

## 相關資源
- [Rich Menu 官方文件](https://developers.line.biz/en/docs/messaging-api/using-rich-menus/)
- [Rich Menu API Reference](https://developers.line.biz/en/reference/messaging-api/#rich-menu)
- [Rich Menu Alias](https://developers.line.biz/en/docs/messaging-api/switch-rich-menus/)
- [LINE Official Account Manager](https://manager.line.biz/) - 視覺化選單編輯
