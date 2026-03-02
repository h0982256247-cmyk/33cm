import React, { useState } from 'react';
import { Card } from '@/components/richmenu/common/Card';
import { Button } from '@/components/richmenu/common/Button';
import { RichMenu, ProjectStatus } from '@/lib/richmenuTypes';
import { supabase } from '@/lib/supabase';

interface PublishLineStepProps {
  menus: RichMenu[];
  onReset: () => void;
  onStatusChange: (id: string, status: ProjectStatus, scheduledAt?: string) => void;
  onPublishComplete?: (results: { aliasId: string; richMenuId: string }[]) => void;
  onBack?: () => void;
  onSaveDraft: () => Promise<void>;
}

// 診斷資訊介面
interface DebugInfo {
  timestamp: string;
  sessionState: {
    hasSession: boolean;
    hasAccessToken: boolean;
    tokenExpiry?: string;
    expiresIn?: string;
    userId?: string;
    userEmail?: string;
  };
  requestInfo?: {
    functionName: string;
    menusCount: number;
    totalSize: number;
  };
  error?: {
    type: string;
    message: string;
    code?: string;
    details?: any;
  };
}

// 根據錯誤提供建議
function getSuggestion(error: any): string {
  if (error.message?.includes('401') || error.message?.includes('Unauthorized') || error.message?.includes('認證')) {
    return '請嘗試重新登入或重新整理頁面';
  }
  if (error.message?.includes('網路') || error.message?.includes('INVOCATION')) {
    return '請檢查網路連線後重試';
  }
  if (error.message?.includes('LINE')) {
    return '請檢查 LINE Channel 設定和 Token 是否有效';
  }
  if (error.message?.includes('配置') || error.message?.includes('SERVICE_ROLE_KEY')) {
    return '請聯繫系統管理員檢查伺服器配置';
  }
  return '請查看瀏覽器 Console 了解詳細資訊';
}

export const PublishLineStep: React.FC<PublishLineStepProps> = ({ menus, onReset, onStatusChange, onPublishComplete, onBack, onSaveDraft }) => {
  const [status, setStatus] = useState<'idle' | 'publishing' | 'scheduling' | 'success'>('idle');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [errorDetails, setErrorDetails] = useState<{
    message: string;
    timestamp: string;
    suggestion?: string;
  } | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  const mainMenu = menus.find(m => m.isMain);
  const totalHotspots = menus.reduce((acc, m) => acc + m.hotspots.length, 0);

  const handlePublishNow = async () => {
    setStatus('publishing');
    setErrorDetails(null);  // 清除之前的錯誤
    setDebugInfo(null);  // 清除之前的診斷資訊

    try {
      console.log('[PublishLineStep] 🚀 開始發布流程...');
      console.log('═══════════════════════════════════════════');
      console.log('[PublishLineStep] 📋 診斷資訊收集開始');

      // 🔍 診斷步驟 1: 收集 Session 狀態
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      const sessionState = {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        tokenExpiry: session?.expires_at
          ? new Date(session.expires_at * 1000).toISOString()
          : undefined,
        expiresIn: session?.expires_at
          ? Math.floor((session.expires_at * 1000 - Date.now()) / 1000) + '秒'
          : undefined,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
      };

      console.log('[PublishLineStep] 🔐 Session 狀態:', sessionState);
      console.log('[PublishLineStep] 🔑 Access Token 前綴:', session?.access_token?.substring(0, 30) + '...');

      if (sessionError) {
        console.error('[PublishLineStep] ⚠️ Session 錯誤:', sessionError);
      }

      // Auto-save draft before publishing
      await onSaveDraft();

      const { validateImageFileSize, validateHotspotCount, validateAliasId } = await import('@/lib/lineRichMenuBuilder');

      // 驗證 Rich Menu 規範（LINE 官方限制）
      for (const menu of menus) {
        // 驗證 hotspots 數量（最多 20 個）
        const hotspotValidation = validateHotspotCount(menu);
        if (!hotspotValidation.valid) {
          throw new Error(hotspotValidation.message);
        }

        // 驗證 Alias ID 格式
        const aliasId = menu.id.replace(/-/g, '');
        const aliasValidation = validateAliasId(aliasId);
        if (!aliasValidation.valid) {
          throw new Error(aliasValidation.message);
        }

        // 驗證圖片檔案大小（最大 1MB）
        if (menu.imageData && !validateImageFileSize(menu.imageData)) {
          throw new Error(`選單「${menu.name}」的圖片檔案過大 (超過 1MB)，請壓縮後再試一次。`);
        }
      }

      // 🔍 診斷步驟 2: 準備請求資訊
      const requestData = {
        menus: menus.map(menu => ({
          menuData: {},  // 實際會在 publishRichMenus 內建立
          imageBase64: menu.imageData,
          aliasId: menu.id.replace(/-/g, ''),
          isMain: menu.isMain
        })),
        cleanOldMenus: true
      };

      const requestInfo = {
        functionName: 'richmenu-publish',
        menusCount: menus.length,
        totalSize: JSON.stringify(requestData).length,
      };

      console.log('[PublishLineStep] 📦 請求資訊:', requestInfo);

      // 更新診斷資訊
      const currentDebugInfo: DebugInfo = {
        timestamp: new Date().toISOString(),
        sessionState,
        requestInfo,
      };
      setDebugInfo(currentDebugInfo);

      // ✅ 使用 Edge Function + JWT 認證
      // SDK 會自動附加 Authorization header（JWT）
      // Edge Function 驗證 JWT 並從中獲取用戶 ID

      const { publishRichMenus } = await import('@/lib/richMenuPublish');

      console.log('[PublishLineStep] 🚀 Publishing menus via Edge Function...');
      console.log('[PublishLineStep] 📊 Publishing', menus.length, 'menus');
      console.log('[PublishLineStep] 🔑 Using Edge Function with JWT authentication');
      console.log('═══════════════════════════════════════════');

      // 直接調用發布，SDK 自動附加 JWT
      const allResults = await publishRichMenus(menus, true);
      console.log('[PublishLineStep] ✅ All menus published successfully');

      // 更新前端狀態與資料庫
      if (onPublishComplete) {
        onPublishComplete(allResults);
      }

      console.log('[PublishLineStep] ✅ 發布成功');
      setStatus('success');

      if (onPublishComplete) {
        onPublishComplete(allResults);
      }
    } catch (error: any) {
      console.error('[PublishLineStep] ❌ 發布失敗:', error);
      console.error('[PublishLineStep] 🔍 錯誤類型:', error?.constructor?.name);
      console.error('[PublishLineStep] 🔍 錯誤訊息:', error?.message);
      console.error('[PublishLineStep] 🔍 完整錯誤:', error);
      console.log('═══════════════════════════════════════════');

      // 更新診斷資訊（包含錯誤）
      setDebugInfo(prev => ({
        ...prev!,
        error: {
          type: error?.constructor?.name || 'Error',
          message: error?.message || '未知錯誤',
          code: error?.code,
          details: error?.details || error?.stack,
        },
      }));

      const errorInfo = {
        message: error.message || '發布失敗',
        timestamp: new Date().toISOString(),
        suggestion: getSuggestion(error),
      };

      setErrorDetails(errorInfo);
      setShowDebugPanel(true);  // 失敗時自動展開診斷面板
      alert(`發布失敗: ${error.message}`);
      setStatus('idle');
    }
  };

  const handleScheduleConfirm = async () => {
    if (!scheduledDate || !scheduledTime) {
      alert('請選取完整的排程日期與時間');
      return;
    }

    setStatus('publishing');

    try {
      // Auto-save draft before scheduling
      await onSaveDraft();

      // 注意: 排程功能需要額外的後端支援 (例如 cron job)
      // 這裡先直接發布,並記錄排程時間
      const { validateImageFileSize, validateHotspotCount, validateAliasId } = await import('@/lib/lineRichMenuBuilder');

      // 驗證 Rich Menu 規範（LINE 官方限制）
      for (const menu of menus) {
        // 驗證 hotspots 數量（最多 20 個）
        const hotspotValidation = validateHotspotCount(menu);
        if (!hotspotValidation.valid) {
          throw new Error(hotspotValidation.message);
        }

        // 驗證 Alias ID 格式
        const aliasId = menu.id.replace(/-/g, '');
        const aliasValidation = validateAliasId(aliasId);
        if (!aliasValidation.valid) {
          throw new Error(aliasValidation.message);
        }

        // 驗證圖片檔案大小（最大 1MB）
        if (menu.imageData && !validateImageFileSize(menu.imageData)) {
          throw new Error(`選單「${menu.name}」的圖片檔案過大 (超過 1MB)，請壓縮後再試一次。`);
        }
      }

      // 使用新的前端發布服務（避免 pgsql-http API 限制）
      const { publishRichMenus } = await import('@/lib/richMenuPublish');

      console.log('[PublishLineStep] Publishing menus for scheduled release...');

      // 直接調用 LINE API 發布
      await publishRichMenus(menus, true);

      console.log('[PublishLineStep] ✅ Scheduled publish successful');

      // 發布成功,記錄排程時間
      if (mainMenu) {
        onStatusChange(mainMenu.id, 'scheduled', `${scheduledDate} ${scheduledTime}`);
      }
      setStatus('success');
    } catch (error: any) {
      alert(`排程發布失敗: ${error.message}`);
      setStatus('idle');
    }
  };

  if (status === 'success') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-300">
        <Card className="w-full max-w-sm p-8 shadow-2xl text-center animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-success">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-text mb-2">發布成功！</h2>
          <p className="text-secondary text-sm mb-8">您的圖文選單已成功發布至 LINE 官方帳號</p>
          <Button onClick={onReset} fullWidth className="py-4 shadow-lg shadow-primary/20">
            確認
          </Button>
        </Card>
      </div>
    );
  }

  if (status === 'scheduling') {
    return (
      <div className="flex items-center justify-center h-full p-6 animate-in zoom-in duration-300">
        <Card className="w-full max-w-md p-8 shadow-2xl relative">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
            </div>
            <div>
              <h2 className="text-xl font-bold">預約排程發布</h2>
              <p className="text-xs text-secondary mt-0.5">選取您希望選單正式上線的時間</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">日期</label>
              <input type="date" className="w-full p-3 bg-gray-50 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-secondary uppercase tracking-widest">時間</label>
              <input type="time" className="w-full p-3 bg-gray-50 border border-border rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-8">
            <Button onClick={() => setStatus('idle')} variant="secondary">取消設定</Button>
            <Button onClick={handleScheduleConfirm}>確認排程</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full p-6">
      <Card className="w-full max-w-md overflow-hidden shadow-2xl relative">
        {/* 已移除卡片內的返回按鈕，導覽邏輯已整合至全域 Header */}

        <div className="p-8 pt-12 border-b border-border bg-gray-50/50">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-text">準備發布專案</h2>
              <p className="text-secondary text-sm mt-1">即將提交至 LINE 官方帳號</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-white p-4 rounded-2xl border border-border shadow-sm">
              <p className="text-[10px] text-secondary uppercase font-bold tracking-widest mb-1">層級數量</p>
              <p className="text-2xl font-bold">{menus.length} <span className="text-xs font-normal">個選單</span></p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-border shadow-sm">
              <p className="text-[10px] text-secondary uppercase font-bold tracking-widest mb-1">總熱點</p>
              <p className="text-2xl font-bold">{totalHotspots} <span className="text-xs font-normal">個區域</span></p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex flex-col gap-3 pt-4">
            <Button onClick={handlePublishNow} disabled={status === 'publishing'} fullWidth className={`py-4 shadow-lg shadow-primary/20 ${status === 'publishing' ? 'animate-pulse' : ''}`}>{status === 'publishing' ? '正提交至 LINE...' : '現在立即發布'}</Button>
            <Button onClick={() => setStatus('scheduling')} variant="ghost" className="text-primary font-bold">我要預約排程發布</Button>
          </div>

          {/* 診斷資訊面板 */}
          {debugInfo && (
            <div className="mt-4 border border-blue-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setShowDebugPanel(!showDebugPanel)}
                className="w-full px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-blue-600">🔍</span>
                  <span className="font-semibold text-blue-900 text-sm">診斷資訊</span>
                  <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                    {debugInfo.error ? '發現問題' : '正常'}
                  </span>
                </div>
                <svg
                  className={`w-5 h-5 text-blue-600 transition-transform ${showDebugPanel ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showDebugPanel && (
                <div className="p-4 bg-white space-y-4 text-xs animate-in slide-in-from-top duration-300">
                  {/* Session 狀態 */}
                  <div>
                    <h5 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                      <span>🔐</span>
                      <span>Session 狀態</span>
                    </h5>
                    <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-gray-600">有效 Session:</span>
                        <span className={debugInfo.sessionState.hasSession ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                          {debugInfo.sessionState.hasSession ? '✅ 是' : '❌ 否'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Access Token:</span>
                        <span className={debugInfo.sessionState.hasAccessToken ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                          {debugInfo.sessionState.hasAccessToken ? '✅ 存在' : '❌ 缺失'}
                        </span>
                      </div>
                      {debugInfo.sessionState.tokenExpiry && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Token 過期時間:</span>
                          <span className="text-gray-800 font-mono text-[10px]">
                            {new Date(debugInfo.sessionState.tokenExpiry).toLocaleString('zh-TW')}
                          </span>
                        </div>
                      )}
                      {debugInfo.sessionState.expiresIn && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">剩餘有效時間:</span>
                          <span className="text-gray-800 font-semibold">{debugInfo.sessionState.expiresIn}</span>
                        </div>
                      )}
                      {debugInfo.sessionState.userEmail && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">用戶:</span>
                          <span className="text-gray-800 font-mono text-[10px]">{debugInfo.sessionState.userEmail}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 請求資訊 */}
                  {debugInfo.requestInfo && (
                    <div>
                      <h5 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                        <span>📦</span>
                        <span>請求資訊</span>
                      </h5>
                      <div className="bg-gray-50 p-3 rounded border border-gray-200 space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Edge Function:</span>
                          <span className="text-gray-800 font-mono">{debugInfo.requestInfo.functionName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">選單數量:</span>
                          <span className="text-gray-800 font-semibold">{debugInfo.requestInfo.menusCount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">請求大小:</span>
                          <span className="text-gray-800">{(debugInfo.requestInfo.totalSize / 1024).toFixed(2)} KB</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 錯誤詳情 */}
                  {debugInfo.error && (
                    <div>
                      <h5 className="font-bold text-red-700 mb-2 flex items-center gap-2">
                        <span>❌</span>
                        <span>錯誤詳情</span>
                      </h5>
                      <div className="bg-red-50 p-3 rounded border border-red-200 space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-red-600">類型:</span>
                          <span className="text-red-800 font-semibold">{debugInfo.error.type}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-red-600">訊息:</span>
                          <span className="text-red-800 font-mono text-[10px] break-all">{debugInfo.error.message}</span>
                        </div>
                        {debugInfo.error.code && (
                          <div className="flex justify-between">
                            <span className="text-red-600">代碼:</span>
                            <span className="text-red-800 font-mono">{debugInfo.error.code}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 時間戳記 */}
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">診斷時間:</span>
                      <span className="text-gray-600 font-mono text-[10px]">
                        {new Date(debugInfo.timestamp).toLocaleString('zh-TW', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          fractionalSecondDigits: 3
                        })}
                      </span>
                    </div>
                  </div>

                  {/* 提示訊息 */}
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-blue-800 text-[11px] leading-relaxed">
                      <span className="font-semibold">💡 提示：</span>
                      {debugInfo.sessionState.hasAccessToken
                        ? ' SDK 應該會自動附加 Authorization header 到請求中。如果仍然出現 401 錯誤，請檢查瀏覽器 Network 面板中的請求 Headers。'
                        : ' ⚠️ 沒有找到 Access Token！這會導致 401 錯誤。請重新登入。'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 錯誤詳情顯示 */}
          {errorDetails && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg animate-in slide-in-from-top duration-300">
              <div className="flex items-start gap-3">
                <div className="text-red-500 text-xl flex-shrink-0">❌</div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-red-900 mb-2">發布失敗</h4>
                  <p className="text-sm text-red-800 whitespace-pre-line break-words">{errorDetails.message}</p>
                  {errorDetails.suggestion && (
                    <div className="mt-3 p-2 bg-red-100 rounded border border-red-300">
                      <p className="text-sm text-red-700">
                        <span className="font-semibold">💡 建議：</span>{errorDetails.suggestion}
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-red-500 mt-3 opacity-75">
                    時間：{new Date(errorDetails.timestamp).toLocaleString('zh-TW', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};