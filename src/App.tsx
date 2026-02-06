import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Drafts from "@/pages/Drafts";
import NewDraft from "@/pages/NewDraft";
import EditDraft from "@/pages/EditDraft";
import PreviewDraft from "@/pages/PreviewDraft";
import Share from "@/pages/Share";

// Rich Menu 相關頁面
import RichMenuApp from "@/pages/richmenu/RichMenuApp";

export default function App() {
  return (
    <Routes>
      {/* 入口直接顯示登入 */}
      <Route path="/" element={<Login />} />
      <Route path="/home" element={<Home />} />

      {/* Flex Message 編輯器 */}
      <Route path="/drafts" element={<Drafts />} />
      <Route path="/drafts/new" element={<NewDraft />} />
      <Route path="/drafts/:id/edit" element={<EditDraft />} />
      <Route path="/drafts/:id/preview" element={<PreviewDraft />} />
      <Route path="/share" element={<Share />} />

      {/* Rich Menu 編輯器 */}
      <Route path="/richmenu" element={<RichMenuApp />} />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
