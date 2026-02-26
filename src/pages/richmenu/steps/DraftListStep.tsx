import React, { useState } from 'react';
import { Card } from '@/components/richmenu/common/Card';
import { Button } from '@/components/richmenu/common/Button';
import { Project, Folder, ProjectStatus } from '@/lib/richmenuTypes';

interface DraftListStepProps {
  drafts: Project[];
  folders: Folder[];
  onSelectDraft: (id: string) => void;
  onDeleteDraft: (id: string) => void;
  onCreateNew: () => void;
  onAddFolder: () => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onMoveToFolder: (draftId: string, folderId: string | null) => void;
}

export const DraftListStep: React.FC<DraftListStepProps> = ({
  drafts,
  folders,
  onSelectDraft,
  onDeleteDraft,
  onCreateNew,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveToFolder
}) => {
  const [activeFolderId, setActiveFolderId] = useState<string | 'all' | 'unfiltered'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [statusFilter, setStatusFilter] = useState<'all' | ProjectStatus>('all');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const filteredDrafts = drafts
    .filter(d => {
      const folderMatch = activeFolderId === 'all' ? true : activeFolderId === 'unfiltered' ? !d.folderId : d.folderId === activeFolderId;
      const statusMatch = statusFilter === 'all' ? true : d.status === statusFilter;
      return folderMatch && statusMatch;
    })
    // 「發布中」狀態永遠排在最前面
    .sort((a, b) => (b.status === 'active' ? 1 : 0) - (a.status === 'active' ? 1 : 0));

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('draftId', id);
  };

  const handleDrop = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    const draftId = e.dataTransfer.getData('draftId');
    onMoveToFolder(draftId, folderId);
    setDragOverFolderId(null);
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active': return <span className="px-2 py-0.5 rounded-full bg-blue-500 text-white text-[10px] font-bold animate-pulse shadow-sm whitespace-nowrap">目前發布中</span>;
      case 'published': return <span className="px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-bold whitespace-nowrap">已發布</span>;
      case 'scheduled': return <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold whitespace-nowrap">已預約</span>;
      default: return <span className="px-2 py-0.5 rounded-full bg-gray-100 text-secondary text-[10px] font-bold whitespace-nowrap">草稿</span>;
    }
  };

  const handleDelete = (e: React.MouseEvent, draftId: string) => {
    e.stopPropagation();
    if (confirm('確定要刪除這個草稿嗎？此動作無法復原。')) {
      onDeleteDraft(draftId);
    }
  };

  const handleEdit = (e: React.MouseEvent, draftId: string) => {
    e.stopPropagation();
    onSelectDraft(draftId);
  };

  return (
    <div className="flex h-full bg-white">
      {/* Sidebar Dashboard */}
      <aside className="w-64 bg-gray-50 border-r border-border flex flex-col p-6">
        <div className="mb-8">
          <h3 className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-4">Dashboard</h3>
          <nav className="space-y-1">
            <button onClick={() => setActiveFolderId('all')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeFolderId === 'all' ? 'bg-primary/10 text-primary' : 'text-secondary hover:bg-gray-100'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
              所有專案
            </button>
            <button onClick={() => setActiveFolderId('unfiltered')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeFolderId === 'unfiltered' ? 'bg-primary/10 text-primary' : 'text-secondary hover:bg-gray-100'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
              未分類
            </button>
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-bold text-secondary uppercase tracking-widest">我的資料夾</h3>
            <button onClick={onAddFolder} className="text-primary hover:bg-primary/10 p-1 rounded transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>

          <nav className="space-y-1">
            {folders.map(folder => (
              <div
                key={folder.id}
                onDragOver={(e) => { e.preventDefault(); setDragOverFolderId(folder.id); }}
                onDragLeave={() => setDragOverFolderId(null)}
                onDrop={(e) => handleDrop(e, folder.id)}
                className={`group relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${activeFolderId === folder.id ? 'bg-white shadow-sm text-primary' : 'text-secondary hover:bg-gray-100'} ${dragOverFolderId === folder.id ? 'ring-2 ring-primary ring-inset bg-primary/5' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={activeFolderId === folder.id ? 'text-primary' : 'text-gray-400'}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                {editingFolderId === folder.id ? (
                  <input autoFocus className="bg-transparent border-none outline-none w-full" defaultValue={folder.name} onBlur={(e) => { onRenameFolder(folder.id, e.target.value); setEditingFolderId(null); }} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
                ) : (
                  <span onClick={() => setActiveFolderId(folder.id)} className="flex-1 truncate cursor-pointer">{folder.name}</span>
                )}
                <div className="absolute right-2 opacity-0 group-hover:opacity-100 flex gap-1 bg-inherit px-1">
                  <button onClick={() => setEditingFolderId(folder.id)} className="p-1 hover:text-primary"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg></button>
                  <button onClick={() => onDeleteFolder(folder.id)} className="p-1 hover:text-error"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /></svg></button>
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-10 py-12 flex flex-col">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text tracking-tight">
              {activeFolderId === 'all' ? '所有專案' : activeFolderId === 'unfiltered' ? '未分類專案' : folders.find(f => f.id === activeFolderId)?.name}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              {['all', 'draft', 'scheduled', 'published'].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status as any)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${statusFilter === status ? 'bg-primary text-white shadow-md' : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 hover:border-primary'}`}
                >
                  {status === 'all' ? '全部' : status === 'draft' ? '草稿' : status === 'scheduled' ? '已預約' : '已發布'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-gray-100 p-1 rounded-xl flex">
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-primary' : 'text-secondary hover:text-primary'}`}><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg></button>
              <button onClick={() => setViewMode('table')} className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-primary' : 'text-secondary hover:text-primary'}`}><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg></button>
            </div>
            <Button onClick={onCreateNew} className="px-6 py-2.5 shadow-lg shadow-primary/20">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              建立新專案
            </Button>
          </div>
        </div>

        {filteredDrafts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-24 bg-gray-50 rounded-[24px] border border-dashed border-border shadow-sm">
            <p className="text-secondary text-sm">此篩選條件下尚無內容</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-500">
            {filteredDrafts.map(draft => {
              const mainMenu = draft.menus.find(m => m.isMain) || draft.menus[0];
              const totalMenus = draft.menus.length;
              return (
                <Card key={draft.id} className="group cursor-grab active:cursor-grabbing hover:shadow-xl transition-all duration-300 border border-transparent hover:border-primary/20" onClick={() => onSelectDraft(draft.id)}>
                  <div draggable onDragStart={(e) => handleDragStart(e, draft.id)} className="aspect-[2500/1686] bg-gray-100 relative overflow-hidden">
                    {mainMenu?.imageData ? <img src={mainMenu.imageData} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={draft.name} /> : <div className="w-full h-full flex items-center justify-center text-gray-300 bg-gray-50"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg></div>}
                    <div className="absolute top-3 left-3 flex gap-1.5">{getStatusBadge(draft.status)}</div>

                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                      <button
                        onClick={(e) => handleEdit(e, draft.id)}
                        className="w-9 h-9 rounded-xl bg-white/90 backdrop-blur border border-border shadow-sm flex items-center justify-center text-secondary hover:text-primary hover:border-primary/30"
                        title="編輯"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></svg>
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, draft.id)}
                        className="w-9 h-9 rounded-xl bg-white/90 backdrop-blur border border-border shadow-sm flex items-center justify-center text-secondary hover:text-error hover:border-error/30"
                        title="刪除"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                      </button>
                    </div>

                    {draft.status === 'scheduled' && draft.scheduledAt && <div className="absolute bottom-0 left-0 right-0 bg-primary/90 text-white text-[10px] px-3 py-1.5 flex items-center gap-2 backdrop-blur-sm"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>預約發布：{draft.scheduledAt}</div>}
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-text group-hover:text-primary transition-colors truncate">{draft.name}</h3>
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-[10px] text-secondary bg-gray-100 px-2 py-0.5 rounded uppercase font-bold tracking-tight">{totalMenus} 個選單</span>
                      {(draft.status === 'published' || draft.status === 'active') && (
                        <span className="text-[10px] text-secondary font-medium">
                          {new Date(draft.updatedAt).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          <div className="bg-white rounded-[24px] border border-border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-border">
                  <th className="px-6 py-4 text-[11px] font-bold text-secondary uppercase tracking-widest w-1/3">專案名稱</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-secondary uppercase tracking-widest">目前狀態</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-secondary uppercase tracking-widest">排程時間</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-secondary uppercase tracking-widest">發布時間</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-secondary uppercase tracking-widest">資料夾</th>
                  <th className="px-6 py-4 text-[11px] font-bold text-secondary uppercase tracking-widest text-right">動作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredDrafts.map(draft => {
                  const mainMenu = draft.menus.find(m => m.isMain) || draft.menus[0];
                  return (
                    <tr key={draft.id} className="hover:bg-primary/5 transition-colors cursor-pointer group" onClick={() => onSelectDraft(draft.id)}>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-8 bg-gray-100 rounded border border-border overflow-hidden flex-shrink-0">
                            {mainMenu?.imageData && <img src={mainMenu.imageData} className="w-full h-full object-cover" />}
                          </div>
                          <span className="font-bold text-text truncate group-hover:text-primary transition-colors">{draft.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5">{getStatusBadge(draft.status)}</td>
                      <td className="px-6 py-5 text-sm text-secondary">{draft.scheduledAt || '未設定'}</td>
                      <td className="px-6 py-5 text-sm text-secondary">
                        {(draft.status === 'published' || draft.status === 'active')
                          ? new Date(draft.updatedAt).toLocaleString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
                          : '尚未發布'}
                      </td>
                      <td className="px-6 py-5 text-sm text-secondary">
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                          {folders.find(f => f.id === draft.folderId)?.name || '未分類'}
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={(e) => handleEdit(e, draft.id)}
                            className="px-3 py-2 rounded-lg text-xs font-bold bg-gray-100 text-secondary hover:bg-white hover:text-primary border border-transparent hover:border-primary/20 transition-all"
                          >
                            編輯
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, draft.id)}
                            className="px-3 py-2 rounded-lg text-xs font-bold bg-gray-100 text-secondary hover:bg-white hover:text-error border border-transparent hover:border-error/20 transition-all"
                          >
                            刪除
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};