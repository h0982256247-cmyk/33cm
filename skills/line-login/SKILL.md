---
name: line-login
description: LINE Login 開發指南 - 實作社群登入功能
---

# LINE Login

## 概述
LINE Login 讓使用者可以用 LINE 帳號登入你的網站或應用程式，取得使用者的基本資料和存取權限。

## 觸發條件
當使用者提到以下關鍵字時觸發：
- "LINE Login"、"LINE 登入"
- "社群登入"、"Social Login"
- "OAuth"、"LINE OAuth"

---

## OAuth 2.0 流程

```
使用者 → 你的網站 → LINE Login → 授權頁面 → 回調 → 取得 Token → 取得用戶資料
```

### 流程說明
1. 使用者點擊「用 LINE 登入」
2. 重導向到 LINE 授權頁面
3. 使用者同意授權
4. LINE 重導向回你的網站（帶 authorization code）
5. 後端用 code 換取 access token
6. 用 access token 取得用戶資料

---

## 設定 LINE Login Channel

### 1. 建立 Channel
1. 前往 [LINE Developers Console](https://developers.line.biz/console/)
2. 選擇 Provider
3. 建立新的 "LINE Login" Channel

### 2. 設定 Callback URL
在 Channel 設定中加入你的 Callback URL：
```
https://your-domain.com/api/auth/callback/line
```

### 3. 取得憑證
- Channel ID
- Channel Secret

---

## 前端實作

### 產生授權 URL
```typescript
function getLineLoginUrl() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINE_CHANNEL_ID!,
    redirect_uri: 'https://your-domain.com/api/auth/callback/line',
    state: generateRandomState(), // CSRF 防護
    scope: 'profile openid email',
    nonce: generateRandomNonce()
  });

  return `https://access.line.me/oauth2/v2.1/authorize?${params}`;
}
```

### 登入按鈕
```tsx
function LineLoginButton() {
  const handleLogin = () => {
    window.location.href = getLineLoginUrl();
  };

  return (
    <button onClick={handleLogin}>
      用 LINE 登入
    </button>
  );
}
```

---

## 後端實作

### 處理 Callback
```typescript
// /api/auth/callback/line

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  // 驗證 state 防止 CSRF
  if (!validateState(state)) {
    return NextResponse.redirect('/login?error=invalid_state');
  }

  try {
    // 用 code 換取 token
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code!,
        redirect_uri: 'https://your-domain.com/api/auth/callback/line',
        client_id: process.env.LINE_CHANNEL_ID!,
        client_secret: process.env.LINE_CHANNEL_SECRET!
      })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error_description);
    }

    // 取得用戶資料
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    const profile = await profileResponse.json();

    // 建立或更新使用者
    const user = await upsertUser({
      lineUserId: profile.userId,
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl,
      email: decodeIdToken(tokenData.id_token)?.email
    });

    // 建立 session
    const session = await createSession(user.id);

    return NextResponse.redirect('/', {
      headers: {
        'Set-Cookie': `session=${session.token}; HttpOnly; Secure; SameSite=Lax`
      }
    });
  } catch (error) {
    console.error('LINE Login error:', error);
    return NextResponse.redirect('/login?error=auth_failed');
  }
}
```

### 解碼 ID Token
```typescript
import jwt from 'jsonwebtoken';

interface LineIdToken {
  iss: string;
  sub: string;       // 用戶 ID
  aud: string;       // Channel ID
  exp: number;
  iat: number;
  nonce: string;
  name?: string;
  picture?: string;
  email?: string;
}

function decodeIdToken(idToken: string): LineIdToken | null {
  try {
    // 驗證並解碼 ID Token
    const decoded = jwt.verify(idToken, process.env.LINE_CHANNEL_SECRET!, {
      algorithms: ['HS256'],
      audience: process.env.LINE_CHANNEL_ID!,
      issuer: 'https://access.line.me'
    }) as LineIdToken;

    return decoded;
  } catch (error) {
    console.error('ID Token verification failed:', error);
    return null;
  }
}
```

---

## 使用 NextAuth.js

更簡單的方式是使用 NextAuth.js：

### 安裝
```bash
npm install next-auth
```

### 設定
```typescript
// app/api/auth/[...nextauth]/route.ts

import NextAuth from 'next-auth';
import LineProvider from 'next-auth/providers/line';

const handler = NextAuth({
  providers: [
    LineProvider({
      clientId: process.env.LINE_CHANNEL_ID!,
      clientSecret: process.env.LINE_CHANNEL_SECRET!
    })
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.lineUserId = profile?.sub;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.lineUserId = token.lineUserId;
      return session;
    }
  }
});

export { handler as GET, handler as POST };
```

### 使用
```tsx
'use client';

import { signIn, signOut, useSession } from 'next-auth/react';

export default function LoginPage() {
  const { data: session } = useSession();

  if (session) {
    return (
      <div>
        <p>歡迎，{session.user?.name}</p>
        <button onClick={() => signOut()}>登出</button>
      </div>
    );
  }

  return (
    <button onClick={() => signIn('line')}>
      用 LINE 登入
    </button>
  );
}
```

---

## Token 管理

### 驗證 Access Token
```typescript
async function verifyAccessToken(accessToken: string) {
  const response = await fetch(
    `https://api.line.me/oauth2/v2.1/verify?access_token=${accessToken}`
  );
  
  const data = await response.json();
  
  if (data.error) {
    return { valid: false, error: data.error_description };
  }
  
  return {
    valid: true,
    clientId: data.client_id,
    expiresIn: data.expires_in
  };
}
```

### 刷新 Token
```typescript
async function refreshToken(refreshToken: string) {
  const response = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.LINE_CHANNEL_ID!,
      client_secret: process.env.LINE_CHANNEL_SECRET!
    })
  });

  return response.json();
}
```

### 撤銷 Token
```typescript
async function revokeToken(accessToken: string) {
  await fetch('https://api.line.me/oauth2/v2.1/revoke', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      access_token: accessToken,
      client_id: process.env.LINE_CHANNEL_ID!,
      client_secret: process.env.LINE_CHANNEL_SECRET!
    })
  });
}
```

---

## Scope 說明

| Scope | 說明 | 取得資料 |
|-------|------|----------|
| `profile` | 用戶基本資料 | userId, displayName, pictureUrl |
| `openid` | OpenID Connect | ID Token |
| `email` | 用戶 Email | email（需用戶授權） |

---

## 錯誤處理

| 錯誤碼 | 說明 | 解決方式 |
|--------|------|----------|
| `invalid_request` | 請求格式錯誤 | 檢查必要參數 |
| `invalid_client` | Client ID/Secret 錯誤 | 確認憑證正確 |
| `invalid_grant` | Code 已過期或無效 | 重新進行授權流程 |
| `access_denied` | 使用者拒絕授權 | 提示使用者需要授權 |

---

## 安全注意事項

> [!CAUTION]
> 1. **永遠驗證 state 參數**：防止 CSRF 攻擊
> 2. **驗證 ID Token**：使用 Channel Secret 驗證簽名
> 3. **安全儲存 Token**：使用 HttpOnly Cookie
> 4. **設定 Token 過期時間**：不要讓 Token 永久有效

---

## 相關資源
- [LINE Login 官方文件](https://developers.line.biz/en/docs/line-login/)
- [LINE Login API Reference](https://developers.line.biz/en/reference/line-login/)
- [NextAuth.js LINE Provider](https://next-auth.js.org/providers/line)
