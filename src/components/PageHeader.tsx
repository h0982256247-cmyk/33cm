import React from 'react';
import { useNavigate } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  showHomeButton?: boolean;
  backPath?: string;
  children?: React.ReactNode;
}

/**
 * 統一的頁面標題組件
 * 包含返回按鈕和主頁按鈕
 */
export function PageHeader({
  title,
  subtitle,
  showBackButton = true,
  showHomeButton = true,
  backPath,
  children
}: PageHeaderProps) {
  const nav = useNavigate();

  const handleBack = () => {
    if (backPath) {
      nav(backPath);
    } else {
      nav(-1);
    }
  };

  const handleHome = () => {
    nav('/home');
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* 左側：返回按鈕 + 標題 */}
          <div className="flex items-center gap-4">
            {showBackButton && (
              <button
                onClick={handleBack}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
                title="返回"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            <div>
              <h1 className="text-xl font-bold text-slate-900">{title}</h1>
              {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>

          {/* 中間：自定義內容 */}
          {children && <div className="flex-1 flex justify-center px-4">{children}</div>}

          {/* 右側：主頁按鈕 */}
          {showHomeButton && (
            <button
              onClick={handleHome}
              className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
              title="回到主頁"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
