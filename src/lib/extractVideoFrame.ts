/**
 * 從影片 URL 擷取第一幀畫面
 * @param videoUrl 影片的 URL（必須是同源或支援 CORS）
 * @param seekTime 擷取的時間點（秒），預設 0.1 秒避免純黑畫面
 * @returns Promise<Blob> JPEG 格式的圖片 Blob
 */
export async function extractVideoFrame(videoUrl: string, seekTime = 0.1): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const video = document.createElement("video");
        video.crossOrigin = "anonymous"; // 支援 CORS
        video.muted = true;
        video.preload = "metadata";

        const cleanup = () => {
            video.removeEventListener("error", onError);
            video.removeEventListener("seeked", onSeeked);
            video.removeEventListener("loadedmetadata", onLoadedMetadata);
            video.src = "";
            video.remove();
        };

        const onError = () => {
            cleanup();
            reject(new Error("影片載入失敗，無法擷取預覽圖"));
        };

        const onSeeked = () => {
            try {
                // 建立 canvas 並繪製影片當前幀
                const canvas = document.createElement("canvas");
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    cleanup();
                    reject(new Error("無法建立 Canvas"));
                    return;
                }

                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                // 轉換為 JPEG Blob
                canvas.toBlob(
                    (blob) => {
                        cleanup();
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error("無法轉換為圖片"));
                        }
                    },
                    "image/jpeg",
                    0.85 // JPEG 品質 85%
                );
            } catch (err) {
                cleanup();
                reject(err);
            }
        };

        const onLoadedMetadata = () => {
            // 確保 seekTime 不超過影片長度
            const targetTime = Math.min(seekTime, video.duration - 0.01);
            video.currentTime = Math.max(0, targetTime);
        };

        video.addEventListener("error", onError);
        video.addEventListener("seeked", onSeeked);
        video.addEventListener("loadedmetadata", onLoadedMetadata);

        // 開始載入影片
        video.src = videoUrl;
        video.load();
    });
}
