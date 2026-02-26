import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Project, Folder, ProjectStatus } from "@/lib/richmenuTypes";

// 引入 Rich Menu 服務（稍後建立）
// import { draftService } from "@/lib/richmenuDraftService";

/**
 * Rich Menu 草稿列表頁面
 * 從 mutimessageditor App.tsx 萃取出來的 DraftListStep 功能
 */
export default function RichMenuDrafts() {
    const nav = useNavigate();
    const [drafts, setDrafts] = useState<Project[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

    // 載入用戶資料
    useEffect(() => {
        loadUserData();
    }, []);

    const loadUserData = async () => {
        try {
            setLoading(true);
            // 從 rm_drafts 表載入草稿
            const { data: draftsData, error: draftsError } = await supabase
                .from("rm_drafts")
                .select("*")
                .order("updated_at", { ascending: false });

            if (draftsError) throw draftsError;

            // 轉換資料格式
            const projects: Project[] = (draftsData || []).map((d: any) => ({
                id: d.id,
                name: d.name,
                status: d.status as ProjectStatus,
                folderId: d.folder_id,
                menus: d.data?.menus || [],
                updatedAt: d.updated_at,
            }));

            setDrafts(projects);

            // TODO: 載入資料夾
            setFolders([]);
        } catch (error) {
            console.error("Error loading drafts:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateNew = () => {
        // 導向上傳圖片頁面（稍後建立）
        nav("/richmenu/new");
    };

    const handleSelectDraft = (id: string) => {
        nav(`/richmenu/${id}/edit`);
    };

    const handleDeleteDraft = async (id: string) => {
        if (!confirm("確定要刪除此草稿嗎？")) return;

        try {
            const { error } = await supabase.from("rm_drafts").delete().eq("id", id);
            if (error) throw error;
            setDrafts((prev) => prev.filter((d) => d.id !== id));
        } catch (error) {
            console.error("Error deleting draft:", error);
            alert("刪除失敗");
        }
    };

    const handleGoBack = () => {
        nav("/home");
    };

    const getStatusBadge = (status: ProjectStatus) => {
        const styles = {
            draft: "bg-gray-100 text-gray-600",
            scheduled: "bg-yellow-100 text-yellow-700",
            published: "bg-blue-100 text-blue-700",
            active: "bg-green-100 text-green-700",
        };
        const labels = {
            draft: "草稿",
            scheduled: "已排程",
            published: "已發布",
            active: "使用中",
        };
        return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
                {labels[status]}
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
            {/* 頂部導航 */}
            <header className="sticky top-0 z-50 backdrop-blur-md bg-white/5 border-b border-white/10">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleGoBack}
                            className="p-2 hover:bg-white/10 rounded-xl text-white/60 hover:text-white transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                                </svg>
                            </div>
                            <span className="text-xl font-bold text-white">Rich Menu 編輯器</span>
                        </div>
                    </div>

                    <button
                        onClick={handleCreateNew}
                        className="px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/30 transition-all hover:scale-105"
                    >
                        <span className="flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                            </svg>
                            新建專案
                        </span>
                    </button>
                </div>
            </header>

            {/* 主內容區 */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="text-white/60">載入中...</div>
                    </div>
                ) : drafts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-20 h-20 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                            <svg className="w-10 h-10 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-white mb-2">還沒有任何專案</h3>
                        <p className="text-white/50 mb-6">點擊上方「新建專案」開始建立您的第一個圖文選單</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {drafts.map((draft) => (
                            <div
                                key={draft.id}
                                onClick={() => handleSelectDraft(draft.id)}
                                className="group relative bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
                            >
                                {/* 縮圖 */}
                                <div className="aspect-[2.5/1] bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                                    {draft.menus[0]?.imageData ? (
                                        <img
                                            src={draft.menus[0].imageData}
                                            alt={draft.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <span className="text-white/30 text-sm">無圖片</span>
                                    )}
                                </div>

                                {/* 資訊 */}
                                <div className="p-4">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <h3 className="font-semibold text-white truncate flex-1">{draft.name}</h3>
                                        {getStatusBadge(draft.status)}
                                    </div>
                                    <p className="text-sm text-white/40">
                                        {new Date(draft.updatedAt).toLocaleDateString("zh-TW", {
                                            year: "numeric",
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </p>
                                </div>

                                {/* 刪除按鈕 */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteDraft(draft.id);
                                    }}
                                    className="absolute top-3 right-3 p-2 bg-red-500/80 hover:bg-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all text-white"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
