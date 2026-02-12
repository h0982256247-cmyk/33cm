#!/bin/bash

# Edge Function 部署腳本
# 用於快速部署更新後的 Edge Function

# 切換到專案目錄（腳本所在目錄）
cd "$(dirname "$0")" || exit 1

echo "📂 當前目錄: $(pwd)"
echo ""
echo "🚀 開始部署 Edge Function..."
echo ""

# 檢查是否已登入
if ! supabase projects list &> /dev/null; then
    echo "❌ 尚未登入 Supabase，請先執行以下命令登入："
    echo "   supabase login"
    exit 1
fi

echo "✅ Supabase 登入確認成功"
echo ""

# 檢查檔案是否存在
if [ ! -f "supabase/functions/publish-richmenu/index.ts" ]; then
    echo "❌ 找不到 supabase/functions/publish-richmenu/index.ts"
    echo "   請確認您在正確的專案目錄中"
    exit 1
fi

echo "✅ 找到 Edge Function 檔案"
echo ""

# 部署 publish-richmenu Edge Function
echo "📦 正在部署 publish-richmenu Edge Function..."
if supabase functions deploy publish-richmenu --project-ref krupsrweryevsevzhxjf; then
    echo ""
    echo "✅ publish-richmenu 部署成功！"
else
    echo ""
    echo "❌ publish-richmenu 部署失敗"
    exit 1
fi

echo ""
echo "🎉 所有 Edge Function 部署完成！"
echo ""
echo "現在你可以測試發布功能了，錯誤訊息會更詳細。"
