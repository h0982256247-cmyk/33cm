import { RichMenu, Hotspot } from '@/lib/richmenuTypes';

/**
 * LINE Rich Menu API 的區域 (area) 格式
 */
interface LineRichMenuArea {
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  action: {
    type: string;
    label?: string;
    text?: string;
    uri?: string;
    data?: string;
    richMenuAliasId?: string;
    displayText?: string;
    inputOption?: 'closeRichMenu' | 'openRichMenu' | 'openKeyboard' | 'openVoice';
    fillInText?: string;
  };
}

/**
 * LINE Rich Menu API 的完整格式
 */
interface LineRichMenuPayload {
  size: {
    width: number;
    height: number;
  };
  selected: boolean;
  name: string;
  chatBarText: string;
  areas: LineRichMenuArea[];
}

/**
 * 將編輯器的 Hotspot 轉換為 LINE Rich Menu Area
 */
function convertHotspotToArea(hotspot: Hotspot, allMenus: RichMenu[]): LineRichMenuArea {
  const area: LineRichMenuArea = {
    bounds: {
      x: hotspot.x,
      y: hotspot.y,
      width: hotspot.width,
      height: hotspot.height,
    },
    action: {
      type: hotspot.action.type === 'none' ? 'message' : hotspot.action.type,
    },
  };

  // 根據不同的 action type 設定對應欄位
  switch (hotspot.action.type) {
    case 'message':
      area.action.type = 'message';
      area.action.label = hotspot.action.label || '訊息';
      area.action.text = hotspot.action.data || '預設訊息';
      break;

    case 'uri':
      area.action.type = 'uri';
      area.action.label = hotspot.action.label || '開啟連結';
      area.action.uri = hotspot.action.data || 'https://line.me';
      break;

    case 'switch':
      // 找到目標選單
      const targetMenu = allMenus.find(m => m.id === hotspot.action.data);
      console.log('[Switch Debug]', {
        hotspotActionData: hotspot.action.data,
        targetMenuFound: !!targetMenu,
        targetMenuId: targetMenu?.id,
        targetMenuName: targetMenu?.name,
        generatedAliasId: targetMenu?.id.replace(/-/g, '')
      });
      if (targetMenu) {
        area.action.type = 'richmenuswitch';
        area.action.label = hotspot.action.label || targetMenu.name;
        // LINE Alias ID max 32 chars. Remove hyphens from UUID (36 chars -> 32 chars)
        area.action.richMenuAliasId = targetMenu.id.replace(/-/g, '');
        area.action.data = `switch_to_${targetMenu.id}`;
      } else {
        // 如果找不到目標選單,改為 message
        area.action.type = 'message';
        area.action.label = '錯誤';
        area.action.text = '目標選單不存在';
      }
      break;

    case 'postback':
      area.action.type = 'postback';
      area.action.label = hotspot.action.label || hotspot.action.data || '預填表單';
      area.action.data = `action=${hotspot.action.data}&hotspot=${hotspot.id}`;
      area.action.displayText = hotspot.action.data || '';
      area.action.inputOption = 'openKeyboard';
      area.action.fillInText = hotspot.action.fillInText || '';
      break;

    case 'none':
    default:
      // LINE API 不支援 'none',改用空訊息
      area.action.type = 'message';
      area.action.label = '-';
      area.action.text = ' ';
      break;
  }

  return area;
}

/**
 * 將編輯器的 RichMenu 轉換為 LINE Rich Menu API 格式
 */
export function buildLineRichMenuPayload(
  menu: RichMenu,
  allMenus: RichMenu[]
): LineRichMenuPayload {
  // LINE 官方限制：最多 20 個 areas
  const areas = menu.hotspots.slice(0, 20).map(hotspot => convertHotspotToArea(hotspot, allMenus));

  if (menu.hotspots.length > 20) {
    console.warn(`[Rich Menu] 選單「${menu.name}」的 hotspots 數量超過 20 個，已自動截取前 20 個`);
  }

  return {
    size: {
      width: 2500,  // LINE Rich Menu 標準寬度
      height: 1686, // LINE Rich Menu 標準高度 (比例 3:2)
    },
    selected: menu.isMain, // 主選單預設選中
    name: menu.name,
    chatBarText: menu.barText,
    areas,
  };
}

/**
 * 將 base64 圖片轉換為 Blob
 */
export function base64ToBlob(base64: string): Blob {
  // 移除 data:image/xxx;base64, 前綴
  const base64Data = base64.split(',')[1] || base64;
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: 'image/png' });
}

/**
 * 驗證圖片尺寸是否符合 LINE Rich Menu 規範
 */
export function validateImageSize(width: number, height: number): boolean {
  // LINE Rich Menu 支援的所有標準尺寸（官方文件）
  const validSizes = [
    { width: 2500, height: 1686 }, // 比例 3:2 (大)
    { width: 2500, height: 843 },  // 比例 6:1 (大)
    { width: 1200, height: 810 },  // 比例 3:2 (中)
    { width: 1200, height: 405 },  // 比例 6:1 (中)
    { width: 800, height: 540 },   // 比例 3:2 (小)
    { width: 800, height: 270 },   // 比例 6:1 (小)
  ];

  return validSizes.some(size => size.width === width && size.height === height);
}

/**
 * 驗證圖片檔案大小是否符合 LINE Rich Menu 規範 (最大 1MB)
 */
export function validateImageFileSize(base64: string): boolean {
  // 移除 data URL 前綴 (例如 "data:image/png;base64,")
  const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;

  // Base64 解碼後的實際檔案大小計算
  // 每 4 個 base64 字元代表 3 個 bytes
  const sizeInBytes = (base64Data.length * 3) / 4;

  // 減去 padding 字元（'='）的影響
  const paddingCount = (base64Data.match(/=/g) || []).length;
  const actualSize = sizeInBytes - paddingCount;

  return actualSize <= 1024 * 1024; // 1MB
}

/**
 * 驗證 Rich Menu hotspots 數量
 */
export function validateHotspotCount(menu: RichMenu): { valid: boolean; message?: string } {
  if (menu.hotspots.length === 0) {
    return { valid: false, message: '選單至少需要 1 個 hotspot' };
  }
  if (menu.hotspots.length > 20) {
    return { valid: false, message: `選單「${menu.name}」的 hotspots 數量超過 LINE 官方限制（最多 20 個），目前有 ${menu.hotspots.length} 個` };
  }
  return { valid: true };
}

/**
 * 驗證 Alias ID 格式
 */
export function validateAliasId(aliasId: string): { valid: boolean; message?: string } {
  // LINE 規定：只能包含英數字、底線(_)、連字符(-)，長度 1-100 字元
  const aliasIdRegex = /^[a-zA-Z0-9_-]{1,100}$/;

  if (!aliasIdRegex.test(aliasId)) {
    return {
      valid: false,
      message: `Alias ID「${aliasId}」格式不符合 LINE 規定（只能包含英數字、底線、連字符，長度 1-100 字元）`
    };
  }
  return { valid: true };
}

/**
 * 建立發布請求的完整資料
 */
export interface PublishRequest {
  menus: Array<{
    menuData: LineRichMenuPayload;
    imageBase64: string | null;
    aliasId: string;
    isMain: boolean;
  }>;
  cleanOldMenus?: boolean;
}

export function buildPublishRequest(menus: RichMenu[], cleanOldMenus = true): PublishRequest {
  return {
    menus: menus.map(menu => ({
      menuData: buildLineRichMenuPayload(menu, menus),
      imageBase64: menu.imageData,
      // LINE Alias ID max 32 chars. Remove hyphens from UUID.
      aliasId: menu.id.replace(/-/g, ''),
      isMain: menu.isMain,
    })),
    cleanOldMenus,
  };
}
