/* 咪哆豆多拼豆馆顾客端 */
let currentSeatId = new URLSearchParams(window.location.search).get('seat');
let customerTimer = null;
let selectedCustomerPackage = null;
let selectedCustomerCapacity = 1;
let selectedCustomerSeatIds = [];
let selectedCustomerAccessories = [];
let customerIronFormOpen = false;
let customerExtraFormOpen = false;
let pendingCustomerIronMode = null;

window.addEventListener('DOMContentLoaded', () => {
  if (!currentSeatId || !getManagedSeats().some(s => s.id === currentSeatId)) {
    showError('请通过正确的座位二维码访问本页面');
    return;
  }
  renderCustomerView();
  customerTimer = setInterval(() => {
    const state = getSeatState(currentSeatId);
    if (state.status === 'occupied' || state.status === 'paused') updateLiveTime(state);
    else renderCustomerView();
  }, 1000);
  window.addEventListener('storage', renderCustomerView);
  window.addEventListener('pindou:state-change', renderCustomerView);
});

function showError(message) {
  document.getElementById('customer-content').innerHTML = '<div class="empty-state"><div class="empty-icon">!</div><strong>' + message + '</strong></div>';
}

function renderCustomerView() {
  const state = getSeatState(currentSeatId);
  const container = document.getElementById('customer-content');
  if (state.status === 'free') {
    const seats = getManagedSeats().filter(x => x.id !== currentSeatId && getSeatState(x.id).status === 'free');
    container.innerHTML = '<section class="customer-seat-info"><div class="customer-seat-number">' + currentSeatId + '</div><div class="customer-package" style="color:#4CAF50">空闲座位 · 可选 1-4 人</div><p class="muted">请选择套餐，确认后即可自助开台</p><div class="party-picker customer-party"><span>本次人数</span>' + [1,2,3,4].map(n => '<button class="party-btn ' + (n === selectedCustomerCapacity ? 'selected' : '') + '" onclick="selectCustomerCapacity(' + n + ', this)">' + n + '人</button>').join('') + '</div><div id="customer-second-seat" class="additional-seat-select" style="display:' + (selectedCustomerCapacity > 1 ? '' : 'none') + '"><span>请选择关联的固定座位</span>' + seats.map(x => '<label><input type="checkbox" value="' + x.id + '" onchange="toggleCustomerSeat(\'' + x.id + '\', this)"> ' + x.id + '</label>').join('') + '</div><div class="customer-package-list">' + renderCustomerPackages() + '</div>' + renderCustomerAccessories() + '<p class="muted customer-readonly-note">到店/团购及付款、核销状态由店员登记</p><button class="customer-btn" onclick="customerStartSeat()">确认自助开台</button></section>';
    return;
  }
  if (state.status === 'finished') {
    container.innerHTML = '<section class="customer-seat-info"><div class="customer-seat-number">' + currentSeatId + '</div><div class="customer-package">本单已完成</div><p class="muted">座位已清空，请重新选择套餐开台。</p></section>';
    return;
  }
  const pkg = getPackages().find(p => p.id === state.packageId);
  const remaining = getRemainingMs(state);
  const overtime = isOvertime(state);
  const extraRequest = getExtraRequests()[currentSeatId];
  const statusValue = state.arrivalType === '团购' ? (state.couponStatus || '未核销') : (state.paymentStatus || '未付款');
  const statusClass = statusValue === '已付款' || statusValue === '已核销' ? 'status-green' : 'status-red';
  const ironItems = getSeatIronQueue(currentSeatId);
  const pendingIron = ironItems.filter(item => item.status !== 'done');
  const ironLabel = item => ({ pending:'已提交', confirmed:'已确认', processing:'制作中', done:'已熨好' })[item.status] || '已提交';
  const iron = ironItems.length ? '<div class="customer-iron-list"><div class="customer-iron-heading">熨烫申请 ' + (pendingIron.length ? '· 前面还有 ' + Math.max((getIronQueuePosition(pendingIron[0].id) || 1) - 1, 0) + ' 个' : '') + '</div>' + ironItems.map(item => '<div class="customer-iron-item ' + (item.status === 'done' ? 'done' : '') + '"><span>' + (item.status === 'done' ? '已完成' : '熨烫') + ' ' + ironLabel(item) + (item.status !== 'done' ? ' · 第 ' + getIronQueuePosition(item.id) + ' 位' : '') + '</span><small>' + (item.mode || '普通熨烫') + ' · ' + new Date(item.requestedAt).toLocaleTimeString() + '</small></div>').join('') + '</div>' : '';
  const endLabel = '结束时间：' + formatExpectedEnd(state) + (state.extraMinutes ? '（含加时）' : '');
  const animal = state.partySize > 1 ? (state.orderAnimal || '🐶') + (state.orderAnimal || '🐶') : (state.orderAnimal || '🐶');
  const extraButton = remaining !== Infinity ? '<button class="customer-btn ' + (customerExtraFormOpen ? 'selected' : '') + '" onclick="requestExtra()" ' + (extraRequest ? 'disabled' : '') + '>' + (extraRequest ? '已申请加时' : '申请加时') + '</button>' : '';
  container.innerHTML = '<section class="customer-seat-info customer-seat-card"><div class="customer-card-top"><div class="customer-package">' + (pkg ? pkg.name : '当前套餐') + '</div><span class="customer-status-badge ' + statusClass + '">' + (state.arrivalType || '到店') + ' · ' + statusValue + ' · ¥' + Number(pkg?.price || 0).toFixed(1) + '</span></div><div class="customer-animals">' + animal + '</div><div class="customer-seat-number">' + currentSeatId + '</div><div class="customer-status-text">' + (state.status === 'paused' ? '暂停' : overtime ? '超时' : '占用') + '</div><div class="customer-timer" id="customer-timer-display">' + (remaining === Infinity ? '不限时' : formatTime(remaining)) + '</div><div class="customer-times"><span>开台时间：' + new Date(state.startTime).toLocaleTimeString() + '</span><span>' + endLabel + '</span></div><div class="customer-related">关联座位：' + (state.orderSeatIds || [currentSeatId]).join('+') + '</div>' + (state.status === 'paused' ? '<div class="request-badge">店员已暂停计时</div>' : '') + iron + '<div class="customer-actions">' + extraButton + '<button class="customer-btn secondary" onclick="openIronForm()">申请熨烫</button></div>' + (customerExtraFormOpen ? renderExtraForm() : '') + (customerIronFormOpen ? renderIronForm() : '') + '</section>';
}

function renderCustomerPackages() {
  return getPackages().filter(p => p.capacity === (selectedCustomerCapacity === 1 ? 1 : 2)).map(p => '<button class="customer-package-btn" data-package="' + p.id + '" onclick="selectCustomerPackage(\'' + p.id + '\', this)"><b>' + p.name + '</b><span>¥' + p.price.toFixed(1) + ' · ' + (p.duration ? p.duration + '分钟' : '不限时') + '</span></button>').join('');
}
function renderCustomerAccessories() {
  const items = getAccessories().filter(x => Number(x.stock || 0) > 0);
  if (!items.length) return '';
  return '<div class="customer-accessory-title">可选饰品（结账时一起计算）</div><div class="customer-accessories">' + items.map(x => '<button type="button" class="customer-accessory ' + (selectedCustomerAccessories.includes(x.id) ? 'selected' : '') + '" onclick="toggleCustomerAccessory(\'' + x.id + '\')">' + (x.image ? '<img src="' + x.image + '" alt="">' : '<span class="accessory-placeholder">饰品</span>') + '<b>' + x.name + '</b><small>¥' + Number(x.price).toFixed(2) + ' · 库存' + x.stock + '</small></button>').join('') + '</div>';
}
function renderExtraForm() {
  const rules = getExtraRules().options || [];
  return '<div class="inline-form extra-request-form" id="extra-form"><h3>选择加时规则</h3><p class="muted">请选择加时时长，价格会先展示给你，提交后由店员确认。</p><div class="customer-extra-options">' + rules.map(x => '<button type="button" class="customer-extra-option" onclick="submitExtraRequest(' + Number(x.minutes) + ', ' + Number(x.price) + ')"><b>+' + Number(x.minutes) + '分钟</b><span>¥' + Number(x.price).toFixed(1) + '</span></button>').join('') + '</div></div>';
}
function renderIronForm() {
  const modes = getIronModes();
  return '<div class="inline-form" id="iron-form"><h3>申请熨烫</h3><div class="customer-choice-label">熨烫方式</div><div class="customer-iron-tags">' + modes.map((mode, i) => '<button type="button" class="status-tag ' + (i === 0 ? 'selected' : '') + '" onclick="selectCustomerIronMode(\'' + mode + '\', this)">' + mode + '</button>').join('') + '</div><label class="iron-upload-label">上传拼豆图片（可选）<input id="iron-image" type="file" accept="image/*" capture="environment" onchange="showIronFile(this)"><small id="iron-file-name">点击选择图片，选好后会显示文件名</small></label><button type="button" class="customer-btn" onclick="submitIronRequest()">确认提交熨烫</button></div>';
}
function selectCustomerCapacity(size, button) { selectedCustomerCapacity = size; selectedCustomerPackage = null; selectedCustomerSeatIds = []; document.querySelectorAll('.party-btn').forEach(x => x.classList.remove('selected')); if (button) button.classList.add('selected'); const second = document.getElementById('customer-second-seat'); if (second) second.style.display = size > 1 ? '' : 'none'; const list = document.querySelector('.customer-package-list'); if (list) list.innerHTML = renderCustomerPackages(); }
function toggleCustomerSeat(seatId, checkbox) { if (checkbox.checked) selectedCustomerSeatIds.push(seatId); else selectedCustomerSeatIds = selectedCustomerSeatIds.filter(id => id !== seatId); }
function selectCustomerPackage(id, button) { selectedCustomerPackage = id; document.querySelectorAll('.customer-package-btn').forEach(b => b.classList.remove('selected')); if (button) button.classList.add('selected'); }
function toggleCustomerAccessory(id) { const state = getSeatState(currentSeatId); const selected = new Set(state.status === 'free' ? selectedCustomerAccessories : (state.selectedAccessories || [])); if (selected.has(id)) selected.delete(id); else selected.add(id); if (state.status === 'free') selectedCustomerAccessories = Array.from(selected); else updateSeatState(currentSeatId, { selectedAccessories:Array.from(selected) }); renderCustomerView(); }
function customerStartSeat() { if (!selectedCustomerPackage) return showToast('请先选择套餐'); const state = getSeatState(currentSeatId); if (state.status !== 'free') return renderCustomerView(); if (selectedCustomerCapacity > 1 && selectedCustomerSeatIds.length !== selectedCustomerCapacity - 1) return showToast('请选择 ' + (selectedCustomerCapacity - 1) + ' 个关联座位'); if (selectedCustomerSeatIds.some(id => getSeatState(id).status !== 'free')) return showToast('关联座位刚刚被占用，请重新选择'); const seats = [currentSeatId].concat(selectedCustomerSeatIds); const shared = { status:'occupied', packageId:selectedCustomerPackage, selectedAccessories:selectedCustomerAccessories.slice(), orderId:seats.join('+') + '-order_' + Date.now(), orderAnimal:pickOrderAnimal(), orderColor:pickOrderColor(), orderBorderStyle:pickOrderBorderStyle(), partySize:selectedCustomerCapacity, orderSeatIds:seats, arrivalType:'到店', paymentStatus:'未付款', couponStatus:'未核销', startTime:Date.now(), pauseTime:null, pausedDuration:0, extraMinutes:0, ironDone:false, needIron:false }; seats.forEach(id => updateSeatState(id, { ...shared, seatId:id })); updateTodayStats({ arrivals:1, people:selectedCustomerCapacity, orders:1 }); selectedCustomerPackage = null; selectedCustomerSeatIds = []; selectedCustomerAccessories = []; showToast('已自助开台，请开始创作'); renderCustomerView(); }
function requestExtra() { if (getExtraRequests()[currentSeatId]) return; customerExtraFormOpen = !customerExtraFormOpen; renderCustomerView(); }
function submitExtraRequest(minutes, price) { addExtraRequest(currentSeatId, { minutes, price }); customerExtraFormOpen = false; renderCustomerView(); showToast('已申请加时 ' + minutes + ' 分钟 · ¥' + Number(price).toFixed(1)); }
function openIronForm() { pendingCustomerIronMode = getIronModes()[0] || '普通熨烫'; customerIronFormOpen = true; renderCustomerView(); }
function selectCustomerIronMode(mode, button) { pendingCustomerIronMode = mode; document.querySelectorAll('.customer-iron-tags .status-tag').forEach(x => x.classList.remove('selected')); if (button) button.classList.add('selected'); }
function showIronFile(input) { const label = document.getElementById('iron-file-name'); if (label) label.textContent = input.files && input.files[0] ? '已选择：' + input.files[0].name : '点击选择图片，选好后会显示文件名'; }
function compressImage(file) { return new Promise((resolve, reject) => { if (!file) return resolve(null); const reader = new FileReader(); reader.onerror = reject; reader.onload = () => { const image = new Image(); image.onerror = reject; image.onload = () => { const scale = Math.min(1, 1200 / Math.max(image.width, image.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale)); canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height); resolve(canvas.toDataURL('image/jpeg', 0.72)); }; image.src = reader.result; }; reader.readAsDataURL(file); }); }
async function submitIronRequest() { const input = document.getElementById('iron-image'); const file = input && input.files ? input.files[0] : null; let image = null; try { image = await compressImage(file); } catch (_) { return showToast('图片读取失败，请重新选择'); } const mode = pendingCustomerIronMode || getIronModes()[0] || '普通熨烫'; const request = { mode, image, requestedAt:Date.now() }; const item = addIronQueueRequest(currentSeatId, request); updateSeatState(currentSeatId, { ironRequestedAt:request.requestedAt, ironMode:mode, ironImage:image, ironDone:false, ironStatus:'pending', needIron:true, lastIronRequestId:item.id }); saveIronRequest(currentSeatId, request); updateTodayStats({ needIron:1 }); customerIronFormOpen = false; renderCustomerView(); showToast('熨烫申请已提交'); }
function updateLiveTime(state) { const timer = document.getElementById('customer-timer-display'); if (!timer) return renderCustomerView(); const left = getRemainingMs(state); timer.textContent = left === Infinity ? '不限时' : isOvertime(state) ? '超时 ' + formatTime(-left) : formatTime(left); }
