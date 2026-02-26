import React, { useState } from 'react';
import { Card } from '@/components/richmenu/common/Card';
import { Button } from '@/components/richmenu/common/Button';
import { RichMenu, ProjectStatus } from '@/lib/richmenuTypes';

interface PublishLineStepProps {
  menus: RichMenu[];
  onReset: () => void;
  onStatusChange: (id: string, status: ProjectStatus, scheduledAt?: string) => void;
  onPublishComplete?: (results: { aliasId: string; richMenuId: string }[]) => void;
  onBack?: () => void;
  onSaveDraft: () => Promise<void>;
}

export const PublishLineStep: React.FC<PublishLineStepProps> = ({ menus, onReset, onStatusChange, onPublishComplete, onBack, onSaveDraft }) => {
  const [status, setStatus] = useState<'idle' | 'publishing' | 'scheduling' | 'success'>('idle');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const mainMenu = menus.find(m => m.isMain);
  const totalHotspots = menus.reduce((acc, m) => acc + m.hotspots.length, 0);

  const handlePublishNow = async () => {
    setStatus('publishing');

    try {
      // Auto-save draft before publishing
      await onSaveDraft();

      const { buildPublishRequest, validateImageFileSize, validateHotspotCount, validateAliasId } = await import('@/lib/lineRichMenuBuilder');
      const { supabase } = await import('@/lib/supabase');

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

      // Session Guard: 確保有效的 auth session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('登入狀態已過期，請重新整理頁面並重新登入');
      }

      // 檢查 token 是否即將過期（30秒內）
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const now = Date.now();
      if (expiresAt - now < 30000) {
        // Token 即將過期，嘗試刷新
        console.log('[PublishLineStep] Token expiring soon, refreshing...');
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !newSession) {
          throw new Error('無法刷新登入狀態，請重新登入');
        }
      }

      // 改為逐一發送選單，避免 Payload 過大導致 413 或 Timeout
      // 第一個選單同時負責觸發清理舊選單 (cleanOldMenus: true)
      // 1. 先建立完整的 Publish Request 資料，確保所有選單之間的連結關係 (Switch Action) 正確解析
      // 如果直接分批傳 [menu] 進去，buildPublishRequest 會找不到目標選單而導致連結失效
      const fullPublishRequest = buildPublishRequest(menus);

      // 收集所有發布結果
      const allResults: { aliasId: string; richMenuId: string }[] = [];

      // 2. 改為逐一發送選單，避免 Payload 過大導致 413 或 Timeout
      // 第一個選單同時負責觸發清理舊選單 (cleanOldMenus: true)
      for (const [index, menuItem] of fullPublishRequest.menus.entries()) {
        const originalMenu = menus[index]; // 為了顯示名稱
        console.log(`Starting upload for menu ${index + 1}/${menus.length}: ${originalMenu.name}`);

        // 分批建立請求，每次只包含一個選單 payload
        const payload = {
          menus: [menuItem],
          cleanOldMenus: index === 0
        };

        // supabase.functions.invoke automatically includes auth token
        const response = await supabase.functions.invoke('publish-richmenu', {
          body: payload
        });

        // 🔍 詳細 Log - 顯示完整的 response
        console.log('=== Edge Function Response ===');
        console.log('選單:', originalMenu.name);
        console.log('Status:', response.status);
        console.log('Error:', response.error);
        console.log('Data:', response.data);
        console.log('================================');

        if (response.error) {
          // 顯示更詳細的錯誤訊息
          const errorDetails = {
            選單: originalMenu.name,
            錯誤訊息: response.error.message || response.error,
            完整錯誤: response.error,
            HTTP狀態: response.status,
            回應資料: response.data
          };

          console.error('=== 發布錯誤完整資訊 ===');
          console.error('選單名稱:', originalMenu.name);
          console.error('HTTP 狀態:', response.status);
          console.error('錯誤物件:', response.error);
          console.error('回應資料:', response.data);
          console.error('完整 response:', JSON.stringify(response, null, 2));
          console.error('=======================');

          // 特別處理 401 錯誤
          if (response.error.message?.includes('session') || response.error.message?.includes('Auth')) {
            throw new Error(`❌ 認證失敗，請重新整理頁面並重新登入\n\n📋 詳細錯誤資訊:\n${JSON.stringify(errorDetails, null, 2)}`);
          }

          // 顯示完整錯誤資訊
          throw new Error(`❌ 選單「${originalMenu.name}」發布失敗\n\n📝 錯誤訊息:\n${response.error.message || JSON.stringify(response.error)}\n\n📊 HTTP 狀態: ${response.status}\n\n📋 完整錯誤資訊:\n${JSON.stringify(errorDetails, null, 2)}\n\n💡 提示: 請將上述錯誤資訊提供給開發人員進行 debug`);
        }

        if (!response.data?.success) {
          const errorMsg = response.data?.error || '未知錯誤';
          const errorDetails = {
            選單: originalMenu.name,
            錯誤訊息: errorMsg,
            完整回應: response.data,
            HTTP狀態: response.status,
            後端詳細錯誤: response.data?.errorDetails
          };

          console.error('=== 發布失敗完整資訊 ===');
          console.error('選單名稱:', originalMenu.name);
          console.error('HTTP 狀態:', response.status);
          console.error('錯誤訊息:', errorMsg);
          console.error('完整回應:', response.data);
          console.error('後端錯誤詳情:', response.data?.errorDetails);
          console.error('=======================');

          if (errorMsg.includes('session') || errorMsg.includes('Auth') || errorMsg.includes('認證')) {
            throw new Error(`❌ 認證失敗，請重新整理頁面並重新登入\n\n📋 詳細錯誤資訊:\n${JSON.stringify(errorDetails, null, 2)}`);
          }

          // 顯示完整錯誤資訊
          throw new Error(`❌ 選單「${originalMenu.name}」發布失敗\n\n📝 錯誤訊息:\n${errorMsg}\n\n📊 HTTP 狀態: ${response.status}\n\n📋 完整錯誤資訊:\n${JSON.stringify(errorDetails, null, 2)}\n\n💡 提示: 請將上述錯誤資訊提供給開發人員進行 debug`);
        }

        // 收集結果
        if (response.data.results) {
          allResults.push(...response.data.results);
        }
      }

      // 發布成功
      // onStatusChange 移至 onPublishComplete 統一處理


      // 更新前端狀態與資料庫
      if (onPublishComplete) {
        onPublishComplete(allResults);
      }

      setStatus('success');
    } catch (error: any) {
      console.error(error);
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
      const { buildPublishRequest, validateImageFileSize, validateHotspotCount, validateAliasId } = await import('@/lib/lineRichMenuBuilder');

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

      const publishData = buildPublishRequest(menus);

      const { supabase } = await import('@/lib/supabase');

      // Session Guard: 確保有效的 auth session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('登入狀態已過期，請重新整理頁面並重新登入');
      }

      // 檢查 token 是否即將過期（30秒內）
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
      const now = Date.now();
      if (expiresAt - now < 30000) {
        console.log('[PublishLineStep] Token expiring soon, refreshing...');
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !newSession) {
          throw new Error('無法刷新登入狀態，請重新登入');
        }
      }

      // supabase.functions.invoke automatically includes auth token
      const response = await supabase.functions.invoke('publish-richmenu', {
        body: publishData
      });

      if (response.error) {
        // 特別處理 401 錯誤
        if (response.error.message?.includes('session') || response.error.message?.includes('Auth')) {
          throw new Error(`認證失敗，請重新整理頁面並重新登入。詳細錯誤: ${response.error.message}`);
        }
        throw new Error(response.error.message || '發布失敗');
      }

      if (!response.data?.success) {
        const errorMsg = response.data?.error || '未知錯誤';
        if (errorMsg.includes('session') || errorMsg.includes('Auth') || errorMsg.includes('認證')) {
          throw new Error(`認證失敗，請重新整理頁面並重新登入。詳細錯誤: ${errorMsg}`);
        }
        throw new Error(errorMsg);
      }

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
        </div>
      </Card>
    </div>
  );
};