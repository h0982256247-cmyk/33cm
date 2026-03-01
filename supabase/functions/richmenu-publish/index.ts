import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const LINE_API = 'https://api.line.me/v2/bot';

interface PublishMenuRequest {
  menuData: any;
  imageBase64: string | null;
  aliasId: string;
  isMain: boolean;
}

serve(async (req) => {
  // CORS headers - 定義在最外層
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  // 最外層錯誤處理 - 捕獲所有未預期的錯誤
  try {
    console.log('[richmenu-publish] ===== Request Start =====');
    console.log('[richmenu-publish] Received request:', req.method);
    console.log('[richmenu-publish] URL:', req.url);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      console.log('[richmenu-publish] CORS preflight request');
      return new Response('ok', { headers: corsHeaders, status: 200 })
    }

    // 內層業務邏輯 try-catch
    try {
    // 1. 驗證用戶身份
    const authHeader = req.headers.get('Authorization')
    console.log('[richmenu-publish] Auth header present:', !!authHeader);

    if (!authHeader) {
      console.error('[richmenu-publish] ❌ Missing Authorization header');
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '請先登入',
            details: 'Missing Authorization header'
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // 獲取環境變數（包含 service role key）
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    // 詳細的環境變數檢查
    console.log('[richmenu-publish] Environment check:', {
      hasUrl: !!supabaseUrl,
      hasAnonKey: !!supabaseAnonKey,
      hasServiceKey: !!serviceRoleKey,
      urlPrefix: supabaseUrl?.substring(0, 20) + '...'
    });

    if (!serviceRoleKey) {
      console.error('[richmenu-publish] ❌ CRITICAL: Missing SERVICE_ROLE_KEY');
      console.error('[richmenu-publish] Please set it using: supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<key>');

      // ✅ 返回 200 而不是拋出錯誤
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'CONFIG_ERROR',
            message: '伺服器配置錯誤：缺少 SERVICE_ROLE_KEY',
            details: 'Edge Function secret SUPABASE_SERVICE_ROLE_KEY is not configured. Please contact administrator.'
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    // 驗證用戶（使用 anon key + JWT）
    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    )

    // 驗證 JWT 並獲取用戶
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('[richmenu-publish] ❌ User verification failed');
      console.error('[richmenu-publish] 🔍 Error details:', {
        message: userError?.message,
        name: userError?.name,
        hasUser: !!user
      });
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'AUTH_FAILED',
            message: '認證失敗',
            details: {
              error: userError?.message || 'No user found',
              name: userError?.name
            }
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    console.log('[richmenu-publish] ✅ User authenticated:', user.id)
    console.log('[richmenu-publish] 🔍 User email:', user.email)

    // 2. 獲取請求數據
    const { menus, cleanOldMenus } = await req.json()

    // 3. 從資料庫獲取 LINE Access Token
    // ✅ 關鍵修復：使用 service role client 繞過 RLS
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { data: channelData, error: channelError } = await supabaseAdmin
      .from('rm_line_channels')
      .select('access_token_encrypted')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (channelError || !channelData?.access_token_encrypted) {
      console.error('[richmenu-publish] ❌ LINE token not found:', channelError);
      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'TOKEN_NOT_FOUND',
            message: 'LINE Token 未設定，請先綁定 LINE Channel',
            details: channelError?.message
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      );
    }

    const lineToken = channelData.access_token_encrypted
    console.log('[richmenu-publish] ✅ LINE token retrieved successfully');

    // 4. 清理舊選單（如果需要）
    if (cleanOldMenus) {
      console.log('[richmenu-publish] Cleaning old menus...')

      const listResponse = await fetch(`${LINE_API}/richmenu/list`, {
        headers: {
          'Authorization': `Bearer ${lineToken}`
        }
      })

      if (listResponse.ok) {
        const listData = await listResponse.json()
        const existingMenus = listData.richmenus || []

        for (const menu of existingMenus) {
          await fetch(`${LINE_API}/richmenu/${menu.richMenuId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${lineToken}`
            }
          })
        }
      }
    }

    // 5. 發布每個選單
    const results = []

    for (const menuRequest of menus) {
      const { menuData, imageBase64, aliasId, isMain } = menuRequest as PublishMenuRequest

      // 5a. 創建 Rich Menu
      console.log('[richmenu-publish] Creating menu:', menuData.name)
      const createResponse = await fetch(`${LINE_API}/richmenu`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lineToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(menuData)
      })

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        throw new Error(`Failed to create menu: ${errorText}`)
      }

      const createData = await createResponse.json()
      const richMenuId = createData.richMenuId

      // 5b. 上傳圖片
      if (imageBase64) {
        console.log('[richmenu-publish] Uploading image...')

        // 移除 data URL 前綴
        const base64Data = imageBase64.includes(',')
          ? imageBase64.split(',')[1]
          : imageBase64

        // 解碼 base64 為 binary
        const binaryString = atob(base64Data)
        const bytes = new Uint8Array(binaryString.length)
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i)
        }

        const uploadResponse = await fetch(`${LINE_API}/richmenu/${richMenuId}/content`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lineToken}`,
            'Content-Type': 'image/png'
          },
          body: bytes
        })

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text()
          throw new Error(`Failed to upload image: ${errorText}`)
        }
      }

      // 5c. 設置 Alias
      if (aliasId) {
        console.log('[richmenu-publish] Setting alias:', aliasId)

        await fetch(`${LINE_API}/richmenu/alias`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lineToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            richMenuAliasId: aliasId,
            richMenuId: richMenuId
          })
        })
        // 不處理 alias 錯誤（非致命）
      }

      // 5d. 如果是主選單，設置為默認
      if (isMain) {
        console.log('[richmenu-publish] Setting as default menu')

        await fetch(`${LINE_API}/user/all/richmenu/${richMenuId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lineToken}`,
            'Content-Type': 'application/json'
          }
        })
        // 不處理錯誤（非致命）
      }

      results.push({ aliasId, richMenuId })
    }

    console.log('[richmenu-publish] ✅ All menus published successfully')

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          results,
          publishedAt: new Date().toISOString()
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

    } catch (error: any) {
      // 內層錯誤處理 - 業務邏輯錯誤
      console.error('[richmenu-publish] ❌ Business logic error:', error)
      console.error('[richmenu-publish] Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      })

      return new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'PUBLISH_ERROR',
            message: error.message || 'Failed to publish Rich Menu',
            details: error.stack || null
          }
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }
  } catch (outerError: any) {
    // 最外層錯誤處理 - 捕獲 serve() 層級的錯誤
    console.error('[richmenu-publish] ❌❌❌ CRITICAL: Outer error:', outerError);
    console.error('[richmenu-publish] Outer error details:', {
      message: outerError?.message,
      stack: outerError?.stack,
      name: outerError?.name,
      type: typeof outerError
    });

    // 確保即使在最外層錯誤也返回 200
    return new Response(
      JSON.stringify({
        success: false,
        error: {
          code: 'CRITICAL_ERROR',
          message: outerError?.message || 'Critical server error',
          details: outerError?.stack || String(outerError)
        }
      }),
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
          'Content-Type': 'application/json'
        },
        status: 200  // ✅ 即使是致命錯誤也返回 200
      }
    )
  }
})
