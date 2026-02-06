import React, { useState } from 'react';
import { RichMenu } from '@/lib/richmenuTypes';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '@/lib/constants';

interface PreviewLineStepProps {
   menus: RichMenu[];
   onClose: () => void;
}

export const PreviewLineStep: React.FC<PreviewLineStepProps> = ({ menus, onClose }) => {
   const mainMenu = menus.find(m => m.isMain);
   const [currentMenuId, setCurrentMenuId] = useState<string | undefined>(mainMenu?.id);
   const [messages, setMessages] = useState<string[]>([]);
   const [showHotspots, setShowHotspots] = useState(true);

   const currentMenu = menus.find(m => m.id === currentMenuId);

   const handleAction = (action: any) => {
      if (action.type === 'switch') {
         setCurrentMenuId(action.data);
      } else if (action.type === 'message') {
         setMessages(prev => [...prev, action.data]);
      } else if (action.type === 'uri') {
         alert(`開啟連結： ${action.data}`);
      }
   };

   return (
      <div className="fixed inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center backdrop-blur-md overflow-hidden p-4">

         {/* Top Controls */}
         <div className="w-full max-w-[375px] flex justify-between items-center mb-6 px-2 animate-in fade-in slide-in-from-top duration-500">
            <div className="flex flex-col">
               <span className="text-white text-lg font-bold">預覽模擬器</span>
               <div className="flex items-center gap-2 mt-1">
                  <button
                     onClick={() => setShowHotspots(!showHotspots)}
                     className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${showHotspots ? 'bg-primary border-primary text-white' : 'bg-white/10 border-white/20 text-white/60'}`}
                  >
                     {showHotspots ? '隱藏熱區範圍' : '顯示熱區範圍'}
                  </button>
               </div>
            </div>
            <button
               onClick={onClose}
               className="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-full font-bold transition-all flex items-center gap-2 border border-white/10"
            >
               <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><polyline points="12 19 5 12 12 5" /></svg>
               返回編輯
            </button>
         </div>

         {/* iPhone Simulator */}
         <div className="relative w-full max-w-[375px] h-[780px] bg-[#FFFFFF] rounded-[55px] shadow-[0_0_100px_rgba(255,255,255,0.1)] overflow-hidden flex flex-col border-[10px] border-[#1a1a1a]">

            {/* Notch Area */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[160px] h-[35px] bg-[#1a1a1a] rounded-b-[20px] z-30 flex items-end justify-center pb-1">
               <div className="w-10 h-1 bg-[#222] rounded-full"></div>
            </div>

            {/* LINE Header */}
            <div className="h-[95px] bg-[#F9F9F9] border-b border-[#E5E5EA] flex items-end justify-between px-6 pb-3 pt-12">
               <div className="w-8">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
               </div>
               <span className="font-bold text-[17px]">LINE 官方帳號</span>
               <div className="w-8 flex justify-end">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
               </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 bg-[#8FBBE9] p-4 overflow-y-auto space-y-4 custom-scrollbar">
               <div className="flex flex-col items-center mb-6">
                  <div className="bg-black/10 rounded-full px-3 py-1 text-[11px] text-white/70">今天</div>
               </div>

               {messages.map((msg, i) => (
                  <div key={i} className="flex justify-end animate-in fade-in slide-in-from-right duration-300">
                     <div className="bg-[#8DE055] px-4 py-2.5 rounded-[20px] rounded-tr-[5px] max-w-[85%] text-[15px] shadow-sm font-medium">
                        {msg}
                     </div>
                  </div>
               ))}

               {messages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full opacity-30 text-white gap-4 italic text-sm text-center px-8">
                     <div className="w-16 h-16 rounded-full border border-white/50 border-dashed flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                     </div>
                     <span>點擊下方選單測試功能<br />目前顯示：{currentMenu?.name}</span>
                  </div>
               )}
            </div>

            {/* Rich Menu Area */}
            {currentMenu && (
               <div className="relative w-full border-t border-[#E5E5EA] bg-white shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
                  <div style={{ width: '100%', aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}`, position: 'relative' }}>
                     {currentMenu.imageData ? (
                        <img src={currentMenu.imageData} className="w-full h-full object-cover" alt="Menu" />
                     ) : (
                        <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300 font-bold">
                           [ 未設定背景圖 ]
                        </div>
                     )}

                     {currentMenu.hotspots.map((h, index) => (
                        <div
                           key={h.id}
                           onClick={() => handleAction(h.action)}
                           className={`absolute cursor-pointer transition-all duration-200 flex items-center justify-center
                        ${showHotspots ? 'bg-primary/20 border border-dashed border-primary/50' : 'active:bg-black/10'}`}
                           style={{
                              left: `${(h.x / CANVAS_WIDTH) * 100}%`,
                              top: `${(h.y / CANVAS_HEIGHT) * 100}%`,
                              width: `${(h.width / CANVAS_WIDTH) * 100}%`,
                              height: `${(h.height / CANVAS_HEIGHT) * 100}%`,
                              zIndex: 10
                           }}
                        >
                           {showHotspots && (
                              <span className="bg-primary text-white text-[8px] font-bold px-1 rounded-sm shadow-sm scale-75 opacity-70">
                                 #{index + 1}
                              </span>
                           )}
                        </div>
                     ))}
                  </div>
               </div>
            )}

            {/* Bottom Bar / Menu Bar Text */}
            <div className="h-[80px] bg-white w-full flex flex-col items-center justify-center relative border-t border-gray-100 overflow-hidden">
               {/* Menu Bar Display Text */}
               <div className="flex-1 w-full flex items-center justify-center px-4">
                  <span className="text-secondary text-sm font-medium tracking-wide flex items-center gap-1.5">
                     {currentMenu?.barText || '選單'}
                     <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="mt-0.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </span>
               </div>

               {/* iPhone Home Indicator */}
               <div className="h-[24px] w-full flex items-center justify-center relative">
                  <div className="w-[130px] h-[5px] bg-black rounded-full mb-2"></div>
               </div>
            </div>
         </div>
      </div>
   );
};