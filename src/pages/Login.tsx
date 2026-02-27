import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { hasChannel, upsertChannel, validateAccessToken } from "@/lib/channel";

type Step = "auth" | "token" | "done";

export default function Login() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>("auth");
  const [loading, setLoading] = useState(true);

  // Auth 狀態
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMsg, setAuthMsg] = useState<string | null>(null);

  // Token 狀態
  const [channelName, setChannelName] = useState("My LINE Channel");
  const [accessToken, setAccessToken] = useState("");
  const [tokenMsg, setTokenMsg] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  // 檢查登入狀態和 Token
  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        // 設定 3 秒 timeout (縮短等待時間)
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Connection timeout")), 3000)
        );

        const sessionPromise = supabase.auth.getSession();

        // 加上 Promise.race 避免 Supabase client 卡住
        const result = await Promise.race([sessionPromise, timeoutPromise]) as any;
        const { data, error } = result || {};

        if (error) throw error;

        if (!mounted) return;

        if (!data?.session) {
          setStep("auth");
          return;
        }

        // 已登入，檢查是否有 Token
        // 這裡也加上 timeout 保險
        const tokenCheckPromise = hasChannel();
        const hasToken = await Promise.race([
          tokenCheckPromise,
          new Promise((_, r) => setTimeout(() => r(new Error("Token check timeout")), 3000))
        ]) as boolean;

        if (!mounted) return;

        if (hasToken === true) { // 確保是 boolean true
          nav("/home");
        } else {
          setStep("token");
        }
      } catch (err) {
        console.warn("Session check failed or timed out:", err);
        // 出錯時停留在登入頁，讓用戶可以重試，而不是卡在 loading
        if (mounted) {
          setStep("auth");
          setAuthMsg("連線逾時，請檢查網路或重新登入");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkSession();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (!session) {
        setStep("auth");
        setLoading(false);
        return;
      }

      // 登入後檢查 Token（加上 timeout 避免卡住）
      try {
        const hasToken = await Promise.race([
          hasChannel(),
          new Promise<boolean>((_, reject) =>
            setTimeout(() => reject(new Error("Token check timeout")), 3000)
          ),
        ]);
        if (!mounted) return;

        if (hasToken) {
          nav("/home");
        } else {
          setStep("token");
        }
      } catch (err) {
        console.warn("onAuthStateChange token check failed:", err);
        if (!mounted) return;
        // 超時或錯誤時，導向首頁讓使用者可以操作，不卡在 loading
        setStep("token");
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [nav]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setAuthMsg("請輸入 Email 和密碼");
      return;
    }

    setAuthMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // onAuthStateChange 會處理後續
    } catch (err: any) {
      setAuthMsg(err?.message || "登入失敗");
      setLoading(false);
    }
  };

  const handleSaveToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim() || !accessToken.trim()) {
      setTokenMsg("請填寫 Channel 名稱和 Access Token");
      return;
    }

    setTokenMsg(null);
    setValidating(true);

    try {
      console.log("[Login] 開始驗證 Token...");
      console.log("[Login] Token 長度:", accessToken.length);
      console.log("[Login] Token 前 20 字元:", accessToken.substring(0, 20));

      // 先驗證 Token 是否有效
      const validation = await validateAccessToken(accessToken);

      console.log("[Login] 驗證結果:", validation);

      if (!validation.valid) {
        const errorMsg = `Token 驗證失敗: ${validation.error || "未知錯誤"}`;
        console.error("[Login]", errorMsg);
        setTokenMsg(errorMsg + "\n\n💡 提示：\n1. 檢查 Token 是否完整複製\n2. 確認是 Channel Access Token（長期）\n3. 到 LINE Developers Console 確認 Token 狀態");
        setValidating(false);
        return;
      }

      console.log("[Login] ✅ Token 驗證成功，Bot 名稱:", validation.botName);

      // 儲存到資料庫
      console.log("[Login] 開始儲存到資料庫...");
      await upsertChannel(channelName, accessToken);

      console.log("[Login] ✅ 儲存成功，導向首頁");
      nav("/home");
    } catch (err: any) {
      const errorMsg = err?.message || "儲存失敗";

      // 如果是已設定 token 的錯誤，顯示提示後自動導向首頁
      if (errorMsg.includes("已設定") || errorMsg.includes("只能設定一次")) {
        setTokenMsg("您已設定過 LINE Token，正在進入系統...");
        setTimeout(() => nav("/home"), 2000);
      } else {
        setTokenMsg(errorMsg);
        setValidating(false);
      }
    }
  };

  if (loading && step === "auth") {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <div className="text-slate-500 font-medium">系統載入中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">

        {/* Logo Header */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/20 mb-6">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
              <path d="M21.99 12.06c0-5.7-4.93-10.31-10-10.31S2 6.36 2 12.06c0 5.1 4 9.35 8.89 10.16.34.07.8.22.92.51.1.25.07.62 0 1.05l-.18 1.09c-.05.32-.24 1.25 1.09.66s7.24-4.26 7.24-4.26a9.55 9.55 0 004.03-9.21z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            {step === "auth" ? "歡迎使用 LINE Portal" : "綁定 LINE Channel"}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {step === "auth"
              ? "請輸入您的帳號密碼以登入系統"
              : "為了使用完整功能，我們需要驗證您的 Channel Token"}
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-100">
          {step === "auth" ? (
            <form onSubmit={handleAuth} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Email 信箱</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="block w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-green-500 focus:ring-green-500 sm:text-sm transition-colors hover:border-slate-400"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">密碼</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-green-500 focus:ring-green-500 sm:text-sm transition-colors hover:border-slate-400"
                />
              </div>

              {authMsg && (
                <div className={`p-4 rounded-lg text-sm font-medium ${authMsg.includes("成功")
                  ? "bg-green-50 text-green-700 border border-green-100"
                  : "bg-red-50 text-red-700 border border-red-100"
                  }`}>
                  {authMsg}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full justify-center rounded-xl bg-green-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-500/20 hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      處理中...
                    </span>
                  ) : (
                    "登入系統"
                  )}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSaveToken} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Channel 名稱</label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="為這個帳號設別稱 (例如：主帳號 OA)"
                  className="block w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-green-500 focus:ring-green-500 sm:text-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Channel Access Token
                  <span className="ml-1 text-xs font-normal text-slate-500">(長期 Token)</span>
                </label>
                <textarea
                  rows={4}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="請貼上您的 Messaging API Channel Access Token"
                  className="block w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 placeholder-slate-400 focus:border-green-500 focus:ring-green-500 sm:text-sm transition-colors font-mono text-xs leading-relaxed"
                />
                <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  請至 LINE Developers Console 取得
                </p>
              </div>

              {tokenMsg && (
                <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-100 text-sm font-medium">
                  {tokenMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={validating}
                className="flex w-full justify-center rounded-xl bg-green-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-green-500/20 hover:bg-green-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {validating ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    驗證並儲存...
                  </span>
                ) : "儲存設定"}
              </button>

              {/* 登出按鈕 */}
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  setStep("auth");
                }}
                className="flex w-full justify-center rounded-xl border-2 border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 transition-all"
              >
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  登出
                </span>
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-400">
          © 2024 LINE Portal System. All rights reserved.
        </p>
      </div>
    </div>
  );
}
