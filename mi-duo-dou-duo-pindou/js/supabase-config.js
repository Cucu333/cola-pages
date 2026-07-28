/* Supabase remote state bridge. Never put a service_role key in this file. */
const SUPABASE_URL = 'https://ghosycdobzjzxalootpl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdob3N5Y2RvYnpqenhhbG9vdHBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MDM3OTgsImV4cCI6MjEwMDM3OTc5OH0.amvBriyTufW9-AZtnXgMf4PSRk9dU-0KP1xFU4LtLcs';
const SHOP_ID = '11111111-1111-1111-1111-111111111111';
const REMOTE_KEYS = ['seat_states','seat_config','accessories','iron_modes','iron_queue','iron_requests','extra_requests','extra_rules','today_stats','ledger','last_receipt','unfinished_works'];
let supabaseClient = null;
let remoteHydrating = false;
let remoteReady = false;
const remoteTimers = new Map();
function setSyncStatus(text, className = 'sync-checking') { const el = document.getElementById('sync-status'); if (!el) return; el.textContent = text; el.className = `sync-status ${className}`; }
function retrySupabaseSync() { setSyncStatus('重新连接中', 'sync-checking'); if (supabaseClient) hydrateRemoteState(); else initSupabaseSync(); }

function isSupabaseConfigured() {
  return SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('replace') && typeof window.supabase !== 'undefined';
}
const STORAGE_MODE = isSupabaseConfigured() ? 'supabase' : 'local';
console.log(`[拼豆馆] 存储模式: ${STORAGE_MODE === 'local' ? 'localStorage（本地）' : 'Supabase Realtime（远程）'}`);

function initSupabaseSync() {
  if (!isSupabaseConfigured()) { setSyncStatus('仅本地缓存', 'sync-local'); return; }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  supabaseClient.channel(`pindou-state-${SHOP_ID}`)
    .on('postgres_changes', { event:'*', schema:'public', table:'app_state', filter:`shop_id=eq.${SHOP_ID}` }, payload => {
      const row = payload.new;
      if (!row || !REMOTE_KEYS.includes(row.state_key)) return;
      remoteHydrating = true;
      try { localStorage.setItem('pindou_' + row.state_key, JSON.stringify(row.state_data)); } finally { remoteHydrating = false; }
      window.dispatchEvent(new CustomEvent('pindou:state-change', { detail:{ remote:true, key:row.state_key } }));
    })
    .subscribe();
  setSyncStatus('Realtime 已连接', 'sync-ready');
  hydrateRemoteState();
}

async function hydrateRemoteState() {
  if (!supabaseClient) return;
  remoteHydrating = true;
  const { data, error } = await supabaseClient.from('app_state').select('state_key,state_data').eq('shop_id', SHOP_ID);
  if (!error && data?.length) {
    data.forEach(row => localStorage.setItem('pindou_' + row.state_key, JSON.stringify(row.state_data)));
  }
  remoteHydrating = false;
  remoteReady = !error;
  if (!error) {
    setSyncStatus('已同步', 'sync-ready');
    window.dispatchEvent(new CustomEvent('pindou:state-change', { detail:{ remote:true, hydrated:true } }));
    if (!data?.length) REMOTE_KEYS.forEach(key => persistRemoteState(key));
  } else {
    const missingTable = /app_state|relation|schema cache/i.test(error.message || '');
    setSyncStatus(missingTable ? '需初始化远程表' : '远程连接失败', 'sync-error');
    console.warn('[拼豆馆] Supabase 读取失败，继续使用本地缓存:', error.message);
  }
}

function persistRemoteState(key) {
  if (!supabaseClient || remoteHydrating || !REMOTE_KEYS.includes(key)) return;
  clearTimeout(remoteTimers.get(key));
  remoteTimers.set(key, setTimeout(async () => {
    const raw = localStorage.getItem('pindou_' + key);
    if (raw === null) return;
    let stateData;
    try { stateData = JSON.parse(raw); } catch (_) { return; }
    const { error } = await supabaseClient.from('app_state').upsert({ shop_id:SHOP_ID, state_key:key, state_data:stateData, updated_at:new Date().toISOString() }, { onConflict:'shop_id,state_key' });
    if (error) { setSyncStatus(/app_state|relation|schema cache/i.test(error.message || '') ? '需初始化远程表' : '同步失败', 'sync-error'); console.warn(`[拼豆馆] ${key} 同步失败:`, error.message); }
    else setSyncStatus('已同步', 'sync-ready');
  }, 120));
}

setTimeout(initSupabaseSync, 0);
