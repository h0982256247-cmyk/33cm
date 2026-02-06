/**
 * Supabase Edge Function 完整範例模板
 * 
 * 這個模板展示了如何建立一個功能完整的 Edge Function，包含：
 * - CORS 處理
 * - 認證驗證
 * - 輸入驗證
 * - 錯誤處理
 * - 資料庫操作
 * - 響應格式化
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ======================
// 類型定義
// ======================

interface RequestBody {
  action: 'create' | 'update' | 'delete' | 'list';
  data?: Record<string, unknown>;
  id?: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ======================
// CORS 配置
// ======================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// ======================
// 輔助函數
// ======================

/**
 * 建立回應
 */
function createResponse<T>(
  data: ApiResponse<T>,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

/**
 * 驗證請求主體
 */
function validateRequestBody(body: unknown): RequestBody {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid request body');
  }

  const { action, data, id } = body as RequestBody;

  if (!action || !['create', 'update', 'delete', 'list'].includes(action)) {
    throw new Error('Invalid action. Must be one of: create, update, delete, list');
  }

  if (action === 'create' && !data) {
    throw new Error('Data is required for create action');
  }

  if ((action === 'update' || action === 'delete') && !id) {
    throw new Error('ID is required for update/delete action');
  }

  return { action, data, id };
}

/**
 * 獲取認證用戶
 */
async function getAuthenticatedUser(
  supabase: SupabaseClient,
  authHeader: string | null
) {
  if (!authHeader) {
    throw new Error('Authorization header is required');
  }

  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Invalid or expired token');
  }

  return user;
}

// ======================
// 業務邏輯處理器
// ======================

class ItemHandler {
  private supabase: SupabaseClient;
  private adminClient: SupabaseClient;
  private userId: string;

  constructor(supabase: SupabaseClient, adminClient: SupabaseClient, userId: string) {
    this.supabase = supabase;
    this.adminClient = adminClient;
    this.userId = userId;
  }

  async create(data: Record<string, unknown>) {
    const { data: result, error } = await this.supabase
      .from('items')
      .insert({
        ...data,
        created_by: this.userId,
      })
      .select()
      .single();

    if (error) throw error;
    return result;
  }

  async update(id: string, data: Record<string, unknown>) {
    const { data: result, error } = await this.supabase
      .from('items')
      .update(data)
      .eq('id', id)
      .eq('created_by', this.userId) // 確保只能更新自己的資料
      .select()
      .single();

    if (error) throw error;
    if (!result) throw new Error('Item not found or access denied');
    return result;
  }

  async delete(id: string) {
    const { error } = await this.supabase
      .from('items')
      .delete()
      .eq('id', id)
      .eq('created_by', this.userId);

    if (error) throw error;
    return { deleted: true };
  }

  async list() {
    const { data, error } = await this.supabase
      .from('items')
      .select('*')
      .eq('created_by', this.userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  // 使用 admin client 進行需要提升權限的操作
  async adminAction(itemId: string) {
    const { data, error } = await this.adminClient
      .from('items')
      .update({ verified: true })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

// ======================
// 主處理函數
// ======================

serve(async (req: Request) => {
  // 處理 CORS preflight 請求
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 建立 Supabase 客戶端（使用請求者的 token）
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const authHeader = req.headers.get("Authorization");

    // 用戶客戶端（使用 RLS）
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader || '' },
      },
    });

    // 管理員客戶端（繞過 RLS）
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 驗證用戶
    const user = await getAuthenticatedUser(supabase, authHeader);

    // 解析並驗證請求
    const body = await req.json();
    const { action, data, id } = validateRequestBody(body);

    // 建立處理器
    const handler = new ItemHandler(supabase, adminClient, user.id);

    // 執行操作
    let result: unknown;

    switch (action) {
      case 'create':
        result = await handler.create(data!);
        break;
      case 'update':
        result = await handler.update(id!, data || {});
        break;
      case 'delete':
        result = await handler.delete(id!);
        break;
      case 'list':
        result = await handler.list();
        break;
      default:
        throw new Error('Unknown action');
    }

    return createResponse({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Edge function error:', error);

    // 判斷錯誤類型並返回適當的狀態碼
    let status = 500;
    let message = 'Internal server error';

    if (error instanceof Error) {
      message = error.message;

      if (message.includes('Authorization') || message.includes('token')) {
        status = 401;
      } else if (message.includes('not found') || message.includes('access denied')) {
        status = 404;
      } else if (message.includes('Invalid') || message.includes('required')) {
        status = 400;
      }
    }

    return createResponse(
      { success: false, error: message },
      status
    );
  }
});


// ======================
// 使用範例
// ======================

/*
從客戶端呼叫此 Edge Function：

// 列出項目
const { data } = await supabase.functions.invoke('my-function', {
  body: { action: 'list' }
});

// 建立項目
const { data } = await supabase.functions.invoke('my-function', {
  body: { 
    action: 'create',
    data: { name: 'New Item', description: 'Description' }
  }
});

// 更新項目
const { data } = await supabase.functions.invoke('my-function', {
  body: { 
    action: 'update',
    id: 'item-uuid',
    data: { name: 'Updated Name' }
  }
});

// 刪除項目
const { data } = await supabase.functions.invoke('my-function', {
  body: { 
    action: 'delete',
    id: 'item-uuid'
  }
});
*/
