import React from 'react';
import { Hotspot } from '../../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../../constants';

interface LineHotspotBoxProps {
  hotspot: Hotspot;
  isSelected: boolean;
  onSelect: (id: string) => void;
  index: number;
  onDragStart: (e: React.MouseEvent, id: string) => void;
  onResizeStart: (e: React.MouseEvent, id: string, handle: string) => void;
}

export const LineHotspotBox: React.FC<LineHotspotBoxProps> = ({ 
  hotspot, 
  isSelected, 
  index,
  onDragStart,
  onResizeStart
}) => {
  const style: React.CSSProperties = {
    left: `${(hotspot.x / CANVAS_WIDTH) * 100}%`,
    top: `${(hotspot.y / CANVAS_HEIGHT) * 100}%`,
    width: `${(hotspot.width / CANVAS_WIDTH) * 100}%`,
    height: `${(hotspot.height / CANVAS_HEIGHT) * 100}%`,
    position: 'absolute',
  };

  const label = hotspot.action.type === 'switch' ? '切換' : hotspot.action.type === 'uri' ? '連結' : '訊息';

  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDragStart(e, hotspot.id);
  };

  const handleResizeDown = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    onResizeStart(e, hotspot.id, handle);
  };

  // Helper for larger hit area handles
  const ResizeHandle = ({ type, className }: { type: string, className: string }) => (
    <div 
      className={`absolute w-8 h-8 flex items-center justify-center z-30 group/handle cursor-${type}-resize ${className}`}
      onMouseDown={(e) => handleResizeDown(e, type)}
    >
      <div className="w-3 h-3 bg-white border-2 border-primary rounded-full shadow-md group-hover/handle:scale-150 transition-transform duration-200" />
    </div>
  );

  return (
    <div
      style={style}
      onMouseDown={handleMouseDown}
      className={`
        group absolute flex items-center justify-center
        ${isSelected 
          ? 'border-[3px] border-primary bg-primary/25 z-20 cursor-move shadow-[0_0_20px_rgba(0,122,255,0.4)]' 
          : 'border border-white/40 bg-black/10 hover:bg-primary/10 hover:border-primary/50 z-10 cursor-pointer'
        }
      `}
    >
      <div className={`
        bg-white/95 backdrop-blur text-[10px] px-2.5 py-1 rounded-full shadow-lg font-bold pointer-events-none select-none flex items-center gap-1.5 transform transition-all
        ${isSelected ? 'text-primary scale-110 shadow-primary/20' : 'text-secondary opacity-80'}
      `}>
        <span className="bg-gray-100 px-1 rounded text-[8px] font-mono">#{index + 1}</span>
        <span className="truncate max-w-[80px]">{label}</span>
      </div>
      
      {isSelected && (
        <>
          <ResizeHandle type="nw" className="top-0 left-0 -translate-x-1/2 -translate-y-1/2" />
          <ResizeHandle type="ne" className="top-0 right-0 translate-x-1/2 -translate-y-1/2" />
          <ResizeHandle type="sw" className="bottom-0 left-0 -translate-x-1/2 translate-y-1/2" />
          <ResizeHandle type="se" className="bottom-0 right-0 translate-x-1/2 translate-y-1/2" />
        </>
      )}
    </div>
  );
};