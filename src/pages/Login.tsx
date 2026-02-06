import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { hasChannel, upsertChannel, validateAccessToken } from "@/lib/channel";

type Step = "auth" | "token" | "done";

/**
 * 統一登入頁面
 * 1. 先進行 Supabase Auth 登入
 * 2. 登入後檢查是否有 LINE Token，若無則引導綁定
 * 3. 綁定完成後導向系統選擇頁
 */
export default function Login() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>("auth");
  const [loading, setLoading] = useState(true);

  // Auth 狀態
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
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
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!data.session) {
        setStep("auth");
        setLoading(false);
        return;
      }

      // 已登入，檢查是否有 Token
      const hasToken = await hasChannel();
      if (!mounted) return;

      if (hasToken) {
        nav("/home");
      } else {
        setStep("token");
        setLoading(false);
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

      // 登入後檢查 Token
      const hasToken = await hasChannel();
      if (!mounted) return;

      if (hasToken) {
        nav("/home");
      } else {
        setStep("token");
        setLoading(false);
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
      if (authMode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setAuthMsg("註冊成功！請到 Email 收信驗證後再登入。");
        setAuthMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // onAuthStateChange 會處理後續
      }
    } catch (err: any) {
      setAuthMsg(err?.message || "登入/註冊失敗");
    } finally {
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
      // 先驗證 Token 是否有效
      const validation = await validateAccessToken(accessToken);
      if (!validation.valid) {
        setTokenMsg(`Token 驗證失敗: ${validation.error}`);
        setValidating(false);
        return;
      }

      // 儲存到資料庫
      await upsertChannel(channelName, accessToken);
      nav("/home");
    } catch (err: any) {
      setTokenMsg(err?.message || "儲存失敗");
    } finally {
      setValidating(false);
    }
  };

  const handleSkipToken = () => {
    nav("/home");
  };

  if (loading && step === "auth") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white/60">載入中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="backdrop-blur-xl bg-white/10 border border-white/20 rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-green-500/30">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="white">
                <path d="M21.99 12.06c0-5.7-4.93-10.31-10-10.31S2 6.36 2 12.06c0 5.1 4 9.35 8.89 10.16.34.07.8.22.92.51.1.25.07.62 0 1.05l-.18 1.09c-.05.32-.24 1.25 1.09.66s7.24-4.26 7.24-4.26a9.55 9.55 0 004.03-9.21z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">
              {step === "auth" ? "登入 LINE Portal" : "綁定 LINE Channel"}
            </h1>
            <p className="text-white/50 text-sm mt-2 text-center">
              {step === "auth"
                ? "請先登入您的帳號"
                : "輸入您的 LINE Channel Access Token 以使用完整功能"}
            </p>
          </div>

          {step === "auth" ? (
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">密碼</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all"
                />
              </div>

              {authMsg && (
                <div className={`text-sm px-4 py-2 rounded-lg ${authMsg.includes("成功") ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"}`}>
                  {authMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg shadow-green-500/30 transition-all disabled:opacity-50"
              >
                {loading ? "處理中..." : authMode === "signup" ? "註冊" : "登入"}
              </button>

              <button
                type="button"
                onClick={() => setAuthMode(authMode === "signin" ? "signup" : "signin")}
                className="w-full text-center text-white/50 hover:text-white/80 text-sm transition-colors"
              >
                {authMode === "signin" ? "還沒有帳號？註冊" : "已有帳號？登入"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSaveToken} className="space-y-4">
              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">Channel 名稱（自訂）</label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="例如：主帳號 OA"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-white/70 text-sm font-medium mb-2">Channel Access Token</label>
                <input
                  type="password"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="貼上您的 LINE Channel Access Token"
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 transition-all"
                />
                <p className="text-white/40 text-xs mt-2">
                  可在 LINE Developers Console → Messaging API → Channel access token 取得
                </p>
              </div>

              {tokenMsg && (
                <div className="text-sm px-4 py-2 rounded-lg bg-red-500/20 text-red-300">
                  {tokenMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={validating}
                className="w-full py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold rounded-xl shadow-lg shadow-green-500/30 transition-all disabled:opacity-50"
              >
                {validating ? "驗證中..." : "儲存並繼續"}
              </button>

              <button
                type="button"
                onClick={handleSkipToken}
                className="w-full text-center text-white/50 hover:text-white/80 text-sm transition-colors"
              >
                稍後再設定（部分功能將無法使用）
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
