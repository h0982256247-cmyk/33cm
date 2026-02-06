export type ActionType = 'switch' | 'message' | 'uri' | 'postback' | 'none';

export interface Action {
  type: ActionType;
  label?: string;
  data: string;
  fillInText?: string; // 預填文字 (僅用於 postback 類型)
}

export interface Hotspot {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  action: Action;
}

export type ProjectStatus = 'draft' | 'scheduled' | 'published' | 'active';

export interface RichMenu {
  id: string;
  name: string;
  barText: string;
  isMain: boolean;
  imageData: string | null;
  hotspots: Hotspot[];
  status?: ProjectStatus;
  scheduledAt?: string;
  folderId?: string | null;
  lineRichMenuId?: string;
  lineAliasId?: string;
}

export enum AppStep {
  CONNECT = 'CONNECT',
  DRAFT_LIST = 'DRAFT_LIST',
  UPLOAD = 'UPLOAD',
  EDITOR = 'EDITOR',
  PREVIEW = 'PREVIEW',
  PUBLISH = 'PUBLISH'
}

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  scheduledAt?: string;
  folderId?: string | null;
  menus: RichMenu[];
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
}