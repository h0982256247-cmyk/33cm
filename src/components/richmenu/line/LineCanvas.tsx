
import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { RichMenu, Hotspot } from '../../types';
import { LineHotspotBox } from './LineHotspotBox';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../constants';

interface LineCanvasProps {
  menu: RichMenu;
  selectedHotspotId: string | null;
  onSelectHotspot: (id: string | null) => void;
  onUpdateHotspot: (hotspot: Hotspot) => void;
  onAddHotspot: (hotspot: Hotspot) => void;
}

type DragMode = 'move' | 'resize';
type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface DragState {
  mode: DragMode;
  hotspotId: string;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  initialWidth: number;
  initialHeight: number;
  handle?: ResizeHandle;
  hasMoved: boolean;
}

const DRAG_THRESHOLD = 3; 

export const LineCanvas: React.FC<LineCanvasProps> = ({ 
  menu, 
  selectedHotspotId, 
  onSelectHotspot,
  onUpdateHotspot,
  onAddHotspot
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

  // 檢查兩個熱區是否重疊的邏輯
  const isOverlapping = (h1: Hotspot, h2: Hotspot) => {
    return (
      h1.x < h2.x + h2.width &&
      h1.x + h1.width > h2.x &&
      h1.y < h2.y + h2.height &&
      h1.y + h1.height > h2.y
    );
  };

  // 偵測目前選單中是否有任何重疊
  const hasOverlap = useMemo(() => {
    const hotspots = menu.hotspots;
    for (let i = 0; i < hotspots.length; i++) {
      for (let j = i + 1; j < hotspots.length; j++) {
        if (isOverlapping(hotspots[i], hotspots[j])) {
          return true;
        }
      }
    }
    return false;
  }, [menu.hotspots]);

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onSelectHotspot(null);
    }
  };

  const handleDragStart = (e: React.MouseEvent, id: string) => {
    const hotspot = menu.hotspots.find(h => h.id === id);
    if (!hotspot) return;
    onSelectHotspot(id);
    setDragState({
      mode: 'move',
      hotspotId: id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: hotspot.x,
      initialY: hotspot.y,
      initialWidth: hotspot.width,
      initialHeight: hotspot.height,
      hasMoved: false
    });
  };

  const handleResizeStart = (e: React.MouseEvent, id: string, handle: string) => {
    const hotspot = menu.hotspots.find(h => h.id === id);
    if (!hotspot) return;
    setDragState({
      mode: 'resize',
      hotspotId: id,
      startX: e.clientX,
      startY: e.clientY,
      initialX: hotspot.x,
      initialY: hotspot.y,
      initialWidth: hotspot.width,
      initialHeight: hotspot.height,
      handle: handle as ResizeHandle,
      hasMoved: true
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState || !containerRef.current) return;

    if (dragState.mode === 'move' && !dragState.hasMoved) {
      if (Math.abs(e.clientX - dragState.startX) > DRAG_THRESHOLD || Math.abs(e.clientY - dragState.startY) > DRAG_THRESHOLD) {
        setDragState(prev => prev ? { ...prev, hasMoved: true } : null);
      } else {
        return;
      }
    }

    const rect = containerRef.current.getBoundingClientRect();
    const scale = rect.width / CANVAS_WIDTH;
    const deltaX = (e.clientX - dragState.startX) / scale;
    const deltaY = (e.clientY - dragState.startY) / scale;

    let newX = dragState.initialX;
    let newY = dragState.initialY;
    let newW = dragState.initialWidth;
    let newH = dragState.initialHeight;

    if (dragState.mode === 'move') {
      newX = Math.max(0, Math.min(dragState.initialX + deltaX, CANVAS_WIDTH - newW));
      newY = Math.max(0, Math.min(dragState.initialY + deltaY, CANVAS_HEIGHT - newH));
    } else if (dragState.mode === 'resize' && dragState.handle) {
      const minSize = 40; 
      if (dragState.handle.includes('e')) {
        newW = Math.min(Math.max(minSize, dragState.initialWidth + deltaX), CANVAS_WIDTH - dragState.initialX);
      }
      if (dragState.handle.includes('s')) {
        newH = Math.min(Math.max(minSize, dragState.initialHeight + deltaY), CANVAS_HEIGHT - dragState.initialY);
      }
      if (dragState.handle.includes('w')) {
        const maxDelta = dragState.initialWidth - minSize;
        const clampedDelta = Math.min(Math.max(deltaX, -dragState.initialX), maxDelta);
        newX = dragState.initialX + clampedDelta;
        newW = dragState.initialWidth - clampedDelta;
      }
      if (dragState.handle.includes('n')) {
        const maxDelta = dragState.initialHeight - minSize;
        const clampedDelta = Math.min(Math.max(deltaY, -dragState.initialY), maxDelta);
        newY = dragState.initialY + clampedDelta;
        newH = dragState.initialHeight - clampedDelta;
      }
    }

    onUpdateHotspot({
      ...menu.hotspots.find(h => h.id === dragState.hotspotId)!,
      x: Math.round(newX),
      y: Math.round(newY),
      width: Math.round(newW),
      height: Math.round(newH)
    });
  }, [dragState, menu.hotspots, onUpdateHotspot]);

  const handleMouseUp = useCallback(() => setDragState(null), []);

  useEffect(() => {
    if (dragState) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, handleMouseMove, handleMouseUp]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#F0F0F2]">
       <div className="bg-white border-b border-border p-3 flex justify-between items-center text-[11px] text-secondary z-20 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-primary font-bold">{CANVAS_WIDTH} x {CANVAS_HEIGHT}</span>
            <div className="h-4 w-px bg-border" />
            <span className="flex items-center gap-1.5">
               <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
               編輯模式
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>{menu.hotspots.length} 個作用中區域</span>
          </div>
       </div>

       {/* 重疊提醒列 */}
       {hasOverlap && (
         <div className="bg-orange-500/10 text-orange-600 px-4 py-2 text-[11px] font-bold flex items-center justify-center gap-2 border-b border-orange-500/20 z-10 animate-in fade-in slide-in-from-top duration-300">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            偵測到點擊區域重疊：部分按鈕可能無法被正常觸發，建議調整位置。
         </div>
       )}

       {/* Missing Image Warning */}
       {!menu.imageData && (
         <div className="bg-error/10 text-error px-4 py-2 text-xs font-medium flex items-center justify-center gap-2 border-b border-error/20 z-10 animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            尚未設定背景圖片，這將導致選單無法正常顯示。請至右側「選單設定」上傳。
         </div>
       )}
       
       <div className="flex-1 flex items-center justify-center p-12 overflow-auto">
          <div 
            ref={containerRef}
            className="relative bg-white shadow-[0_32px_64px_rgba(0,0,0,0.15)] select-none"
            style={{ 
              aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}`,
              width: '100%',
              maxWidth: '900px',
              backgroundImage: menu.imageData ? `url(${menu.imageData})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
            onMouseDown={handleBackgroundClick}
          >
             {!menu.imageData && (
               <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-200 gap-4 bg-gray-50/50">
                 <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                 <span className="font-medium tracking-wide">無背景圖片</span>
               </div>
             )}
             
             {menu.hotspots.map((hotspot, index) => (
               <LineHotspotBox
                  key={hotspot.id}
                  hotspot={hotspot}
                  index={index}
                  isSelected={selectedHotspotId === hotspot.id}
                  onSelect={onSelectHotspot}
                  onDragStart={handleDragStart}
                  onResizeStart={handleResizeStart}
               />
             ))}
          </div>
       </div>
    </div>
  );
};
