#!/bin/bash
# 部署 Rich Menu RPC 函數到 Supabase

echo "🚀 部署 Rich Menu RPC 函數..."

# 從 .env 讀取 Supabase URL
source .env

# 提取 project ID (從 URL 中提取)
PROJECT_ID=$(echo $VITE_SUPABASE_URL | sed 's|https://||' | sed 's|.supabase.co||')

echo "📍 Project ID: $PROJECT_ID"
echo "📄 執行 SQL 文件: supabase/richmenu_publish_rpc.sql"

# 使用 Supabase CLI 執行 SQL
supabase db execute -f supabase/richmenu_publish_rpc.sql --project-ref $PROJECT_ID

echo "✅ 部署完成！"
