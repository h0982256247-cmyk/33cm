---
name: line-webhook
description: LINE Webhook 開發指南 - 接收和處理 LINE 平台事件
---

# LINE Webhook

## 概述
Webhook 讓你的伺服器能接收來自 LINE 平台的事件，如訊息、追蹤、取消追蹤等，即時回應使用者的互動。

## 觸發條件
當使用者提到以下關鍵字時觸發：
- "Webhook"、"LINE Webhook"
- "事件處理"、"event handler"
- "LINE Bot 後端"

---

## ⚠️ 關鍵限制

> [!CAUTION]
> **Webhook 必須：**
> - **1 秒內回應 HTTP 200**（否則 LINE 會重試）
> - replyToken 有效期約 **1 分鐘**
> - 處理重複事件（LINE 會自動重試失敗的 webhook）
>
> 完整限制請參閱 [references/line-limits.md](references/line-limits.md)

---

## Webhook 設定

### 1. 在 LINE Developers Console 設定
1. 進入 Messaging API Channel
2. 設定 Webhook URL：`https://your-domain.com/api/webhook`
3. 開啟 "Use webhook"
4. 記下 Channel Secret（用於驗證簽名）

### 2. Webhook URL 需求
- 必須是 HTTPS
- 回應時間必須在 1 秒內
- 正確回應 HTTP 200

---

## 驗證 Webhook 簽名

> [!CAUTION]
> **永遠驗證 X-Line-Signature**，確保請求來自 LINE 平台！

```typescript
import crypto from 'crypto';

function validateSignature(
  body: string,
  signature: string,
  channelSecret: string
): boolean {
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64');
  
  return hash === signature;
}
```

---

## 基本 Webhook Handler

### Next.js App Router
```typescript
// app/api/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-line-signature');
  
  // 驗證簽名
  if (!validateSignature(body, signature!, process.env.LINE_CHANNEL_SECRET!)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const { events } = JSON.parse(body);

  // 非同步處理事件（不阻塞回應）
  Promise.all(events.map(handleEvent)).catch(console.error);

  // 立即回應 200
  return NextResponse.json({ success: true });
}

async function handleEvent(event: LineEvent) {
  switch (event.type) {
    case 'message':
      return handleMessage(event);
    case 'follow':
      return handleFollow(event);
    case 'unfollow':
      return handleUnfollow(event);
    case 'postback':
      return handlePostback(event);
    default:
      console.log('Unknown event type:', event.type);
  }
}
```

---

## 事件類型

### Message Event（訊息事件）
使用者發送訊息時觸發

```typescript
interface MessageEvent {
  type: 'message';
  replyToken: string;
  source: {
    type: 'user' | 'group' | 'room';
    userId: string;
    groupId?: string;
    roomId?: string;
  };
  timestamp: number;
  message: {
    id: string;
    type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker';
    text?: string;        // text 類型
    fileName?: string;    // file 類型
    latitude?: number;    // location 類型
    longitude?: number;
    packageId?: string;   // sticker 類型
    stickerId?: string;
  };
}

async function handleMessage(event: MessageEvent) {
  const { message, replyToken } = event;

  if (message.type === 'text') {
    // 回覆文字訊息
    await replyMessage(replyToken, [
      { type: 'text', text: `你說了：${message.text}` }
    ]);
  }
}
```

### Follow Event（追蹤事件）
使用者加入好友時觸發

```typescript
interface FollowEvent {
  type: 'follow';
  replyToken: string;
  source: { type: 'user'; userId: string };
  timestamp: number;
}

async function handleFollow(event: FollowEvent) {
  // 發送歡迎訊息
  await replyMessage(event.replyToken, [
    { type: 'text', text: '歡迎加入！有什麼我可以幫助你的嗎？' }
  ]);
  
  // 記錄新使用者
  await saveNewUser(event.source.userId);
}
```

### Unfollow Event（取消追蹤事件）
使用者封鎖或刪除好友時觸發

```typescript
interface UnfollowEvent {
  type: 'unfollow';
  source: { type: 'user'; userId: string };
  timestamp: number;
}

async function handleUnfollow(event: UnfollowEvent) {
  // 標記使用者已離開
  await markUserInactive(event.source.userId);
}
```

> [!NOTE]
> Unfollow 事件沒有 replyToken，無法回覆訊息。

### Postback Event（Postback 事件）
使用者點擊 Postback 按鈕時觸發

```typescript
interface PostbackEvent {
  type: 'postback';
  replyToken: string;
  source: { type: 'user'; userId: string };
  timestamp: number;
  postback: {
    data: string;
    params?: {
      date?: string;      // 日期選擇器
      time?: string;      // 時間選擇器
      datetime?: string;  // 日期時間選擇器
    };
  };
}

async function handlePostback(event: PostbackEvent) {
  const params = new URLSearchParams(event.postback.data);
  const action = params.get('action');
  
  switch (action) {
    case 'buy':
      const itemId = params.get('itemId');
      await processPurchase(event.source.userId, itemId!);
      await replyMessage(event.replyToken, [
        { type: 'text', text: '購買成功！' }
      ]);
      break;
    
    case 'cancel':
      await replyMessage(event.replyToken, [
        { type: 'text', text: '已取消' }
      ]);
      break;
  }
}
```

### Join/Leave Event（群組事件）
Bot 加入或離開群組/聊天室時觸發

```typescript
interface JoinEvent {
  type: 'join';
  replyToken: string;
  source: {
    type: 'group' | 'room';
    groupId?: string;
    roomId?: string;
  };
  timestamp: number;
}

async function handleJoin(event: JoinEvent) {
  await replyMessage(event.replyToken, [
    { type: 'text', text: '大家好！我是機器人，請多指教！' }
  ]);
}
```

---

## 取得媒體內容

當使用者發送圖片、影片、音訊或檔案時：

```typescript
async function getMessageContent(messageId: string): Promise<Buffer> {
  const response = await fetch(
    `https://api-data.line.me/v2/bot/message/${messageId}/content`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get content: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// 處理圖片訊息
async function handleImageMessage(event: MessageEvent) {
  const imageBuffer = await getMessageContent(event.message.id);
  
  // 儲存圖片
  const imageUrl = await uploadToStorage(imageBuffer, 'image/jpeg');
  
  await replyMessage(event.replyToken, [
    { type: 'text', text: `已收到圖片！` }
  ]);
}
```

---

## 取得使用者資料

```typescript
async function getUserProfile(userId: string) {
  const response = await fetch(
    `https://api.line.me/v2/bot/profile/${userId}`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get profile: ${response.status}`);
  }

  return response.json();
}
```

---

## 完整範例：Echo Bot

```typescript
// app/api/webhook/route.ts

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET!;
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('x-line-signature')!;

  // 驗證簽名
  const hash = crypto
    .createHmac('SHA256', CHANNEL_SECRET)
    .update(body)
    .digest('base64');

  if (hash !== signature) {
    console.error('Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const { events } = JSON.parse(body);

  // 處理所有事件
  await Promise.all(events.map(async (event: any) => {
    if (event.type === 'message' && event.message.type === 'text') {
      await replyMessage(event.replyToken, [
        {
          type: 'text',
          text: `Echo: ${event.message.text}`
        }
      ]);
    }
  }));

  return NextResponse.json({ success: true });
}

async function replyMessage(replyToken: string, messages: any[]) {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
    },
    body: JSON.stringify({ replyToken, messages })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Reply failed:', error);
  }
}
```

---

## 錯誤處理與重試

```typescript
async function handleEventWithRetry(event: LineEvent, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await handleEvent(event);
      return;
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i === retries - 1) throw error;
      await sleep(1000 * Math.pow(2, i)); // 指數退避
    }
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

---

## 最佳實踐

1. **快速回應**：Webhook 必須在 1 秒內回應 200，長時間處理應放到背景
2. **驗證簽名**：永遠驗證 X-Line-Signature
3. **冪等處理**：同一事件可能被發送多次，需處理重複
4. **錯誤日誌**：詳細記錄錯誤以便除錯
5. **使用 Queue**：大量事件時使用訊息佇列處理

---

## 相關資源
- [Webhook 官方文件](https://developers.line.biz/en/docs/messaging-api/receiving-messages/)
- [Webhook Event Objects](https://developers.line.biz/en/reference/messaging-api/#webhook-event-objects)
- [Signature Validation](https://developers.line.biz/en/docs/messaging-api/receiving-messages/#verifying-signatures)
