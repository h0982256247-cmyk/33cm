import React from "react";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const nav = useNavigate();
  return (
    <div className="glass-bg min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none flex justify-center items-center">
        <div className="w-[600px] h-[600px] bg-blue-400/20 rounded-full blur-[100px] absolute -top-20 -left-20 animate-pulse" />
        <div className="w-[500px] h-[500px] bg-purple-400/20 rounded-full blur-[100px] absolute -bottom-20 -right-20 animate-pulse delay-700" />
      </div>

      <div className="max-w-3xl w-full z-10 relative">
        <div className="glass-panel p-20 flex flex-col items-center text-center shadow-2xl backdrop-blur-xl border border-white/40">
          <div className="text-4xl font-bold text-gray-800 mb-12 tracking-wide">
            LINE MGM 好友裂變行銷系統
          </div>

          <div className="flex justify-center w-full">
            <button
              className="glass-btn text-xl px-12 py-4 rounded-full hover:scale-105 transition-transform duration-200 shadow-xl bg-gradient-to-r from-pink-50 to-rose-50 border-pink-200 hover:border-pink-300 text-pink-700"
              onClick={() => nav("/login")}
            >
              前往系統
            </button>
          </div>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500 opacity-60">
          © <a href="https://www.gentlerdigit.com/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-700 hover:underline transition-colors">柔兒數位 Gentler Digit</a>. All rights reserved.
        </div>
      </div>
    </div>
  );
}
