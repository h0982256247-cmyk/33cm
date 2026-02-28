-- =========================================
-- Rich Menu 發布 RPC 函數
-- 使用 PostgreSQL http extension 調用 LINE Messaging API
-- 避免 Edge Function JWT 驗證問題
-- =========================================

-- 啟用 http extension（必須）
CREATE EXTENSION IF NOT EXISTS http;

-- 創建 Rich Menu 發布 RPC 函數
CREATE OR REPLACE FUNCTION public.rm_publish_richmenu(
    p_menus JSONB,
    p_clean_old_menus BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_line_token TEXT;
    v_menu JSONB;
    v_menu_data JSONB;
    v_image_base64 TEXT;
    v_alias_id TEXT;
    v_is_main BOOLEAN;
    v_create_response http_response;
    v_upload_response http_response;
    v_alias_response http_response;
    v_default_response http_response;
    v_list_response http_response;
    v_delete_response http_response;
    v_rich_menu_id TEXT;
    v_existing_menus JSONB;
    v_existing_menu JSONB;
    v_existing_id TEXT;
    v_image_binary BYTEA;
    v_results JSONB := '[]'::JSONB;
    v_result JSONB;
    v_line_api TEXT := 'https://api.line.me/v2/bot';
BEGIN
    -- 1. 取得用戶的 LINE Channel Access Token
    SELECT access_token_encrypted
    INTO v_line_token
    FROM public.rm_line_channels
    WHERE user_id = auth.uid()
      AND is_active = TRUE
    LIMIT 1;

    IF v_line_token IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', jsonb_build_object(
                'code', 'TOKEN_NOT_FOUND',
                'message', 'LINE Token 未設定，請先綁定 LINE Channel'
            )
        );
    END IF;

    -- 2. 清理舊選單（如果需要）
    IF p_clean_old_menus THEN
        -- 設置 Authorization header
        PERFORM http_set_curlopt('CURLOPT_HTTPHEADER', ARRAY['Authorization: Bearer ' || v_line_token]);

        -- 列出現有選單
        SELECT * FROM http_get(v_line_api || '/richmenu/list') INTO v_list_response;

        IF v_list_response.status = 200 THEN
            v_existing_menus := (v_list_response.content::JSONB)->'richmenus';

            -- 刪除每個現有選單
            FOR v_existing_menu IN SELECT * FROM jsonb_array_elements(v_existing_menus)
            LOOP
                v_existing_id := v_existing_menu->>'richMenuId';

                -- 刪除選單（headers 已在上面設置）
                SELECT * FROM http_delete(v_line_api || '/richmenu/' || v_existing_id) INTO v_delete_response;

                -- 嘗試刪除 alias（如果有）（headers 已設置）
                BEGIN
                    SELECT * FROM http_delete(
                        v_line_api || '/richmenu/alias/' || REPLACE(v_existing_menu->>'name', '-', '')
                    ) INTO v_delete_response;
                EXCEPTION WHEN OTHERS THEN
                    -- 忽略 alias 刪除錯誤
                    NULL;
                END;
            END LOOP;
        END IF;
    END IF;

    -- 3. 發布每個選單
    FOR v_menu IN SELECT * FROM jsonb_array_elements(p_menus)
    LOOP
        v_menu_data := v_menu->'menuData';
        v_image_base64 := v_menu->>'imageBase64';
        v_alias_id := v_menu->>'aliasId';
        v_is_main := (v_menu->>'isMain')::BOOLEAN;

        -- 3a. 創建 Rich Menu
        -- 設置 Authorization header（每個 menu 循環都需要重新設置）
        PERFORM http_set_curlopt('CURLOPT_HTTPHEADER', ARRAY['Authorization: Bearer ' || v_line_token]);

        SELECT * FROM http_post(
            v_line_api || '/richmenu',
            v_menu_data::TEXT,
            'application/json'
        ) INTO v_create_response;

        IF v_create_response.status != 200 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', jsonb_build_object(
                    'code', 'LINE_API_ERROR',
                    'message', '建立 Rich Menu 失敗',
                    'details', jsonb_build_object(
                        'status', v_create_response.status,
                        'response', v_create_response.content
                    )
                )
            );
        END IF;

        v_rich_menu_id := (v_create_response.content::JSONB)->>'richMenuId';

        -- 3b. 上傳圖片
        IF v_image_base64 IS NOT NULL THEN
            -- 移除 data URL 前綴（如果有）
            IF v_image_base64 LIKE 'data:%' THEN
                v_image_base64 := SUBSTRING(v_image_base64 FROM POSITION(',' IN v_image_base64) + 1);
            END IF;

            -- 將 base64 轉換為 binary
            v_image_binary := decode(v_image_base64, 'base64');

            -- 上傳圖片（headers 已設置）
            -- 注意：pgsql-http 對二進制數據的支持有限
            -- 這裡嘗試直接傳遞，如果失敗可能需要前端單獨處理圖片上傳
            SELECT * FROM http_post(
                v_line_api || '/richmenu/' || v_rich_menu_id || '/content',
                v_image_base64,  -- 使用 base64 字符串而不是二進制
                'image/png'
            ) INTO v_upload_response;

            IF v_upload_response.status != 200 THEN
                RETURN jsonb_build_object(
                    'success', false,
                    'error', jsonb_build_object(
                        'code', 'IMAGE_UPLOAD_FAILED',
                        'message', '上傳圖片失敗',
                        'details', jsonb_build_object(
                            'status', v_upload_response.status,
                            'response', v_upload_response.content
                        )
                    )
                );
            END IF;
        END IF;

        -- 3c. 設置 Alias
        IF v_alias_id IS NOT NULL THEN
            -- 嘗試更新現有 alias（headers 已設置）
            SELECT * FROM http_post(
                v_line_api || '/richmenu/alias/' || v_alias_id,
                jsonb_build_object(
                    'richMenuAliasId', v_alias_id,
                    'richMenuId', v_rich_menu_id
                )::TEXT,
                'application/json'
            ) INTO v_alias_response;

            -- 如果更新失敗，嘗試創建新 alias
            IF v_alias_response.status != 200 THEN
                SELECT * FROM http_post(
                    v_line_api || '/richmenu/alias',
                    jsonb_build_object(
                        'richMenuAliasId', v_alias_id,
                        'richMenuId', v_rich_menu_id
                    )::TEXT,
                    'application/json'
                ) INTO v_alias_response;
                -- 忽略 alias 創建錯誤（非致命）
            END IF;
        END IF;

        -- 3d. 如果是主選單，設置為默認（headers 已設置）
        IF v_is_main THEN
            SELECT * FROM http_post(
                v_line_api || '/user/all/richmenu/' || v_rich_menu_id,
                '',
                'application/json'
            ) INTO v_default_response;
            -- 忽略設置默認選單的錯誤（非致命）
        END IF;

        -- 收集結果
        v_result := jsonb_build_object(
            'aliasId', v_alias_id,
            'richMenuId', v_rich_menu_id
        );
        v_results := v_results || jsonb_build_array(v_result);
    END LOOP;

    -- 4. 返回成功結果
    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'results', v_results,
            'publishedAt', NOW()
        )
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', jsonb_build_object(
            'code', 'UNEXPECTED_ERROR',
            'message', '發布過程中發生錯誤',
            'details', SQLERRM
        )
    );
END;
$$;

-- 授權 authenticated 用戶執行此 RPC
GRANT EXECUTE ON FUNCTION public.rm_publish_richmenu(JSONB, BOOLEAN) TO authenticated;

COMMENT ON FUNCTION public.rm_publish_richmenu(JSONB, BOOLEAN) IS 'Rich Menu 發布 RPC - 使用 PostgreSQL http extension 調用 LINE API';
