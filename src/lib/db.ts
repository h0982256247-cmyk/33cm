import { supabase } from "./supabase";
import { DocModel, ValidationReport } from "./types";
import { buildFlex } from "./buildFlex";
import { isPublishable, validateDoc } from "./validate";

export async function requireUser() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("NOT_AUTH");
  return data.user;
}

export async function listDocs() {
  const user = await requireUser();
  const { data, error } = await supabase.from("docs").select("*").eq("owner_id", user.id).order("updated_at", { ascending: false });
  if (error) throw error;
  return data as any[];
}

export async function getDoc(id: string) {
  const user = await requireUser();
  const { data, error } = await supabase.from("docs").select("*").eq("id", id).eq("owner_id", user.id).single();
  if (error) throw error;
  return data as any;
}

export async function createDoc(doc: DocModel) {
  const user = await requireUser();
  const rep = validateDoc(doc);
  const { data, error } = await supabase.from("docs").insert({ owner_id: user.id, type: doc.type, title: doc.title, content: doc, status: rep.status }).select("id").single();
  if (error) throw error;
  return data.id as string;
}

export async function saveDoc(id: string, doc: DocModel): Promise<ValidationReport> {
  const user = await requireUser();
  const rep = validateDoc(doc);
  const { error } = await supabase.from("docs").update({ title: doc.title, content: doc, status: rep.status, updated_at: new Date().toISOString() }).eq("id", id).eq("owner_id", user.id);
  if (error) throw error;
  return rep;
}

export async function deleteDoc(id: string) {
  const user = await requireUser();
  const { error } = await supabase.from("docs").delete().eq("id", id).eq("owner_id", user.id);
  if (error) throw error;
}

export async function publishDoc(id: string) {
  const user = await requireUser();
  const row = await getDoc(id);
  const doc = row.content as DocModel;
  const gate = isPublishable(doc);
  if (!gate.ok) throw new Error("NOT_PUBLISHABLE");

  const { data: last, error: lastErr } = await supabase.from("doc_versions").select("version_no").eq("doc_id", id).order("version_no", { ascending: false }).limit(1);
  if (lastErr) throw lastErr;
  const nextNo = (last?.[0]?.version_no || 0) + 1;

  // 先產生 token，再用 token 建立 flex（讓分享按鈕使用正確的 token URL）
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const liffId = import.meta.env.VITE_LIFF_ID as string | undefined;
  const flex = buildFlex(doc, id, token, liffId);
  const validation_report = validateDoc(doc);

  const { data: ver, error: verErr } = await supabase.from("doc_versions").insert({
    owner_id: user.id, doc_id: id, version_no: nextNo, flex_json: flex, validation_report
  }).select("id, version_no").single();
  if (verErr) throw verErr;

  await supabase.from("shares").update({ is_active: false }).eq("doc_id", id).eq("owner_id", user.id);
  const { error: sErr } = await supabase.from("shares").insert({ owner_id: user.id, doc_id: id, version_id: ver.id, token, is_active: true });
  if (sErr) throw sErr;

  return { token, versionNo: ver.version_no };
}

export async function getActiveShareForDoc(docId: string) {
  const user = await requireUser();
  const { data, error } = await supabase.from("shares")
    .select("token, version_id, doc_versions(version_no)")
    .eq("doc_id", docId).eq("owner_id", user.id).eq("is_active", true).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { token: (data as any).token, version_no: (data as any).doc_versions?.version_no ?? 0 };
}


// =====================
// Templates (DB)
// =====================
export type TemplateRow = {
  id: string;
  owner_id: string | null;
  is_public: boolean;
  name: string;
  description: string | null;
  doc_model: DocModel;
  created_at: string;
  updated_at: string;
};

export async function listTemplates() {
  const user = await requireUser();
  const { data, error } = await supabase
    .from("templates")
    .select("*")
    .or(`is_public.eq.true,owner_id.eq.${user.id}`)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data || []) as any as TemplateRow[];
}

export async function createTemplateFromDoc(name: string, description: string | null, doc: DocModel) {
  const user = await requireUser();
  const { error } = await supabase.from("templates").insert({
    owner_id: user.id,
    is_public: false,
    name,
    description,
    doc_model: doc,
  });
  if (error) throw error;
}

export async function deleteTemplate(templateId: string) {
  const user = await requireUser();
  const { error } = await supabase.from("templates").delete().eq("id", templateId).eq("owner_id", user.id);
  if (error) throw error;
}
export async function resolveShareToken(token: string) {
  const { data, error } = await supabase.rpc("get_share", { p_token: token });
  if (error) throw error;
  if (Array.isArray(data)) return data[0]; // Handle array return from table function
  return data;
}

export async function resolveDocIdToToken(docId: string) {
  const { data, error } = await supabase.rpc("get_active_token", { p_doc_id: docId });
  if (error) throw error;
  return data as string | null;
}
