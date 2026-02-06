import React from 'react';
import { RichMenu } from '../../types';

interface LineMenuListProps {
  menus: RichMenu[];
  selectedMenuId: string;
  onSelectMenu: (id: string) => void;
  onAddSubMenu: () => void;
  onDeleteSubMenu: (id: string) => void;
}

interface MenuRowProps {
  menu: RichMenu;
  selectedMenuId: string;
  onSelectMenu: (id: string) => void;
  onDeleteSubMenu: (id: string) => void;
}

const MenuRow = React.memo<MenuRowProps>(({ menu, selectedMenuId, onSelectMenu, onDeleteSubMenu }) => (
  <div
    onClick={() => onSelectMenu(menu.id)}
    className={`
      relative group p-3 rounded-[10px] cursor-pointer transition-all border mb-2
      ${selectedMenuId === menu.id
        ? 'bg-white border-primary shadow-sm'
        : 'bg-white border-transparent hover:border-border'
      }
    `}
  >
    <div className="flex items-center gap-3">
      {/* Thumbnail - 使用 object-cover 確保不會變形 */}
      <div className="w-12 h-8 bg-gray-200 rounded flex-shrink-0 overflow-hidden border border-gray-100 relative">
        {menu.imageData ? (
          <img
            src={menu.imageData}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">?</div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate text-text">{menu.name}</div>
        <div className="text-xs text-secondary">{menu.hotspots.length} 個動作</div>
      </div>

      {/* Delete (only for sub) */}
      {!menu.isMain && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteSubMenu(menu.id);
          }}
          className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-error hover:bg-error/10 rounded transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
        </button>
      )}
    </div>

    {menu.isMain && (
      <div className="absolute -top-1 -right-1 bg-yellow-400 text-yellow-900 p-0.5 rounded-full shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M2 4l3 12h14l3-12-6 7-4-3-4 3-6-7zm0 18h20v1H2v-1z" /></svg>
      </div>
    )}
  </div>
));

export const LineMenuList = React.memo<LineMenuListProps>(({
  menus,
  selectedMenuId,
  onSelectMenu,
  onAddSubMenu,
  onDeleteSubMenu
}) => {
  const mainMenu = menus.find(m => m.isMain);
  const subMenus = menus.filter(m => !m.isMain);

  return (
    <div className="h-full flex flex-col bg-[#F5F5F7] border-r border-border overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {/* Main Menu Section */}
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3 px-2">主選單</h2>
          {mainMenu && (
            <MenuRow
              menu={mainMenu}
              selectedMenuId={selectedMenuId}
              onSelectMenu={onSelectMenu}
              onDeleteSubMenu={onDeleteSubMenu}
            />
          )}
        </div>

        {/* Sub Menu Section */}
        <div>
          <h2 className="text-xs font-semibold text-secondary uppercase tracking-wider mb-3 px-2">子選單</h2>

          <div className="space-y-2">
            {subMenus.map(menu => (
              <MenuRow
                key={menu.id}
                menu={menu}
                selectedMenuId={selectedMenuId}
                onSelectMenu={onSelectMenu}
                onDeleteSubMenu={onDeleteSubMenu}
              />
            ))}

            {/* Add Button - placed directly after list */}
            <button
              onClick={onAddSubMenu}
              className="w-full flex items-center justify-center gap-2 py-3 px-3 rounded-[10px] text-secondary border border-dashed border-border hover:border-primary hover:text-primary hover:bg-primary/5 transition-all text-sm font-medium mt-2 group"
            >
              <div className="w-5 h-5 rounded-full bg-gray-200 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </div>
              新增子選單
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});