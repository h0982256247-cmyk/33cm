import React, { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

// Types
import { AppStep, RichMenu, Folder, ProjectStatus, Project } from "@/lib/richmenuTypes";

// Steps
import { DraftListStep } from "./steps/DraftListStep";
import { UploadMenuImage } from "./steps/UploadMenuImage";
import { EditorPage } from "./EditorPage";
import { PreviewLineStep } from "./steps/PreviewLineStep";
import { PublishLineStep } from "./steps/PublishLineStep";

// Components
import { Button } from "@/components/richmenu/common/Button";

/**
 * Rich Menu 編輯器主頁面
 * 整合所有步驟的狀態機
 */
export default function RichMenuApp() {
    const nav = useNavigate();
    const [step, setStep] = useState<AppStep>(AppStep.DRAFT_LIST);
    const [menus, setMenus] = useState<RichMenu[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [selectedMenuId, setSelectedMenuId] = useState<string>("");
    const [selectedHotspotId, setSelectedHotspotId] = useState<string | null>(null);
    const [showSaveSuccess, setShowSaveSuccess] = useState(false);

    const [drafts, setDrafts] = useState<Project[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                loadUserData();
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                loadUserData();
            } else {
                setDrafts([]);
                setFolders([]);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const loadUserData = async () => {
        try {
            const { draftService } = await import("@/lib/draftService");
            const [userDrafts, userFolders] = await Promise.all([
                draftService.getDrafts(),
                draftService.getFolders()
            ]);
            setDrafts(userDrafts);
            setFolders(userFolders);
        } catch (error) {
            console.error("Error loading user data:", error);
        }
    };

    useEffect(() => {
        if (showSaveSuccess) {
            const timer = setTimeout(() => setShowSaveSuccess(false), 3000);
            return () => clearTimeout(timer);
        }
    }, [showSaveSuccess]);

    const handleAddFolder = async () => {
        try {
            const { draftService } = await import("@/lib/draftService");
            const newFolder = await draftService.createFolder("新資料夾");
            setFolders([...folders, newFolder]);
        } catch (e) {
            console.error("Failed to create folder:", e);
            alert("無法建立資料夾，請稍後再試");
        }
    };

    const handleRenameFolder = async (id: string, newName: string) => {
        const originalFolders = [...folders];
        setFolders(folders.map(f => f.id === id ? { ...f, name: newName } : f));

        try {
            const { draftService } = await import("@/lib/draftService");
            await draftService.updateFolder(id, newName);
        } catch (e) {
            console.error("Failed to rename folder:", e);
            setFolders(originalFolders);
        }
    };

    const handleDeleteFolder = async (id: string) => {
        if (!confirm("確定要刪除此資料夾嗎？")) return;

        const originalFolders = [...folders];
        const originalDrafts = [...drafts];

        setFolders(folders.filter(f => f.id !== id));
        setDrafts(drafts.map(d => d.folderId === id ? { ...d, folderId: null } : d));

        try {
            const { draftService } = await import("@/lib/draftService");
            await draftService.deleteFolder(id);
        } catch (e) {
            console.error("Failed to delete folder:", e);
            setFolders(originalFolders);
            setDrafts(originalDrafts);
            alert("刪除資料夾失敗");
        }
    };

    const handleMoveToFolder = (draftId: string, folderId: string | null) => {
        setDrafts(drafts.map(d => d.id === draftId ? { ...d, folderId } : d));
    };

    const handleCreateNewDraft = () => setStep(AppStep.UPLOAD);

    const handleSelectDraft = (id: string) => {
        const project = drafts.find(d => d.id === id);
        if (project) {
            setSelectedProjectId(project.id);
            setMenus(project.menus);
            const initialMenuId = project.menus.find(m => m.isMain)?.id || project.menus[0]?.id || "";
            setSelectedMenuId(initialMenuId);
            setStep(AppStep.EDITOR);
        }
    };

    const handleDeleteDraft = (id: string) => {
        setDrafts(prev => prev.filter(d => d.id !== id));
    };

    const handleImageUploaded = (base64: string | null) => {
        const projectId = crypto.randomUUID();
        const mainMenuId = crypto.randomUUID();

        const mainMenu: RichMenu = {
            id: mainMenuId,
            name: "主選單",
            barText: "選單",
            isMain: true,
            imageData: base64,
            hotspots: []
        };

        const newProject: Project = {
            id: projectId,
            name: "未命名專案",
            status: "draft",
            folderId: null,
            menus: [mainMenu],
            updatedAt: new Date().toISOString()
        };

        setDrafts(prev => [newProject, ...prev]);
        setSelectedProjectId(projectId);
        setMenus([mainMenu]);
        setSelectedMenuId(mainMenuId);
        setStep(AppStep.EDITOR);
    };

    const handleSaveDraft = useCallback(async () => {
        if (!selectedProjectId) return;

        const mainMenu = menus.find(m => m.isMain);
        const currentDraft = drafts.find(d => d.id === selectedProjectId);
        const updatedProject: Project = {
            id: selectedProjectId,
            name: mainMenu?.name || currentDraft?.name || "未命名專案",
            status: currentDraft?.status || "draft",
            folderId: currentDraft?.folderId || null,
            menus: [...menus],
            updatedAt: new Date().toISOString()
        };

        setDrafts(prev => prev.map(p => {
            if (p.id === selectedProjectId) {
                return { ...p, ...updatedProject };
            }
            return p;
        }));

        try {
            const { draftService } = await import("@/lib/draftService");
            await draftService.saveDraft(updatedProject);
        } catch (e) {
            console.error("Failed to save draft to database:", e);
        }

        setShowSaveSuccess(true);
    }, [menus, selectedProjectId, drafts]);

    const handleUpdateDraftStatus = (id: string, status: ProjectStatus, scheduledAt?: string) => {
        setDrafts(prev => prev.map(d => {
            const isMatch = d.id === id || d.menus.some(m => m.id === id);
            if (isMatch) {
                const newStatus = status === "published" ? "active" : status;
                return { ...d, status: newStatus, scheduledAt };
            }
            if (status === "published" && d.status === "active") {
                return { ...d, status: "published" };
            }
            return d;
        }));
        setStep(AppStep.DRAFT_LIST);
    };

    const handlePublishComplete = async (results: { aliasId: string; richMenuId: string }[]) => {
        if (!selectedProjectId) return;

        const updatedMenus = menus.map(menu => {
            const result = results.find(r => r.aliasId === `menu_${menu.id}`);
            if (result) {
                return {
                    ...menu,
                    lineRichMenuId: result.richMenuId,
                    lineAliasId: result.aliasId
                };
            }
            return menu;
        });

        setMenus(updatedMenus);

        const projectIndex = drafts.findIndex(d => d.id === selectedProjectId);
        if (projectIndex === -1) return;

        const currentProject = drafts[projectIndex];
        const previousActiveProject = drafts.find(d => d.status === "active" && d.id !== selectedProjectId);

        const updatedProject: Project = {
            ...currentProject,
            menus: updatedMenus,
            status: "active",
            updatedAt: new Date().toISOString()
        };

        setDrafts(prev => prev.map(d => {
            if (d.id === selectedProjectId) {
                return updatedProject;
            }
            if (d.id === previousActiveProject?.id) {
                return { ...d, status: "published" };
            }
            return d;
        }));

        try {
            const { draftService } = await import("@/lib/draftService");
            await draftService.saveDraft(updatedProject);
            if (previousActiveProject) {
                await draftService.saveDraft({ ...previousActiveProject, status: "published" });
            }
        } catch (e) {
            console.error("Failed to save published IDs or update statuses:", e);
        }
    };

    const handlePublishReset = () => {
        setMenus([]);
        setSelectedMenuId("");
        setSelectedHotspotId(null);
        setStep(AppStep.DRAFT_LIST);
    };

    const handleGoBack = () => {
        switch (step) {
            case AppStep.DRAFT_LIST: nav("/home"); break;
            case AppStep.UPLOAD: setStep(AppStep.DRAFT_LIST); break;
            case AppStep.EDITOR: setStep(AppStep.DRAFT_LIST); break;
            case AppStep.PREVIEW: setStep(AppStep.EDITOR); break;
            case AppStep.PUBLISH: setStep(AppStep.EDITOR); break;
            default: break;
        }
    };

    const handleLogout = () => {
        if (confirm("確定要登出系統嗎？")) {
            supabase.auth.signOut().finally(() => {
                setMenus([]);
                setSelectedMenuId("");
                nav("/");
            });
        }
    };

    const renderTopBar = () => (
        <header className="h-16 bg-white/80 backdrop-blur border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <button
                    onClick={handleGoBack}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition-all active:scale-90"
                    title="返回"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5" /><polyline points="12 19 5 12 12 5" /></svg>
                </button>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-sm">R</div>
                    <span className="font-bold text-gray-800 tracking-tight text-lg">Rich Menu <span className="text-cyan-500">編輯器</span></span>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {step === AppStep.DRAFT_LIST && (
                    <Button
                        variant="ghost"
                        onClick={handleLogout}
                        className="text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                        登出
                    </Button>
                )}

                {step === AppStep.EDITOR && (
                    <>
                        <Button variant="ghost" onClick={handleSaveDraft} className="hover:bg-gray-100 text-gray-500">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
                            儲存草稿
                        </Button>
                        <Button variant="ghost" onClick={() => setStep(AppStep.PREVIEW)} className="hover:bg-gray-100">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                            預覽測試
                        </Button>
                        <Button variant="primary" onClick={() => setStep(AppStep.PUBLISH)} className="px-8 shadow-lg shadow-cyan-500/20 bg-gradient-to-r from-cyan-500 to-blue-500">
                            完成發布
                        </Button>
                    </>
                )}
            </div>
        </header>
    );

    return (
        <div className="h-screen flex flex-col bg-gray-50 font-sans text-gray-800 overflow-hidden relative">
            {renderTopBar()}

            {showSaveSuccess && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top duration-500">
                    <div className="bg-white/90 backdrop-blur-xl shadow-lg border border-green-200 px-6 py-3 rounded-full flex items-center gap-3">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                        </div>
                        <span className="font-bold text-gray-800 text-sm">草稿儲存成功</span>
                    </div>
                </div>
            )}

            <main className="flex-1 overflow-hidden relative">
                {step === AppStep.DRAFT_LIST && (
                    <DraftListStep
                        drafts={drafts}
                        folders={folders}
                        onSelectDraft={handleSelectDraft}
                        onDeleteDraft={handleDeleteDraft}
                        onCreateNew={handleCreateNewDraft}
                        onAddFolder={handleAddFolder}
                        onRenameFolder={handleRenameFolder}
                        onDeleteFolder={handleDeleteFolder}
                        onMoveToFolder={handleMoveToFolder}
                    />
                )}
                {step === AppStep.UPLOAD && <UploadMenuImage onImageSelected={handleImageUploaded} onBack={handleGoBack} />}
                {step === AppStep.EDITOR && (
                    <EditorPage
                        menus={menus}
                        setMenus={setMenus}
                        selectedMenuId={selectedMenuId}
                        selectedHotspotId={selectedHotspotId}
                        setSelectedMenuId={setSelectedMenuId}
                        setSelectedHotspotId={setSelectedHotspotId}
                        onSaveDraft={handleSaveDraft}
                    />
                )}
                {step === AppStep.PREVIEW && <PreviewLineStep menus={menus} onClose={() => setStep(AppStep.EDITOR)} />}
                {step === AppStep.PUBLISH && (
                    <PublishLineStep
                        menus={menus}
                        onReset={handlePublishReset}
                        onStatusChange={handleUpdateDraftStatus}
                        onPublishComplete={handlePublishComplete}
                        onBack={handleGoBack}
                        onSaveDraft={handleSaveDraft}
                    />
                )}
            </main>
        </div>
    );
}
