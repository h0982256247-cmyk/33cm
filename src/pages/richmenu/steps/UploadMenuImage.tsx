
import React, { useCallback } from 'react';
import { Card } from '@/components/richmenu/common/Card';
import { Button } from '@/components/richmenu/common/Button';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/constants';

interface UploadMenuImageProps {
  onImageSelected: (base64: string | null) => void;
  onBack?: () => void;
}

export const UploadMenuImage: React.FC<UploadMenuImageProps> = ({ onImageSelected, onBack }) => {

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
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
        onImageSelected(result);
      };
      reader.readAsDataURL(file);
    }
  }, [onImageSelected]);

  const handleSkip = () => {
    // 移除 confirm 彈窗以確保點擊後立即執行，提升操作流暢度
    onImageSelected(null);
  };

  return (
    <div className="flex items-center justify-center h-full p-6 bg-background relative">
      <Card className="w-full max-w-2xl p-10 text-center shadow-2xl relative">
        {onBack && (
          <button
            onClick={onBack}
            className="absolute top-6 left-6 p-2 text-secondary hover:bg-gray-100 rounded-full transition-all"
            title="返回"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><polyline points="12 19 5 12 12 5" /></svg>
          </button>
        )}

        <h2 className="text-2xl font-bold text-text mb-2">建立主選單</h2>
        <p className="text-secondary mb-8">
          請先上傳背景圖片以開始編輯。背景圖是圖文選單的核心。
          <br />
          <span className="text-xs text-gray-400 font-mono mt-1 block">建議尺寸：{CANVAS_WIDTH} x {CANVAS_HEIGHT} px (最大 1MB)</span>
        </p>

        <label className="block w-full aspect-[2500/1686] max-w-lg mx-auto border-2 border-dashed border-border rounded-[24px] hover:border-primary hover:bg-primary/[0.02] transition-all cursor-pointer relative group overflow-hidden bg-gray-50/50">
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center text-primary mb-4 shadow-xl group-hover:scale-110 transition-transform duration-300">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            </div>
            <p className="font-bold text-text text-xl">點擊上傳背景圖片</p>
            <p className="text-sm text-secondary mt-2">支援 JPG, PNG 格式</p>
          </div>
        </label>

        <div className="mt-12 flex flex-col items-center gap-4">
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-secondary hover:text-primary font-bold px-8 py-3 rounded-full hover:bg-primary/5 transition-all group/skip"
          >
            暫不上傳背景，直接開始編輯
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1 group-hover/skip:translate-x-1 transition-transform"><path d="M5 12h14" /><polyline points="12 5 19 12 12 19" /></svg>
          </Button>
          <p className="text-[10px] text-gray-400">您可以先進入編輯器規劃熱區，稍後隨時再上傳圖片。</p>
        </div>
      </Card>
    </div>
  );
};
