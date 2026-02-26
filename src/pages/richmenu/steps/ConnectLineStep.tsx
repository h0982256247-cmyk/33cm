import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/richmenu/common/Card';
import { Button } from '@/components/richmenu/common/Button';
import { supabase } from '@/lib/supabase';

type Mode = 'sign_in' | 'sign_up';

/**
 * 這個步驟做兩件事（UI 不重排，沿用原本 Login Card 風格）：
 * 1) Supabase Email 登入/註冊
 * 2) 登入後填寫 LINE Channel Access Token（呼叫 RPC rm_channel_upsert）
 */
export const ConnectLineStep: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [mode, setMode] = useState<Mode>('sign_in');
  const [isBusy, setIsBusy] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [hasChannel, setHasChannel] = useState(false);

  // Auth
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Token
  const [channelName, setChannelName] = useState('My LINE Channel');
  const [accessToken, setAccessToken] = useState('');

  const title = useMemo(() => {
    if (!sessionReady) return '登入編輯器';
    if (hasChannel) return '已綁定 LINE Channel';
    return '綁定 LINE Channel';
  }, [sessionReady, hasChannel]);

  // 監聽登入狀態
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSessionReady(!!data.session);
    };

    init();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setSessionReady(!!session);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // 登入後檢查是否已經有 channel（避免每次都要再填 token）
  useEffect(() => {
    if (!sessionReady) {
      setHasChannel(false);
      return;
    }

    let mounted = true;
    const abortController = new AbortController();

    (async () => {
      try {
        const { data, error } = await supabase
          .from('rm_line_channels')
          .select('id,name')
          .limit(1)
          .abortSignal(abortController.signal);

        if (!mounted) return;
        if (error) {
          // Ignore abort errors
          if (error.message?.includes('abort') || error.code === 'PGRST116') {
            return;
          }
          console.warn('[rm_line_channels] select error', error);
          setHasChannel(false);
          return;
        }
        setHasChannel(!!(data && data.length > 0));
        if (data?.[0]?.name) setChannelName(data[0].name);
      } catch (err: any) {
        // Ignore abort errors
        if (err?.name === 'AbortError' || err?.message?.includes('abort')) {
          return;
        }
        console.error('Error checking channel:', err);
      }
    })();

    return () => {
      mounted = false;
      abortController.abort();
    };
  }, [sessionReady]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert('請輸入 Email 與密碼');
      return;
    }

    setIsBusy(true);
    try {
      if (mode === 'sign_up') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('已送出註冊！請到 Email 收信完成驗證後再登入。');
        setMode('sign_in');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      alert(err?.message ?? '登入/註冊失敗');
    } finally {
      setIsBusy(false);
    }
  };

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim() || !accessToken.trim()) {
      alert('請填寫 Channel 名稱與 Channel access token');
      return;
    }

    setIsBusy(true);
    try {
      const { data, error } = await supabase.rpc('rm_channel_upsert', {
        p_name: channelName,
        p_access_token: accessToken,
      });
      if (error) throw error;
      if (!data) throw new Error('寫入失敗（沒有回傳 channel id）');

      setHasChannel(true);
      setAccessToken('');
      onComplete();
    } catch (err: any) {
      alert(err?.message ?? '寫入 token 失敗');
    } finally {
      setIsBusy(false);
    }
  };

  const handleContinue = () => onComplete();

  const handleSignOut = async () => {
    if (!confirm('確定要登出嗎？')) return;
    await supabase.auth.signOut();
    setEmail('');
    setPassword('');
    setAccessToken('');
    setHasChannel(false);
  };

  return (
    <div className="flex items-center justify-center h-full bg-background px-4">
      <Card className="w-full max-w-[420px] p-10 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-[#06C755] rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-green-500/20">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
              <path d="M21.99 12.06c0-5.7-4.93-10.31-10-10.31S2 6.36 2 12.06c0 5.1 4 9.35 8.89 10.16.34.07.8.22.92.51.1.25.07.62 0 1.05l-.18 1.09c-.05.32-.24 1.25 1.09.66s7.24-4.26 7.24-4.26a9.55 9.55 0 004.03-9.21z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text tracking-tight">{title}</h1>
          <p className="text-secondary text-sm mt-2">
            {!sessionReady
              ? ''
              : hasChannel
                ? '你已完成綁定，可直接進入專案列表'
                : '登入後請輸入 Channel access token（會加密存於 Supabase）'}
          </p>
        </div>

        {!sessionReady ? (
          <>


            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-secondary uppercase tracking-wider ml-1">Email</label>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-[15px]"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-secondary uppercase tracking-wider ml-1">密碼</label>
                <input
                  type="password"
                  placeholder="至少 6~8 位以上"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-[15px]"
                />
              </div>

              <div className="pt-4">
                <Button type="submit" fullWidth disabled={isBusy} className="bg-primary hover:bg-primary-hover py-3.5 shadow-md">
                  {isBusy ? '處理中...' : mode === 'sign_up' ? '建立帳號' : '登入系統'}
                </Button>
              </div>
            </form>
          </>
        ) : hasChannel ? (
          <>
            <div className="bg-gray-50 border border-border rounded-2xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-text">Channel：{channelName}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="text-xs font-bold text-secondary hover:text-error px-3 py-2 rounded-xl hover:bg-error/5 transition-colors"
                >
                  登出
                </button>
              </div>
            </div>

            <Button fullWidth onClick={handleContinue} className="bg-primary hover:bg-primary-hover py-3.5 shadow-md" disabled={isBusy}>
              進入專案列表
            </Button>

            <div className="mt-4">
              <button
                onClick={() => setHasChannel(false)}
                className="w-full text-center text-xs font-bold text-secondary hover:text-primary hover:underline"
              >
                重新填寫 / 更新 Channel access token
              </button>
            </div>
          </>
        ) : (
          <>
            <form onSubmit={handleSaveToken} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-secondary uppercase tracking-wider ml-1">Channel 名稱（自訂）</label>
                <input
                  type="text"
                  placeholder="例如：主帳號 OA"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-[15px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-secondary uppercase tracking-wider ml-1">Channel access token</label>
                <input
                  type="password"
                  placeholder="貼上你的 LINE Channel access token"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-[15px]"
                />

              </div>

              <div className="pt-4">
                <Button type="submit" fullWidth disabled={isBusy} className="bg-primary hover:bg-primary-hover py-3.5 shadow-md">
                  {isBusy ? '儲存中...' : '保存並進入系統'}
                </Button>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-border flex items-center justify-between">
              <p className="text-xs text-secondary">已登入：可直接登出</p>
              <button onClick={handleSignOut} className="text-xs font-bold text-secondary hover:text-error px-3 py-2 rounded-xl hover:bg-error/5 transition-colors">
                登出
              </button>
            </div>
          </>
        )}

        <div className="mt-8 pt-6 border-t border-border flex flex-col items-center gap-2">
        </div>
      </Card>
    </div>
  );
};
