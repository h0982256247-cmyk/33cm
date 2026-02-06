// Rich Menu 編輯器常數

// 畫布尺寸（LINE Rich Menu 標準尺寸：2500 x 1686 或 2500 x 843）
export const CANVAS_WIDTH = 2500;
export const CANVAS_HEIGHT = 1686;

// 預設熱區尺寸
export const DEFAULT_HOTSPOT_SIZE = {
    width: 400,
    height: 300,
};

// LINE Rich Menu 尺寸選項
export const RICHMENU_SIZES = {
    large: { width: 2500, height: 1686 },
    compact: { width: 2500, height: 843 },
};

// 動作類型
export const ACTION_TYPES = {
    message: "傳送訊息",
    uri: "開啟網址",
    richmenuswitch: "切換選單",
    postback: "Postback",
};
