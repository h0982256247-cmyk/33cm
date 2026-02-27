/**
 * 統一的 Edge Function 調用介面
 * 提供類型安全和一致的錯誤處理
 */

import { supabase } from './supabase';

/**
 * 統一的 Edge Function 響應格式
 */
export interface EdgeFunctionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Edge Function 錯誤類型
 */
export class EdgeFunctionError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'EdgeFunctionError';
  }
}

/**
 * 調用 Edge Function 的通用方法
 *
 * @param functionName - Edge Function 名稱
 * @param body - 請求 body
 * @returns 解析後的響應數據
 * @throws {EdgeFunctionError} 如果調用失敗或返回錯誤
 *
 * @example
 * ```typescript
 * // 定義響應類型
 * interface ValidateTokenResult {
 *   valid: boolean;
 *   botName?: string;
 * }
 *
 * // 調用 Edge Function
 * const result = await invokeEdgeFunction<ValidateTokenResult>(
 *   'validate-token',
 *   { accessToken: 'xxx' }
 * );
 *
 * console.log(result.valid, result.botName);
 * ```
 */
export async function invokeEdgeFunction<T = unknown>(
  functionName: string,
  body?: unknown
): Promise<T> {
  console.log(`[EdgeFunction] 調用 ${functionName}...`, {
    hasBody: !!body,
    timestamp: new Date().toISOString(),
  });

  try {
    const { data, error } = await supabase.functions.invoke<EdgeFunctionResponse<T>>(
      functionName,
      { body }
    );

    // Supabase client 層面的錯誤（網路錯誤、認證失敗等）
    if (error) {
      console.error(`[EdgeFunction] ${functionName} 調用失敗:`, error);
      throw new EdgeFunctionError(
        'INVOCATION_ERROR',
        `Edge Function 調用失敗: ${error.message}`,
        error
      );
    }

    // Edge Function 返回的業務邏輯錯誤
    if (data && !data.success) {
      console.error(`[EdgeFunction] ${functionName} 返回錯誤:`, data.error);
      throw new EdgeFunctionError(
        data.error?.code || 'UNKNOWN_ERROR',
        data.error?.message || '未知錯誤',
        data.error?.details
      );
    }

    console.log(`[EdgeFunction] ${functionName} 調用成功`);
    return data?.data as T;

  } catch (error) {
    // 已經是 EdgeFunctionError，直接拋出
    if (error instanceof EdgeFunctionError) {
      throw error;
    }

    // 未知錯誤
    console.error(`[EdgeFunction] ${functionName} 未知錯誤:`, error);
    throw new EdgeFunctionError(
      'UNEXPECTED_ERROR',
      error instanceof Error ? error.message : '未知錯誤',
      error
    );
  }
}

/**
 * 獲取用戶友好的錯誤訊息
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof EdgeFunctionError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '發生未知錯誤';
}

/**
 * 獲取錯誤代碼（用於 UI 展示或追蹤）
 */
export function getErrorCode(error: unknown): string {
  if (error instanceof EdgeFunctionError) {
    return error.code;
  }

  return 'UNKNOWN_ERROR';
}

/**
 * Edge Function 類型定義
 * 為每個 Edge Function 定義輸入和輸出類型
 */

// validate-token
export interface ValidateTokenRequest {
  accessToken: string;
}

export interface ValidateTokenResult {
  valid: boolean;
  botName?: string;
  basicId?: string;
  error?: string;
}

export async function validateToken(
  accessToken: string
): Promise<ValidateTokenResult> {
  return invokeEdgeFunction<ValidateTokenResult>('validate-token', {
    accessToken,
  });
}

// broadcast
export interface BroadcastRequest {
  flexMessages: unknown[];
  altText?: string;
}

export interface BroadcastResult {
  messageCount: number;
  targetCount: number;
}

export async function broadcast(
  flexMessages: unknown[],
  altText?: string
): Promise<BroadcastResult> {
  return invokeEdgeFunction<BroadcastResult>('broadcast', {
    flexMessages,
    altText,
  });
}

// publish-richmenu
export interface PublishRichMenuRequest {
  richMenuId: string;
  imageUrl: string;
  size: string;
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: unknown[];
}

export interface PublishRichMenuResult {
  richMenuId: string;
}

export async function publishRichMenu(
  request: PublishRichMenuRequest
): Promise<PublishRichMenuResult> {
  return invokeEdgeFunction<PublishRichMenuResult>('publish-richmenu', request);
}
