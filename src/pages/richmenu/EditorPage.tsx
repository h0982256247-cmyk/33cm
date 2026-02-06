
import React from 'react';
import { RichMenu, Hotspot } from '@/lib/richmenuTypes';
import { LineMenuList } from '@/components/richmenu/line/LineMenuList';
import { LineCanvas } from '@/components/richmenu/line/LineCanvas';
import { LineInspector } from '@/components/richmenu/line/LineInspector';
import { CANVAS_WIDTH, CANVAS_HEIGHT, DEFAULT_HOTSPOT_SIZE } from '@/lib/constants';

interface EditorPageProps {
  menus: RichMenu[];
  selectedMenuId: string;
  selectedHotspotId: string | null;
  setMenus: React.Dispatch<React.SetStateAction<RichMenu[]>>;
  setSelectedMenuId: (id: string) => void;
  setSelectedHotspotId: (id: string | null) => void;
  onSaveDraft: () => void;
}

export const EditorPage: React.FC<EditorPageProps> = ({
  menus,
  selectedMenuId,
  selectedHotspotId,
  setMenus,
  setSelectedMenuId,
  setSelectedHotspotId,
  onSaveDraft
}) => {
  const currentMenu = menus.find(m => m.id === selectedMenuId);
  if (!currentMenu) return null;

  const currentHotspot = currentMenu.hotspots.find(h => h.id === selectedHotspotId);

  // --- Handlers (wrapped with useCallback for performance) ---

  const handleAddSubMenu = React.useCallback(() => {
    const subMenuCount = menus.filter(m => !m.isMain).length;
    if (subMenuCount >= 9) {
      alert('子選單最多 9 頁，已達上限');
      return;
    }

    const newMenu: RichMenu = {
      id: crypto.randomUUID(),
      name: `新子選單 ${subMenuCount + 1}`,
      barText: '選單',
      isMain: false,
      imageData: null,
      hotspots: []
    };

    setMenus(prev => [...prev, newMenu]);
    setSelectedMenuId(newMenu.id);
  }, [menus, setMenus, setSelectedMenuId]);

  const handleDeleteSubMenu = React.useCallback((id: string) => {
    setMenus(prev => prev.filter(m => m.id !== id));
    if (selectedMenuId === id) {
      setSelectedMenuId(menus.find(m => m.isMain)?.id || '');
    }
  }, [menus, selectedMenuId, setMenus, setSelectedMenuId]);

  const handleUpdateMenu = React.useCallback((updates: Partial<RichMenu>) => {
    setMenus(prev => prev.map(m => {
      if (m.id === selectedMenuId) {
        return { ...m, ...updates };
      }
      return m;
    }));
  }, [selectedMenuId, setMenus]);

  const handleUpdateHotspot = React.useCallback((hotspot: Hotspot) => {
    setMenus(prev => prev.map(m => {
      if (m.id === selectedMenuId) {
        return {
          ...m,
          hotspots: m.hotspots.map(h => h.id === hotspot.id ? hotspot : h)
        };
      }
      return m;
    }));
  }, [selectedMenuId, setMenus]);

  const handleAddHotspot = React.useCallback((hotspot: Hotspot) => {
    setMenus(prev => prev.map(m => {
      if (m.id === selectedMenuId) {
        return { ...m, hotspots: [...m.hotspots, hotspot] };
      }
      return m;
    }));
  }, [selectedMenuId, setMenus]);

  const createNewHotspot = React.useCallback(() => {
    const width = DEFAULT_HOTSPOT_SIZE.width;
    const height = DEFAULT_HOTSPOT_SIZE.height;
    const x = Math.round((CANVAS_WIDTH - width) / 2);
    const y = Math.round((CANVAS_HEIGHT - height) / 2);

    const newHotspot: Hotspot = {
      id: crypto.randomUUID(),
      x,
      y,
      width,
      height,
      action: { type: 'message', data: '' }
    };

    handleAddHotspot(newHotspot);
    setSelectedHotspotId(newHotspot.id);
  }, [handleAddHotspot, setSelectedHotspotId]);

  const handleDeleteHotspot = React.useCallback((id: string) => {
    setMenus(prev => prev.map(m => {
      if (m.id === selectedMenuId) {
        return { ...m, hotspots: m.hotspots.filter(h => h.id !== id) };
      }
      return m;
    }));
    setSelectedHotspotId(null);
  }, [selectedMenuId, setMenus, setSelectedHotspotId]);

  const handleUpdateInspector = React.useCallback((updates: Partial<Hotspot>) => {
    if (!currentHotspot) return;
    handleUpdateHotspot({ ...currentHotspot, ...updates });
  }, [currentHotspot, handleUpdateHotspot]);

  return (
    <div className="flex h-full border-t border-border">
      {/* Left Sidebar: Menus */}
      <div className="w-64 h-full bg-[#F5F5F7] flex-shrink-0 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
        <LineMenuList
          menus={menus}
          selectedMenuId={selectedMenuId}
          onSelectMenu={(id) => {
            setSelectedMenuId(id);
            setSelectedHotspotId(null);
          }}
          onAddSubMenu={handleAddSubMenu}
          onDeleteSubMenu={handleDeleteSubMenu}
        />
      </div>

      {/* Center: Canvas */}
      <div className="flex-1 h-full relative z-0">
        <LineCanvas
          menu={currentMenu}
          selectedHotspotId={selectedHotspotId}
          onSelectHotspot={setSelectedHotspotId}
          onUpdateHotspot={handleUpdateHotspot}
          onAddHotspot={handleAddHotspot}
        />
      </div>

      {/* Right Sidebar: Inspector */}
      <div className="w-80 h-full bg-white border-l border-border flex-shrink-0 z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.02)]">
        <LineInspector
          hotspot={currentHotspot}
          selectedMenu={currentMenu}
          allMenus={menus}
          onUpdate={handleUpdateInspector}
          onUpdateMenu={handleUpdateMenu}
          onDelete={handleDeleteHotspot}
          onAdd={createNewHotspot}
          onSave={onSaveDraft}
          onDeselectHotspot={() => setSelectedHotspotId(null)}
        />
      </div>
    </div>
  );
};