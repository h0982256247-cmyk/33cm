import React from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/**
 * 系統選擇頁面 - 讓用戶選擇進入 Rich Menu 編輯器或 Flex Message 編輯器
 */
export default function Home() {
  const nav = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    nav("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* 頂部導航欄 */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-white/5 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-xl flex items-center justify-center shadow-lg shadow-green-500/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M21.99 12.06c0-5.7-4.93-10.31-10-10.31S2 6.36 2 12.06c0 5.1 4 9.35 8.89 10.16.34.07.8.22.92.51.1.25.07.62 0 1.05l-.18 1.09c-.05.32-.24 1.25 1.09.66s7.24-4.26 7.24-4.26a9.55 9.55 0 004.03-9.21z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-white">LINE Portal</span>
          </div>

          <button
            onClick={handleLogout}
            className="text-white/60 hover:text-white text-sm font-medium transition-colors"
          >
            登出
          </button>
        </div>
      </header>

      {/* 主內容區 */}
      <main className="pt-24 pb-12 px-6">
        <div className="max-w-5xl mx-auto">
          {/* 標題區 */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              選擇您要使用的功能
            </h1>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              管理您的 LINE 官方帳號，建立精美的圖文選單或訊息模板
            </p>
          </div>

          {/* 功能卡片區 */}
          <div className="grid md:grid-cols-2 gap-8">
            {/* Rich Menu 編輯器 */}
            <button
              onClick={() => nav("/richmenu")}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-white/10 p-8 text-left transition-all duration-300 hover:scale-[1.02] hover:border-cyan-400/50 hover:shadow-2xl hover:shadow-cyan-500/20"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/0 to-blue-500/0 group-hover:from-cyan-500/10 group-hover:to-blue-500/10 transition-all duration-300" />

              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-cyan-500/30 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                </div>

                <h2 className="text-2xl font-bold text-white mb-3">
                  Rich Menu 編輯器
                </h2>
                <p className="text-white/60 mb-6 leading-relaxed">
                  視覺化設計圖文選單，設定熱區互動，一鍵發布到 LINE 官方帳號
                </p>

                <div className="flex items-center text-cyan-400 font-medium group-hover:translate-x-2 transition-transform duration-300">
                  開始使用
                  <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>
            </button>

            {/* Flex Message 編輯器 */}
            <button
              onClick={() => nav("/drafts")}
              className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 border border-white/10 p-8 text-left transition-all duration-300 hover:scale-[1.02] hover:border-pink-400/50 hover:shadow-2xl hover:shadow-pink-500/20"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-pink-500/0 to-purple-500/0 group-hover:from-pink-500/10 group-hover:to-purple-500/10 transition-all duration-300" />

              <div className="relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-purple-500 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-pink-500/30 group-hover:scale-110 transition-transform duration-300">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>

                <h2 className="text-2xl font-bold text-white mb-3">
                  Flex Message 編輯器
                </h2>
                <p className="text-white/60 mb-6 leading-relaxed">
                  建立互動式訊息模板，支援 LIFF 分享與 LINE OA 廣播推送
                </p>

                <div className="flex items-center text-pink-400 font-medium group-hover:translate-x-2 transition-transform duration-300">
                  開始使用
                  <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>
            </button>
          </div>

          {/* 功能標籤 */}
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            {["視覺化編輯", "一鍵發布", "LINE OA 廣播", "LIFF 分享", "雲端儲存"].map((tag) => (
              <span
                key={tag}
                className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 text-sm"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
