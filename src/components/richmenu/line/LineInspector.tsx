import React, { useRef } from 'react';
import { Hotspot, RichMenu, ActionType } from '../../types';
import { Button } from '../common/Button';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../constants';

interface LineInspectorProps {
  hotspot: Hotspot | undefined;
  selectedMenu: RichMenu | undefined;
  allMenus: RichMenu[];
  onUpdate: (updates: Partial<Hotspot>) => void;
  onUpdateMenu: (updates: Partial<RichMenu>) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  onSave?: () => void;
  onDeselectHotspot?: () => void;
}

export const LineInspector: React.FC<LineInspectorProps> = ({
  hotspot,
  selectedMenu,
  allMenus,
  onUpdate,
  onUpdateMenu,
  onDelete,
  onAdd,
  onSave,
  onDeselectHotspot
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert('圖片大小不能超過 1MB');
        e.target.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        onUpdateMenu({ imageData: result });
      };
      reader.readAsDataURL(file);
    }
  };

  // State 1: Menu Settings (When no hotspot selected)
  if (!hotspot) {
    if (!selectedMenu) return <div className="p-6">請選擇一個選單</div>;

    return (
      <div className="p-6 h-full flex flex-col bg-white overflow-y-auto">
        <div className="mb-6 border-b border-border pb-4">
          <h3 className="text-lg font-semibold text-text">選單設定</h3>
          <p className="text-sm text-secondary">編輯目前 <span className="font-bold text-primary">{selectedMenu.isMain ? '主選單' : '子選單'}</span> 的資訊</p>
        </div>

        <div className="space-y-6">
          {/* Menu Name */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">選單名稱</label>
            <input
              type="text"
              value={selectedMenu.name}
              onChange={(e) => onUpdateMenu({ name: e.target.value })}
              placeholder="例如：主選單首頁"
              className="w-full p-3 bg-gray-50 border border-border rounded-[10px] text-text focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Bar Text */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold uppercase tracking-wider text-secondary">選單列顯示文字</label>
              <span className="text-[10px] bg-gray-100 text-secondary px-1.5 py-0.5 rounded">必填</span>
            </div>
            <input
              type="text"
              value={selectedMenu.barText}
              onChange={(e) => onUpdateMenu({ barText: e.target.value })}
              placeholder="例如：點擊查看更多"
              maxLength={20}
              className="w-full p-3 bg-gray-50 border border-border rounded-[10px] text-text focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <p className="text-[10px] text-gray-400">這會顯示在手機版 LINE 的選單開關處 (上限 20 字)</p>
          </div>

          {/* Menu Image */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-secondary">背景圖片</label>
            <div
              className={`w-full aspect-[2500/1686] rounded-xl overflow-hidden border-2 border-dashed transition-all relative group cursor-pointer ${selectedMenu.imageData ? 'border-border' : 'border-error/30 bg-error/5'}`}
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedMenu.imageData ? (
                <img src={selectedMenu.imageData} className="w-full h-full object-cover" alt="Menu Background" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-error gap-2 px-4 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                  <span className="text-[10px] font-bold">尚未上傳圖片</span>
                </div>
              )}

              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity font-bold text-sm backdrop-blur-sm">
                更換背景圖
              </div>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleImageUpload}
            />
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border space-y-3">
          <Button onClick={onAdd} fullWidth variant="primary" className="shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            新增點擊區域
          </Button>

          <p className="text-[10px] text-secondary text-center mt-3 bg-gray-50 py-2 rounded">
            💡 提示：點擊中間畫布背景可返回此設定頁面
          </p>
        </div>
      </div>
    );
  }

  // State 2: Hotspot Settings
  const handleActionTypeChange = (type: ActionType) => {
    let defaultData = '';
    if (type === 'switch' && allMenus.length > 0) {
      // 預設選擇第一個「不是目前編輯中」的選單，避免指向自己
      const target = allMenus.find(m => m.id !== selectedMenu?.id);
      if (target) defaultData = target.id;
    }
    onUpdate({ action: { ...hotspot.action, type, data: defaultData, fillInText: undefined } });
  };

  const handleDataChange = (val: string) => {
    onUpdate({ action: { ...hotspot.action, data: val } });
  };

  const handleFillInTextChange = (val: string) => {
    onUpdate({ action: { ...hotspot.action, fillInText: val } });
  };

  return (
    <div className="p-6 h-full flex flex-col bg-white overflow-y-auto">
      <div className="mb-6 border-b border-border pb-4 flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-text">動作設定</h3>
          <p className="text-sm text-secondary">設定點擊後的行為</p>
        </div>
        <button
          onClick={onAdd}
          className="p-2 hover:bg-gray-100 rounded-lg text-primary transition-colors"
          title="新增另一個熱區"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
      </div>

      <div className="space-y-6 flex-1">

        {/* Action Type Selector (Dropdown) */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-secondary">動作類型</label>
          <div className="relative">
            <select
              value={hotspot.action.type}
              onChange={(e) => handleActionTypeChange(e.target.value as ActionType)}
              className="w-full p-3 bg-gray-50 border border-border rounded-[10px] text-text focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none font-medium text-sm"
            >
              <option value="none">不設定</option>
              <option value="switch">切換選單</option>
              <option value="message">傳送訊息</option>
              <option value="uri">開啟連結</option>
              <option value="postback">預填欄位</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
        </div>

        {/* Dynamic Inputs */}
        <div className="space-y-2">
          {hotspot.action.type === 'switch' && (
            <>
              <label className="text-sm font-medium text-text">顯示哪個選單？</label>
              <select
                value={hotspot.action.data}
                onChange={(e) => handleDataChange(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-border rounded-[10px] text-text focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none"
              >
                <option value="" disabled>選擇選單</option>
                {/* 顯示所有選單（排除目前正在編輯的選單，避免自己切換到自己） */}
                {allMenus.filter(m => m.id !== selectedMenu?.id).map(m => (
                  <option key={m.id} value={m.id}>{m.name}{m.isMain ? ' (主選單)' : ''}</option>
                ))}
                {allMenus.filter(m => m.id !== selectedMenu?.id).length === 0 && (
                  <option disabled>無可用的選單</option>
                )}
              </select>
            </>
          )}

          {hotspot.action.type === 'message' && (
            <>
              <label className="text-sm font-medium text-text">傳送的訊息</label>
              <textarea
                value={hotspot.action.data}
                onChange={(e) => handleDataChange(e.target.value)}
                placeholder="例如：營業時間"
                className="w-full p-3 bg-gray-50 border border-border rounded-[10px] text-text focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[100px] resize-none"
              />
            </>
          )}

          {hotspot.action.type === 'uri' && (
            <>
              <label className="text-sm font-medium text-text">網站連結</label>
              <input
                type="url"
                value={hotspot.action.data}
                onChange={(e) => handleDataChange(e.target.value)}
                placeholder="https://example.com"
                className="w-full p-3 bg-gray-50 border border-border rounded-[10px] text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </>
          )}

          {hotspot.action.type === 'postback' && (
            <>
              <label className="text-sm font-medium text-text">顯示文字</label>
              <input
                type="text"
                value={hotspot.action.data}
                onChange={(e) => handleDataChange(e.target.value)}
                placeholder="例如：柔兒餐廳訂位"
                className="w-full p-3 bg-gray-50 border border-border rounded-[10px] text-text focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <p className="text-[10px] text-gray-400 -mt-1">用戶點擊後，此文字會顯示在對話中</p>

              <label className="text-sm font-medium text-text mt-3">預填內容</label>
              <textarea
                value={hotspot.action.fillInText || ''}
                onChange={(e) => handleFillInTextChange(e.target.value)}
                placeholder={"📌柔兒餐廳訂位\n＿＿＿＿＿\n姓名：\n日期：\n時間：\n人數：\n手機：\n備註："}
                className="w-full p-3 bg-gray-50 border border-border rounded-[10px] text-text focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[150px] resize-none font-mono text-sm"
              />
              <p className="text-[10px] text-gray-400 -mt-1">用戶點擊後，鍵盤會自動開啟並填入此內容</p>
            </>
          )}

          {hotspot.action.type === 'none' && (
            <div className="p-4 bg-gray-50 rounded-lg border border-dashed border-border flex flex-col items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-secondary"><circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" /></svg>
              <p className="text-xs text-secondary text-center">此區域點擊後不會觸發任何行為</p>
            </div>
          )}
        </div>

        {/* Position Info */}
        <div className="pt-4 border-t border-border">
          <label className="text-xs font-semibold uppercase tracking-wider text-secondary mb-2 block">座標與尺寸</label>
          <div className="grid grid-cols-2 gap-3 text-xs text-secondary font-mono bg-gray-50 p-3 rounded-lg">
            <div>X: {hotspot.x}</div>
            <div>Y: {hotspot.y}</div>
            <div>W: {hotspot.width}</div>
            <div>H: {hotspot.height}</div>
          </div>
        </div>
      </div>

      <div className="mt-auto pt-6 border-t border-border space-y-2">
        <Button
          variant="danger"
          fullWidth
          onClick={() => onDelete(hotspot.id)}
          className="py-2.5"
        >
          刪除此區域
        </Button>
        <Button
          variant="ghost"
          fullWidth
          onClick={onDeselectHotspot}
          className="text-xs"
        >
          返回
        </Button>
      </div>
    </div>
  );
};