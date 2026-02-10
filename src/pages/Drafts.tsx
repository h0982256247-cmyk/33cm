import React, { useEffect, useState } from "react";
import { listDocs, deleteDoc, createDoc, saveDoc } from "@/lib/db";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export default function Drafts() {
  const nav = useNavigate();
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  // Sidebar state: Default to true on desktop, false on mobile (initial check)
  const [isSidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768);

  useEffect(() => {
    load();
    const handleResize = () => {
      // Keep sidebar open on desktop, close on mobile if resized from desktop
      setSidebarOpen(window.innerWidth >= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [nav]);

  async function load() {
    try {
      const u = await supabase.auth.getUser();
      if (!u.data.user) return nav("/login");
      setRows(await listDocs());
    } catch (e: any) {
      setErr(e.message || "讀取失敗");
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`確定要刪除「${title}」嗎？此操作無法復原。`)) return;
    setDeleting(id);
    setErr(null);
    try {
      await deleteDoc(id);
      await load();
      // If deleted folder is current, go to root
      if (id === currentFolderId) setCurrentFolderId(undefined);
    } catch (e: any) {
      setErr(e.message || "刪除失敗");
    } finally {
      setDeleting(null);
    }
  }

  async function handleCreateFolder() {
    const name = prompt("請輸入資料夾名稱：");
    if (!name?.trim()) return;
    try {
      const folderDoc = { type: "folder", id: crypto.randomUUID(), name };
      await createDoc(folderDoc as any);
      await load();
    } catch (e: any) {
      alert(e.message || "建立資料夾失敗");
    }
  }

  async function handleDrop(e: React.DragEvent, targetFolderId?: string) {
    e.preventDefault();
    const docId = e.dataTransfer.getData("text/plain");
    if (!docId) return;

    const doc = rows.find(r => r.id === docId);
    if (!doc) return;
    if (doc.content.type === "folder") return; // Don't allow nesting folders for now
    if (doc.content.folderId === targetFolderId) return; // Already in folder

    try {
      const newContent = { ...doc.content, folderId: targetFolderId };
      await saveDoc(docId, newContent);
      await load();
    } catch (e: any) {
      console.error(e);
      alert("移動失敗");
    }
  }

  // Separate folders and files
  const folders = rows.filter(r => r.content.type === "folder");

  // Filter Logic: If searching, search GLOBAL (all files). Else show current folder.
  const files = rows.filter(r => {
    if (r.content.type === "folder") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (r.content.name || "").toLowerCase().includes(q) || (r.title || "").toLowerCase().includes(q);
    }

    return r.content.folderId === currentFolderId || (!r.content.folderId && !currentFolderId);
  });

  return (
    <div className="bg-slate-50 h-screen flex flex-col overflow-hidden font-sans">
      {/* Header */}
      <div className="h-16 bg-white border-b border-gray-200 px-4 md:px-6 flex items-center justify-between shrink-0 z-20 gap-4">
        <div className="flex items-center gap-3 shrink-0">
          {/* Toggle Sidebar Button */}
          <button
            className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors md:hidden"
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? "收起列表" : "展開列表"}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <button
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => nav("/home")}
            title="返回上一頁"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <h1 className="text-lg font-semibold text-gray-900 tracking-tight hidden sm:block">我的卡片</h1>
        </div>

        {/* Search Bar */}
        <div className="flex-1 max-w-md mx-auto relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <input
            type="text"
            placeholder="搜尋草稿..."
            className="w-full h-9 pl-9 pr-4 bg-gray-50 border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-gray-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <button
            className="px-3 md:px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200/50 whitespace-nowrap"
            onClick={handleCreateFolder}
          >
            ＋<span className="hidden md:inline"> 資料夾</span>
          </button>
          <button
            className="px-3 md:px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-200/50 rounded-lg transition-all whitespace-nowrap"
            onClick={() => nav("/drafts/new")}
          >
            新增<span className="hidden md:inline">草稿</span>
          </button>
          <div className="w-px h-6 bg-gray-200 mx-1 hidden sm:block"></div>
          <button
            className="w-9 h-9 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center hover:bg-gray-200 transition-colors"
            onClick={async () => { if (confirm("確定要登出嗎？")) { await supabase.auth.signOut(); nav("/"); } }}
            title="登出"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Backdrop */}
        {isSidebarOpen && (
          <div
            className="absolute inset-0 bg-black/20 z-30 md:hidden backdrop-blur-sm transition-opacity"
            onClick={() => setSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <div
          className={`
            absolute inset-y-0 left-0 z-40 w-64 bg-gray-50 border-r border-gray-200 flex flex-col pt-4 pb-4 overflow-y-auto transition-transform duration-300 ease-in-out
            md:static md:translate-x-0
            ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:w-0 md:border-none md:overflow-hidden"}
          `}
        >
          <div className="px-4 mb-2 md:opacity-100 transition-opacity whitespace-nowrap">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Folders</div>
          </div>

          <div className="space-y-1 px-2 whitespace-nowrap">
            {/* Root Tab */}
            <button
              className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left flex items-center gap-3 ${currentFolderId === undefined && !searchQuery
                ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
                : "text-gray-600 hover:bg-gray-200/50 hover:text-gray-900"
                }`}
              onClick={() => {
                setSearchQuery(""); // Clear search when navigating
                setCurrentFolderId(undefined);
                if (window.innerWidth < 768) setSidebarOpen(false);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleDrop(e, undefined)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={currentFolderId === undefined && !searchQuery ? "text-blue-500" : "text-gray-400"}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
              全部 / 未分類
            </button>

            {/* Folder List */}
            {folders.map((folder) => (
              <div
                key={folder.id}
                className={`group relative w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left flex items-center gap-3 cursor-pointer ${currentFolderId === folder.id && !searchQuery
                  ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
                  : "text-gray-600 hover:bg-gray-200/50 hover:text-gray-900"
                  }`}
                onClick={() => {
                  setSearchQuery(""); // Clear search when navigating
                  setCurrentFolderId(folder.id);
                  if (window.innerWidth < 768) setSidebarOpen(false);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, folder.id)}
              >
                <div className={currentFolderId === folder.id && !searchQuery ? "text-amber-500" : "text-gray-400"}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                </div>
                <span className="flex-1 truncate">{folder.content.name}</span>

                {/* Delete Folder Button */}
                <button
                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-100 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(folder.id, folder.content.name);
                  }}
                  disabled={deleting === folder.id}
                  title="刪除資料夾"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            ))}
          </div>

          <div className="mt-auto px-4 pt-4 text-xs text-gray-400 flex items-center gap-1 whitespace-nowrap overflow-hidden">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            <span className="truncate">提示：拖曳卡片至左側可分類</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50/30 p-4 md:p-8 w-full">
          <div className="max-w-6xl mx-auto">
            {err ? <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm border border-red-100">{err}</div> : null}

            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg md:text-xl font-bold text-gray-800 flex items-center gap-2">
                {searchQuery
                  ? `搜尋結果：${searchQuery}`
                  : currentFolderId === undefined ? "全部 / 未分類" : folders.find(f => f.id === currentFolderId)?.content.name}
              </h2>
              <span className="text-xs md:text-sm text-gray-500 bg-white px-2 py-1 rounded-full border border-gray-200 shadow-sm whitespace-nowrap">{files.length} 項目</span>
            </div>

            {/* Files Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
              {files.map((r) => (
                <div
                  key={r.id}
                  className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-lg transition-all group relative hover:-translate-y-1"
                  draggable={true}
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", r.id)}
                >
                  <div className="p-4 md:p-5 cursor-pointer" onClick={() => nav(`/drafts/${r.id}/edit`)}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        <div className="font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate text-base pr-2">
                          {r.content.name || r.title || "未命名"}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">{r.content.type}</span>
                          <span className="text-[10px] text-gray-400 truncate">{new Date(r.updated_at).toLocaleDateString()}</span>
                          {searchQuery && r.content.folderId && folders.find(f => f.id === r.content.folderId) && (
                            <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded truncate max-w-[80px]">
                              📁 {folders.find(f => f.id === r.content.folderId)?.content.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium border ${r.status === "publishable" ? "bg-green-50 text-green-700 border-green-100" : r.status === "previewable" ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-gray-50 text-gray-600 border-gray-100"
                        }`}>
                        {r.status === "publishable" ? "已發布" : r.status === "previewable" ? "可預覽" : "草稿"}
                      </span>
                    </div>
                  </div>

                  <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2 bg-gray-50/50">
                    <button
                      className="flex-1 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded shadow-sm transition-colors"
                      onClick={() => nav(`/drafts/${r.id}/edit`)}
                    >
                      編輯
                    </button>
                    <button
                      className="flex-1 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 rounded shadow-sm transition-colors"
                      onClick={() => nav(`/drafts/${r.id}/preview`)}
                    >
                      預覽
                    </button>
                    <button
                      className="w-8 h-[30px] flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors group/del"
                      disabled={deleting === r.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(r.id, r.title || r.content.name);
                      }}
                      title="刪除"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </div>
              ))}

              {files.length === 0 && (
                <div className="col-span-full py-24 flex flex-col items-center justify-center text-center opacity-70">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-4xl text-gray-300">
                    {searchQuery ? "🔍" : "📭"}
                  </div>
                  <p className="text-gray-900 font-medium text-lg">{searchQuery ? "沒有找到符合的草稿" : "沒有卡片"}</p>
                  <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
                    {searchQuery ? "請嘗試不同的關鍵字，或清除搜尋條件" : "點擊右上角「新增草稿」開始建立您的第一張 Flex Message"}
                  </p>
                  {searchQuery ? (
                    <div className="mt-6 flex gap-3">
                      <button className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all" onClick={() => setSearchQuery("")}>
                        清除搜尋
                      </button>
                    </div>
                  ) : (
                    <div className="mt-6 flex gap-3">
                      <button className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-lg shadow-blue-200/50 transition-all" onClick={() => nav("/drafts/new")}>
                        立即新增草稿
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-12 text-center text-xs text-gray-300">
              Flex Editor v1.0.4
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
