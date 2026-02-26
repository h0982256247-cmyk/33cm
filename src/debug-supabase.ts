// 診斷 Supabase 配置的腳本
// 在瀏覽器 Console 中執行此檔案的內容來診斷問題

import { supabase } from './lib/supabase';

export async function diagnoseSupabase() {
  console.log('=== Supabase 診斷開始 ===');

  // 1. 檢查環境變數
  console.log('\n1. 環境變數:');
  console.log('  VITE_SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL);
  console.log('  VITE_SUPABASE_ANON_KEY:',
    import.meta.env.VITE_SUPABASE_ANON_KEY ?
    import.meta.env.VITE_SUPABASE_ANON_KEY.substring(0, 20) + '...' :
    'undefined'
  );

  // 2. 檢查 Supabase client
  console.log('\n2. Supabase Client:');
  console.log('  supabase:', supabase);
  // @ts-ignore
  console.log('  supabase.supabaseUrl:', supabase.supabaseUrl);
  // @ts-ignore
  console.log('  supabase.supabaseKey:', supabase.supabaseKey?.substring(0, 20) + '...');

  // 3. 檢查認證狀態
  console.log('\n3. 認證狀態:');
  const { data: { session }, error } = await supabase.auth.getSession();
  console.log('  session:', session);
  console.log('  error:', error);

  // 4. 測試 Edge Function
  console.log('\n4. 測試 Edge Function:');
  try {
    const response = await supabase.functions.invoke('broadcast', {
      body: { flexMessages: [], altText: 'test' }
    });
    console.log('  response:', response);
    console.log('  response.status:', response.status);
    console.log('  response.error:', response.error);
    console.log('  response.data:', response.data);
  } catch (err) {
    console.error('  測試失敗:', err);
  }

  console.log('\n=== 診斷完成 ===');
}

// 自動執行
if (typeof window !== 'undefined') {
  console.log('診斷腳本已載入，請在 Console 中執行: diagnoseSupabase()');
  // @ts-ignore
  window.diagnoseSupabase = diagnoseSupabase;
}
