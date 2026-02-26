import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * 路由保護元件
 * 未登入用戶會自動重定向到登入頁
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (mounted) {
          setAuthenticated(!!session);
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        if (mounted) {
          setAuthenticated(false);
          setLoading(false);
        }
      }
    };

    checkAuth();

    // 監聽登入狀態變化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setAuthenticated(!!session);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 顯示載入畫面
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <div className="text-slate-500 font-medium">驗證登入狀態...</div>
        </div>
      </div>
    );
  }

  // 未登入：重定向到登入頁
  if (!authenticated) {
    return <Navigate to="/" replace />;
  }

  // 已登入：顯示受保護的內容
  return <>{children}</>;
}
