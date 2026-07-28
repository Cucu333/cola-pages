/* ========================================
   共享模块 - 数据模型、存储、套餐、座位配置
   ======================================== */

// ===== localStorage key 前缀 =====
const STORAGE_PREFIX = 'pindou_';

// ===== 套餐定义 =====
const PACKAGES = [
  { id: 'single_1h',    name: '单人畅玩 1h',   duration: 60,   price: 9.9,  capacity: 1 },
  { id: 'single_3h',    name: '单人畅玩 3h',   duration: 180,  price: 19.9, capacity: 1 },
  { id: 'single_5h',    name: '单人畅玩 5h',   duration: 300,  price: 29.9, capacity: 1 },
  { id: 'single_unlimited', name: '单人不限时', duration: 0,    price: 35.0, capacity: 1 },
  { id: 'double_3h',    name: '双人成行 3h',   duration: 180,  price: 35.0, capacity: 2 },
  { id: 'double_5h',    name: '双人成行 5h',   duration: 300,  price: 52.0, capacity: 2 },
  { id: 'double_unlimited', name: '双人不限时', duration: 0,    price: 59.9, capacity: 2 },
];

const RECEIPT_FONT_PRESETS = { round:'软糖圆体', hand:'手写甜甜体', mono:'手帐票据体' };
function getReceiptFont() { return storageGet('receipt_font') || 'round'; }
function saveReceiptFont(font) { storageSet('receipt_font', RECEIPT_FONT_PRESETS[font] ? font : 'round'); }
function getCustomPackages() { return storageGet('custom_packages') || []; }
function getDeletedPackages() { return storageGet('deleted_packages') || []; }
function saveDeletedPackages(ids) { storageSet('deleted_packages', Array.from(new Set(ids))); }
function saveCustomPackages(items) { storageSet('custom_packages', items.filter(x => x && x.name && Number(x.price) >= 0 && Number(x.duration) >= 0).map(x => ({ id:x.id || `custom_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, name:String(x.name), duration:Number(x.duration), price:Number(x.price), capacity:Number(x.capacity) === 1 ? 1 : 2 }))); }
function getPackageOverrides() { return storageGet('package_overrides') || {}; }
function savePackageOverrides(items) { const overrides = {}; items.filter(x => x && x.id && x.name && Number(x.price) >= 0 && Number(x.duration) >= 0).forEach(x => { overrides[x.id] = { name:String(x.name), duration:Number(x.duration), price:Number(x.price), capacity:Number(x.capacity) === 1 ? 1 : 2 }; }); storageSet('package_overrides', overrides); }
function getPackages() { const overrides = getPackageOverrides(); const deleted = getDeletedPackages(); return PACKAGES.concat(getCustomPackages()).filter(item => !deleted.includes(item.id)).map(item => overrides[item.id] ? { ...item, ...overrides[item.id] } : item); }

// 加时规则可在设置中调整，旧数据仍兼容默认规则。
const DEFAULT_EXTRA_RULES = { options: [{ minutes: 15, price: 3 }, { minutes: 30, price: 6 }, { minutes: 60, price: 12 }], rate: 0.2 };
function getExtraRules() { return storageGet('extra_rules') || { ...DEFAULT_EXTRA_RULES, options: DEFAULT_EXTRA_RULES.options.map(x => ({ ...x })) }; }
function saveExtraRules(rules) { storageSet('extra_rules', { ...DEFAULT_EXTRA_RULES, ...rules, options: (rules.options || []).filter(x => Number(x.minutes) > 0).map(x => ({ minutes:Number(x.minutes), price:Number(x.price) })) }); }
const EXTRA_RATE = getExtraRules().rate;

const DEFAULT_ACCESSORIES = [
  { id: 'beads', category:'材料包', name: '拼豆材料包', price: 5, stock: 100, image: '' },
  { id: 'board', category:'拼豆工具', name: '拼豆底板', price: 3, stock: 50, image: '' },
  { id: 'clip', category:'拼豆工具', name: '豆夹', price: 2, stock: 80, image: '' },
  { id: 'bead-red', category:'拼豆颜色', name: '豆 · 红色', price: 1, stock: 100, image: '' },
  { id: 'bead-blue', category:'拼豆颜色', name: '豆 · 蓝色', price: 1, stock: 100, image: '' },
  { id: 'bead-yellow', category:'拼豆颜色', name: '豆 · 黄色', price: 1, stock: 100, image: '' },
  { id: 'keychain', category:'饰品', name: '钥匙扣配件', price: 2, stock: 80, image: '' },
  { id: 'magnet', category:'饰品', name: '冰箱贴配件', price: 2, stock: 80, image: '' }
];
const DEFAULT_IRON_MODES = ['普通熨烫', '快速熨烫', '分色熨烫'];
const ORDER_ANIMALS = ['🐶', '🦮', '🐕', '🐩', '🐕‍🦺', '🦴'];
const ORDER_COLORS = ['#ff8fba', '#8db8ff', '#a9d99a', '#c3a6ef', '#ffbd75', '#75cfd0'];
const ORDER_BORDER_STYLES = ['solid', 'dashed', 'double'];
function pickOrderColor() { return ORDER_COLORS[Math.floor(Math.random() * ORDER_COLORS.length)]; }
function pickOrderBorderStyle() { return ORDER_BORDER_STYLES[Math.floor(Math.random() * ORDER_BORDER_STYLES.length)]; }
const DEFAULT_INVENTORY_TAGS = ['饰品', '工具', '豆子'];
function getInventoryTags() { return storageGet('inventory_tags') || [...DEFAULT_INVENTORY_TAGS]; }
function saveInventoryTags(tags) { storageSet('inventory_tags', Array.from(new Set(tags.map(x => String(x).trim()).filter(Boolean)))); }

function getAccessories() {
  const stored = storageGet('accessories');
  if (!stored) return DEFAULT_ACCESSORIES.map(x => ({ ...x }));
  const legacyCategory = { beads:'饰品', board:'工具', clip:'工具', 'bead-red':'豆子', 'bead-blue':'豆子', 'bead-yellow':'豆子', keychain:'饰品', magnet:'饰品' };
  const legacyNameCategory = { '拼豆材料包':'饰品', '拼豆底板':'工具', '豆夹':'工具', '豆 · 红色':'豆子', '豆 · 蓝色':'豆子', '豆 · 黄色':'豆子', '钥匙扣配件':'饰品', '冰箱贴配件':'饰品' };
  const normalized = stored.map(x => ({ ...x, category:legacyNameCategory[x.name] || (getInventoryTags().includes(x.category) ? x.category : (legacyCategory[x.id] || '饰品')) }));
  const missing = DEFAULT_ACCESSORIES.filter(seed => !normalized.some(x => x.id === seed.id || x.name === seed.name));
  return normalized.concat(missing.map(x => ({ ...x })));
}
function saveAccessories(items) { storageSet('accessories', items.map(x => ({ category:'饰品', ...x }))); }
function getIronModes() { return storageGet('iron_modes') || [...DEFAULT_IRON_MODES]; }
function pickOrderAnimal() { return ORDER_ANIMALS[Math.floor(Math.random() * ORDER_ANIMALS.length)]; }
function saveIronModes(items) { storageSet('iron_modes', items.filter(Boolean)); }

// ===== 座位配置 =====
function generateSeats() {
  const seats = [];
  // A区 25座
  for (let i = 1; i <= 25; i++) {
    const isBig = (i % 5 === 0); // A5/A10/A15/A20/A25 是大桌
    seats.push({
      id: `A${i}`,
      zone: 'A',
      number: i,
      capacity: isBig ? 2 : 1,
    });
  }
  // B区 28座
  for (let i = 1; i <= 28; i++) {
    const isBig = (i % 5 === 0); // B5/B10/B15/B20/B25 是大桌
    seats.push({
      id: `B${i}`,
      zone: 'B',
      number: i,
      capacity: isBig ? 2 : 1,
    });
  }
  return seats;
}

const ALL_SEATS = generateSeats();
function getManagedSeats() { return storageGet('seat_config') || ALL_SEATS; }
function saveManagedSeats(seats) { storageSet('seat_config', seats); }

// ===== 座位状态模型 =====
// status: 'free' | 'occupied' | 'paused' | 'finished'
function createSeatState(seatId) {
  return {
    seatId: seatId,
    status: 'free',
    packageId: null,       // 当前套餐ID
    orderId: null,         // 同一订单的座位共享此编号
    orderAnimal: null,     // 同一订单共享的动物标识
    orderColor: null,
    orderBorderStyle: null,
    partySize: 1,          // 本订单人数，可按座位选择1人或2人
    orderSeatIds: [seatId],
    arrivalType: '到店',   // 到店 / 团购
    paymentStatus: '未付款',
    couponStatus: '未核销',
    extraRequested: false,
    startTime: null,       // 开始时间戳(ms)
    pauseTime: null,       // 暂停时间戳(ms)
    pausedDuration: 0,     // 累计暂停时长(ms)
    extraMinutes: 0,       // 加时分钟数
    isCoupon: false,       // 是否团购到店
    needIron: false,       // 是否需要熨烫
    ironDone: false,       // 是否已熨烫
    ironMode: null,        // 熨烫方式
    ironImage: null,       // 压缩后的熨烫图片（仅在订单进行中保存）
    ironRequestedAt: null,
    finishTime: null,
    selectedAccessories: [],      // 结账时间戳
    workStatus: null,              // unfinished / completed
    workImage: null,               // 未完成作品照片
    workSavedAt: null,
  };
}

// ===== 本地存储操作 =====
function storageGet(key) {
  try {
    const val = localStorage.getItem(STORAGE_PREFIX + key);
    if (!val || val === 'undefined' || val === 'null') return null;
    return JSON.parse(val);
  } catch (e) {
    console.error('存储读取错误:', e);
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
    if (typeof persistRemoteState === 'function') persistRemoteState(key);
  } catch (e) {
    console.error('存储写入错误:', e);
  }
}

// ===== 座位状态管理 =====
function getAllSeatStates() {
  let states = storageGet('seat_states');
  if (!states) {
    // 初始化所有座位状态
    states = {};
    ALL_SEATS.forEach(seat => {
      states[seat.id] = createSeatState(seat.id);
    });
    storageSet('seat_states', states);
  }
  return states;
}

function getSeatState(seatId) {
  const states = getAllSeatStates();
  if (!states[seatId]) {
    states[seatId] = createSeatState(seatId);
    storageSet('seat_states', states);
  }
  return states[seatId];
}

function updateSeatState(seatId, updates) {
  const states = getAllSeatStates();
  states[seatId] = { ...states[seatId], ...updates };
  storageSet('seat_states', states);
  // 同一浏览器内的管理端/顾客端页面通过 storage 事件即时刷新。
  window.dispatchEvent(new CustomEvent('pindou:state-change', { detail: { seatId } }));
  return states[seatId];
}

// ===== 今日统计 =====
function getTodayStats() {
  const today = new Date().toDateString();
  let stats = storageGet('today_stats');
  if (!stats || stats.date !== today) {
    stats = {
      date: today,
      arrivals: 0,       // 今日到店兼容字段
      people: 0,         // 今日总人数
      orders: 0,         // 今日总订单
      revenue: 0,        // 今日营收
      couponUsed: 0,     // 团购核销
      overtime: 0,       // 超时数
      extraCount: 0,     // 加时数
      extraAmount: 0,    // 加时金额
      needIron: 0,       // 待熨
      ironDone: 0,       // 已熨
    };
    storageSet('today_stats', stats);
  }
  return stats;
}

function updateTodayStats(updates) {
  const stats = getTodayStats();
  Object.keys(updates).forEach(key => {
    if (typeof updates[key] === 'number') {
      stats[key] = (stats[key] || 0) + updates[key];
    } else {
      stats[key] = updates[key];
    }
  });
  storageSet('today_stats', stats);
  return stats;
}

// ===== 顾客加时请求 =====
function getExtraRequests() {
  return storageGet('extra_requests') || {};
}

function addExtraRequest(seatId, details = {}) {
  const requests = getExtraRequests();
  requests[seatId] = { time: Date.now(), seatId, minutes:Number(details.minutes || 0), price:Number(details.price || 0) };
  storageSet('extra_requests', requests);
}

function clearExtraRequest(seatId) {
  const requests = getExtraRequests();
  delete requests[seatId];
  storageSet('extra_requests', requests);
}

function clearSeatOrder(seatId) {
  const states = getAllSeatStates();
  states[seatId] = createSeatState(seatId);
  storageSet('seat_states', states);
  clearExtraRequest(seatId);
  window.dispatchEvent(new CustomEvent('pindou:state-change', { detail: { seatId } }));
}

// ===== 计时工具函数 =====
// 计算座位已用时间（毫秒，扣除暂停）
function getElapsedMs(state) {
  if (!state.startTime) return 0;
  const pauseAt = state.status === 'paused' && state.pauseTime ? state.pauseTime : Date.now();
  const paused = Number(state.pausedDuration || 0);
  return Math.max(0, pauseAt - state.startTime - paused);
}

// 格式化时间为 HH:MM:SS
function formatTime(ms) {
  if (ms <= 0) return '--:--';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// 计算座位金额
function calculateAmount(state) {
  const pkg = getPackages().find(p => p.id === state.packageId);
  if (!pkg) return 0;
  let amount = pkg.price;
  // 加时费用
  if (state.extraMinutes > 0) {
    amount += state.extraMinutes * EXTRA_RATE;
  }
  return amount;
}

// 计算剩余时间(ms)，不限时返回 Infinity
function getExpectedEndTime(state) {
  const pkg = getPackages().find(p => p.id === state.packageId);
  if (!state.startTime || !pkg || pkg.duration === 0) return null;
  return state.startTime + (pkg.duration + (state.extraMinutes || 0)) * 60 * 1000 + (state.pausedDuration || 0);
}

function formatExpectedEnd(state) { const end = getExpectedEndTime(state); return end ? new Date(end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '不限时'; }

function getRemainingMs(state) {
  const pkg = getPackages().find(p => p.id === state.packageId);
  if (!pkg || pkg.duration === 0) return Infinity;
  const totalMs = (pkg.duration + state.extraMinutes) * 60 * 1000;
  const elapsed = getElapsedMs(state);
  return totalMs - elapsed;
}

// 是否超时
function isOvertime(state) {
  // 暂停时冻结在暂停瞬间，暂停本身不显示超时；恢复或加时后重新计算。
  if (!state || state.status !== 'occupied') return false;
  const remaining = getRemainingMs(state);
  return remaining !== Infinity && remaining <= 0;
}

// ===== Toast 提示 =====
function getIronRequests() { return storageGet('iron_requests') || {}; }
function isToday(timestamp) { return timestamp && new Date(timestamp).toLocaleDateString() === new Date().toLocaleDateString(); }
function getIronQueue() { const items = storageGet('iron_queue') || []; const fresh = items.filter(item => isToday(item.requestedAt)); if (fresh.length !== items.length) storageSet('iron_queue', fresh); return fresh; }
function saveIronQueue(items) { storageSet('iron_queue', items.filter(item => isToday(item.requestedAt))); }
function addIronQueueRequest(seatId, request) { const items = getIronQueue(); const item = { id:`iron_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, seatId, mode:request.mode, image:request.image || null, accessories:request.accessories || [], requestedAt:request.requestedAt || Date.now(), status:'pending', completedAt:null, confirmedAt:null, processingAt:null }; items.push(item); saveIronQueue(items); return item; }
function updateIronQueueRequest(id, updates) { const items = getIronQueue().map(item => item.id === id ? { ...item, ...updates } : item); saveIronQueue(items); return items.find(item => item.id === id); }
function getSeatIronQueue(seatId) { return getIronQueue().filter(item => item.seatId === seatId).sort((a,b) => a.requestedAt - b.requestedAt); }
function getIronQueuePosition(id) { const pending = getIronQueue().filter(item => item.status !== 'done').sort((a,b) => a.requestedAt - b.requestedAt); const index = pending.findIndex(item => item.id === id); return index < 0 ? null : index + 1; }
function saveIronRequest(seatId, request) { const requests = getIronRequests(); requests[seatId] = request; storageSet('iron_requests', requests); }
function clearIronRequest(seatId) { const requests = getIronRequests(); delete requests[seatId]; storageSet('iron_requests', requests); }
function getUnfinishedWorks() { const raw = storageGet('unfinished_works') || []; if (Array.isArray(raw)) return raw; return Object.values(raw); }
function saveUnfinishedWork(id, work) { const works = getUnfinishedWorks().filter(x => x.id !== id); works.push({ id, image:work.image || null, phoneTail:work.phoneTail || '', savedAt:work.savedAt || Date.now(), packageName:work.packageName || '', status:work.status || 'pending' }); storageSet('unfinished_works', works); }
function clearUnfinishedWork(id) { storageSet('unfinished_works', getUnfinishedWorks().filter(x => x.id !== id)); }

function getLedger() { return storageGet('ledger') || []; }
function getTodayLedger() { const today = new Date().toLocaleDateString(); return getLedger().filter(entry => new Date(entry.createdAt).toLocaleDateString() === today); }
function addLedgerEntry(entry) { const ledger = getLedger(); ledger.unshift({ id: Date.now(), createdAt: new Date().toISOString(), ...entry }); storageSet('ledger', ledger); return ledger[0]; }
function clearLedger() { storageSet('ledger', []); }
function getLastReceipt() { return storageGet('last_receipt'); }
function saveReceipt(receipt) { storageSet('last_receipt', receipt); }

function showToast(message, duration = 2000) {
  // 移除已有的 toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, duration);
}
