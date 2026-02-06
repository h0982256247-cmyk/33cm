---
name: line-liff
description: LINE LIFF (LINE Front-end Framework) 開發指南 - 在 LINE 內建立網頁應用程式
---

# LINE LIFF (LINE Front-end Framework)

## 概述
LIFF 是 LINE 的前端框架，可以在 LINE 應用程式內開啟網頁，整合 LINE 平台功能如取得用戶資訊、發送訊息、分享內容等。

## 觸發條件
當使用者提到以下關鍵字時觸發：
- "LIFF"
- "LINE 網頁應用"
- "shareTargetPicker"
- "LINE 內嵌網頁"

---

## ⚠️ 關鍵限制

> [!CAUTION]
> **shareTargetPicker 限制：**
> - 最多選擇 **10 個對象**
> - 最多 **5 則訊息**
> - Flex Message 大小限制同 Messaging API
>
> **sendMessages 限制：**
> - 最多 **5 則訊息**
> - **僅限 LINE App 內使用**
>
> 完整限制請參閱 [references/line-limits.md](references/line-limits.md)

---

## 設定 LIFF App

### 1. 在 LINE Developers Console 建立 LIFF App
1. 進入 LINE Developers Console
2. 選擇 Provider > Channel
3. 點擊 "LIFF" 標籤
4. 點擊 "Add" 建立新的 LIFF App

### 2. LIFF Size 設定

| Size | 說明 | 使用場景 |
|------|------|----------|
| `Full` | 全螢幕 | 完整的網頁應用 |
| `Tall` | 約 85% 高度 | 表單、設定頁面 |
| `Compact` | 約 50% 高度 | 快速選擇、確認 |

---

## 安裝與初始化

### 安裝 LIFF SDK
```bash
npm install @line/liff
```

### 初始化 LIFF
```typescript
import liff from '@line/liff';

async function initLiff() {
  try {
    await liff.init({ liffId: 'YOUR_LIFF_ID' });
    
    if (!liff.isLoggedIn()) {
      liff.login();
    }
  } catch (error) {
    console.error('LIFF initialization failed', error);
  }
}
```

> [!IMPORTANT]
> LIFF ID 格式為 `1234567890-xxxxxxxx`，不是完整的 URL。

---

## 核心 API

### 檢查環境
```typescript
// 是否在 LINE App 內
const isInClient = liff.isInClient();

// 是否已登入
const isLoggedIn = liff.isLoggedIn();

// 取得作業系統
const os = liff.getOS(); // 'ios' | 'android' | 'web'

// 取得 LIFF 版本
const version = liff.getVersion();

// 取得語言
const language = liff.getLanguage();
```

### 取得 Access Token
```typescript
const accessToken = liff.getAccessToken();

// 使用 Access Token 呼叫後端 API
const response = await fetch('/api/user', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### 取得用戶資料
```typescript
const profile = await liff.getProfile();

console.log(profile.userId);      // 用戶 ID
console.log(profile.displayName); // 顯示名稱
console.log(profile.pictureUrl);  // 頭像 URL
console.log(profile.statusMessage); // 狀態訊息
```

### 取得用戶 ID Token (含 Email)
```typescript
// 需要在 LIFF 設定中開啟 email scope
const decodedIdToken = liff.getDecodedIDToken();

console.log(decodedIdToken?.email); // 用戶 Email
console.log(decodedIdToken?.name);  // 用戶名稱
```

---

## 發送訊息

### 發送訊息給自己
```typescript
await liff.sendMessages([
  {
    type: 'text',
    text: 'Hello from LIFF!'
  }
]);
```

> [!NOTE]
> `sendMessages` 只能在 LINE App 內使用（`liff.isInClient() === true`）

### 分享給好友 (shareTargetPicker)
```typescript
const result = await liff.shareTargetPicker([
  {
    type: 'text',
    text: '分享給你一個訊息！'
  }
]);

if (result) {
  console.log('分享成功');
} else {
  console.log('使用者取消分享');
}
```

### 分享 Flex Message
```typescript
await liff.shareTargetPicker([
  {
    type: 'flex',
    altText: '商品資訊',
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '精選商品',
            weight: 'bold',
            size: 'xl'
          }
        ]
      }
    }
  }
]);
```

> [!IMPORTANT]
> `shareTargetPicker` 支援的訊息類型：
> - text
> - image
> - video
> - audio
> - location
> - sticker
> - flex (支援 video hero)

---

## 掃描 QR Code
```typescript
const result = await liff.scanCodeV2();
console.log(result.value); // QR Code 內容
```

---

## 開啟外部連結
```typescript
// 在外部瀏覽器開啟
liff.openWindow({
  url: 'https://example.com',
  external: true
});

// 在 LIFF 內開啟
liff.openWindow({
  url: 'https://example.com',
  external: false
});
```

---

## 關閉 LIFF
```typescript
liff.closeWindow();
```

---

## 完整 React 範例

```tsx
import { useEffect, useState } from 'react';
import liff from '@line/liff';

interface Profile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

export default function LiffApp() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeLiff();
  }, []);

  async function initializeLiff() {
    try {
      await liff.init({ liffId: process.env.NEXT_PUBLIC_LIFF_ID! });
      
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }
      
      const userProfile = await liff.getProfile();
      setProfile(userProfile);
      setIsReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  async function handleShare() {
    try {
      const result = await liff.shareTargetPicker([
        {
          type: 'text',
          text: `${profile?.displayName} 分享了一個訊息給你！`
        }
      ]);
      
      if (result) {
        alert('分享成功！');
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  }

  if (error) return <div>Error: {error}</div>;
  if (!isReady) return <div>Loading...</div>;

  return (
    <div>
      <h1>歡迎，{profile?.displayName}</h1>
      {profile?.pictureUrl && (
        <img src={profile.pictureUrl} alt="Profile" />
      )}
      <button onClick={handleShare}>分享給好友</button>
      <button onClick={() => liff.closeWindow()}>關閉</button>
    </div>
  );
}
```

---

## 錯誤處理

| 錯誤碼 | 說明 | 解決方式 |
|--------|------|----------|
| `INIT_FAILED` | 初始化失敗 | 檢查 LIFF ID 是否正確 |
| `INVALID_ARGUMENT` | 參數錯誤 | 檢查傳入的參數格式 |
| `UNAUTHORIZED` | 未授權 | 使用者需要先登入 |
| `FORBIDDEN` | 禁止存取 | 檢查 LIFF 權限設定 |

---

## 最佳實踐

1. **環境判斷**：使用 `liff.isInClient()` 判斷是否在 LINE App 內
2. **錯誤處理**：包裹 try-catch 處理 LIFF API 錯誤
3. **載入狀態**：顯示載入中畫面，避免使用者看到未初始化的內容
4. **降級處理**：在非 LINE 環境提供替代方案

---

## 相關資源
- [LIFF 官方文件](https://developers.line.biz/en/docs/liff/)
- [LIFF v2 API Reference](https://developers.line.biz/en/reference/liff/)
- [LIFF Starter](https://github.com/line/line-liff-v2-starter)
