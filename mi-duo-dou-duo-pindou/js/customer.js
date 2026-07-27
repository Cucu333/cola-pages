/* 顾客端：扫码自助开台、计时、加时申请和熨烫申请。 */
let currentSeatId = null;
let customerTimer = null;
let selectedCustomerPackage = null;
let selectedCustomerCapacity = 1;
let selectedCustomerSecondSeat = null;
let selectedCustomerSeatIds = [];
let selectedCustomerAccessories = [];
let customerIronFormOpen = false;

const params = new URLSearchParams(window.location.search);
currentSeatId = params.get('seat');

document.addEventListener('DOMContentLoaded', () => {
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
  document.getElementById('customer-content').innerHTML = `<div class="empty-state"><div class="empty-icon">😿</div><strong>${message}</strong></div>`;
}

function renderCustomerView() {
  const state = getSeatState(currentSeatId);
  const container = document.getElementById('customer-content');
  const seat = getManagedSeats().find(s => s.id === currentSeatId);
  if (state.status === 'free') {
    selectedCustomerCapacity = selectedCustomerCapacity || 1;
    container.innerHTML = `
      <section class="customer-seat-info">
        <div class="customer-seat-number">${currentSeatId}</div>
        <div class="customer-package" style="color:#4CAF50">空闲座位 · 可选 1-4 人</div>
        <p class="muted">请选择套餐，确认后即可自助开台</p>
        <div class="party-picker customer-party"><span>本次人数</span>${[1,2,3,4].map(n => `<button class="party-btn ${n === 1 ? 'selected' : ''}" onclick="selectCustomerCapacity(${n}, this)">${n}人</button>`).join('')}</div><div id="customer-second-seat" class="additional-seat-select" style="display:none"><span>请选择关联的固定座位</span>${getManagedSeats().filter(x => x.id !== currentSeatId && getSeatState(x.id).status === 'free').map(x => `<label><input type="checkbox" value="${x.id}" onchange="toggleCustomerSeat('${x.id}', this)"> ${x.id}</label>`).join('')}</div><div class="customer-package-list">${renderCustomerPackages()}</div>${renderCustomerAccessories()}
        <p class="muted customer-readonly-note">到店/团购及付款、核销状态由店员登记</p>
        <button class="customer-btn" onclick="customerStartSeat()">确认自助开台</button>
      </section>`;
    return;
  }
  if (state.status === 'finished') {
    container.innerHTML = `<section class="customer-seat-info"><div class="customer-seat-number">${currentSeatId}</div><div class="customer-package">本单已完成</div><p class="muted">座位已清空，请重新选择套餐开台。</p></section>`;
    return;
  }
  const pkg = getPackages().find(p => p.id === state.packageId);
  const remaining = getRemainingMs(state);
  const overtime = isOvertime(state);
  const request = getExtraRequests()[currentSeatId];
  const statusValue = state.arrivalType === '团购' ? (state.couponStatus || '未核销') : (state.paymentStatus || '未付款');
  const statusClass = statusValue === '已付款' || statusValue === '已核销' ? 'status-green' : 'status-red';
  const ironItems = getSeatIronQueue(currentSeatId);
  const pendingIron = ironItems.filter(item => item.status !== 'done');
  const ironLabel = item => ({ pending:'已提交', confirmed:'已确认', processing:'制作中', done:'已熨好' })[item.status] || '已提交';
  const iron = ironItems.length ? `<div class="customer-iron-list"><div class="customer-iron-heading">熨烫申请 ${pendingIron.length ? `· 前面还有 ${Math.max((getIronQueuePosition(pendingIron[0].id) || 1) - 1, 0)} 个` : ''}</div>${ironItems.map(item => `<div class="customer-iron-item ${item.status === 'done' ? 'done' : ''}"><span>${item.status === 'done' ? '✅' : '🔥'} ${ironLabel(item)}${item.status !== 'done' ? ` · 第 ${getIronQueuePosition(item.id)} 位` : ''}</span><small>${item.mode || '普通熨烫'} · ${new Date(item.requestedAt).toLocaleTimeString()}</small></div>`).join('')}</div>` : '';
  const endLabel = `结束时间：${formatExpectedEnd(state)}${state.extraMinutes ? '（含加时）' : ''}`;
  const animal = state.partySize > 1 ? `${state.orderAnimal || '🐰'}${state.orderAnimal || '🐰'}` : (state.orderAnimal || '🐰');
  container.innerHTML = `<section class="customer-seat-info customer-seat-card">
      <div class="customer-card-top"><div class="customer-package">${pkg ? pkg.name : '当前套餐'}</div><span class="customer-status-badge ${statusClass}">${state.arrivalType || '到店'} · ${statusValue} · ¥${Number(pkg?.price || 0).toFixed(1)}</span></div>
      <div class="customer-animals">${animal}</div><div class="customer-seat-number">${currentSeatId}</div><div class="customer-status-text">${state.status === 'paused' ? '暂停' : overtime ? '超时' : '占用'}</div>
      <div class="customer-timer" id="customer-timer-display">${remaining === Infinity ? '不限时' : formatTime(remaining)}</div><div class="customer-times"><span>开台时间：${new Date(state.startTime).toLocaleTimeString()}</span><span>${endLabel}</span></div>
      <div class="customer-related">关联座位：${(state.orderSeatIds || [currentSeatId]).join('+')}</div>
      ${state.status === 'paused' ? '<div class="request-badge">⏸ 店员已暂停计时</div>' : ''}${iron}${customerIronFormOpen ? renderIronForm() : ''}
      <div class="customer-actions">${remaining !== Infinity ? `<button class="customer-btn" onclick="requestExtra()" ${request ? 'disabled' : ''}>${request ? '✓ 已申请加时' : '申请加时'}</button>` : ''}<button class="customer-btn secondary" onclick="openIronForm()">申请熨烫</button></div>
    </section>`;
}

function renderCustomerPackages() {
  return getPackages().filter(p => p.capacity === (selectedCustomerCapacity === 1 ? 1 : 2)).map(p => `<button class="customer-package-btn" data-package="${p.id}" onclick="selectCustomerPackage('${p.id}', this)"><b>${p.name}</b><span>¥${p.price.toFixed(1)} · ${p.duration ? p.duration + '分钟' : '不限时'}</span></button>`).join('');
}
function renderCustomerAccessories() { const items = getAccessories().filter(x => Number(x.stock || 0) > 0); if (!items.length) return ''; return `<div class="customer-accessory-title">可选饰品（结账时一起计算）</div><div class="customer-accessories">${items.map(x => `<button type="button" class="customer-accessory ${selectedCustomerAccessories.includes(x.id) ? 'selected' : ''}" onclick="toggleCustomerAccessory('${x.id}')">${x.image ? `<img src="${x.image}" alt="">` : '<span class="accessory-placeholder">饰品</span>'}<b>${x.name}</b><small>¥${Number(x.price).toFixed(2)} · 库存${x.stock}</small></button>`).join('')}</div>`;
}
function renderIronForm() { const modes = getIronModes(); return `<div class="inline-form" id="iron-form"><h3>提交熨烫</h3><div class="customer-choice-label">熨烫方式</div><div class="customer-iron-tags">${modes.map((mode, i) => `<button type="button" class="status-tag ${i === 0 ? 'selected' : ''}" onclick="selectCustomerIronMode('${mode}', this)">${mode}</button>`).join('')}</div><label>上传拼豆图片（可选）<input id="iron-image" type="file" accept="image/*"></label><button type="button" class="customer-btn" onclick="submitIronRequest()">提交申请</button></div>`; }
function selectCustomerCapacity(size, button) { selectedCustomerCapacity = size; selectedCustomerPackage = null; selectedCustomerSecondSeat = null; selectedCustomerSeatIds = []; document.querySelectorAll('.party-btn').forEach(x => x.classList.remove('selected')); if (button) button.classList.add('selected'); const second = document.getElementById('customer-second-seat'); if (second) second.style.display = size > 1 ? '' : 'none'; const list = document.querySelector('.customer-package-list'); if (list) list.innerHTML = renderCustomerPackages(); }
function toggleCustomerSeat(seatId, checkbox) { if (checkbox.checked) selectedCustomerSeatIds.push(seatId); else selectedCustomerSeatIds = selectedCustomerSeatIds.filter(id => id !== seatId); selectedCustomerSecondSeat = selectedCustomerSeatIds[0] || null; }

function selectCustomerPackage(id, button) {
  selectedCustomerPackage = id;
  document.querySelectorAll('.customer-package-btn').forEach(b => b.classList.remove('selected'));
  button.classList.add('selected');
}

function customerStartSeat() {
  if (!selectedCustomerPackage) return showToast('请先选择套餐');
  const state = getSeatState(currentSeatId);
  if (state.status !== 'free') return renderCustomerView();
  if (selectedCustomerCapacity > 1 && selectedCustomerSeatIds.length !== selectedCustomerCapacity - 1) return showToast(`请选择 ${selectedCustomerCapacity - 1} 个关联座位`);
  if (selectedCustomerSeatIds.some(seatId => getSeatState(seatId).status !== 'free')) return showToast('关联座位刚刚被占用，请重新选择');
  const isCoupon = document.getElementById('customer-coupon')?.checked || false;
  const customerOrderSeats = [currentSeatId, ...selectedCustomerSeatIds];
  const customerOrder = { status: 'occupied', packageId: selectedCustomerPackage, selectedAccessories: [...selectedCustomerAccessories], orderId: `${customerOrderSeats.join('+')}-order_${Date.now()}`, orderAnimal: pickOrderAnimal(), orderColor: pickOrderColor(), orderBorderStyle: pickOrderBorderStyle(), partySize: selectedCustomerCapacity, orderSeatIds: customerOrderSeats, arrivalType: '到店', paymentStatus: '未付款', couponStatus: '未核销', startTime: Date.now(), pauseTime: null, pausedDuration: 0, extraMinutes: 0, isCoupon, ironRequestedAt: null, ironImage: null, ironMode: null, ironDone: false, finishTime: null };
  customerOrderSeats.forEach(seatId => updateSeatState(seatId, { ...customerOrder, seatId }));
  updateTodayStats({ arrivals: 1, people: selectedCustomerCapacity, orders: 1, couponUsed: isCoupon ? 1 : 0 });
  selectedCustomerPackage = null; selectedCustomerSecondSeat = null; selectedCustomerSeatIds = []; selectedCustomerAccessories = [];
  showToast('已自助开台，请开始创作');
  renderCustomerView();
}

function updateLiveTime(state) {
  const timer = document.getElementById('customer-timer-display');
  const remain = document.getElementById('customer-remaining');
  if (!timer || !remain) return renderCustomerView();
  const left = getRemainingMs(state);
  timer.textContent = left === Infinity ? '不限时' : formatTime(left);
  const overtime = isOvertime(state);
  remain.className = `customer-remaining ${overtime ? 'danger' : left < 600000 ? 'warning' : ''}`;
  remain.textContent = left === Infinity ? '✨ 不限时畅玩' : overtime ? `⚠️ 已超时 ${formatTime(-left)}` : `剩余 ${formatTime(left)}`;
}

function toggleCustomerAccessory(accessoryId) { const state = getSeatState(currentSeatId); const selected = new Set(state.status === 'free' ? selectedCustomerAccessories : (state.selectedAccessories || [])); if (selected.has(accessoryId)) selected.delete(accessoryId); else selected.add(accessoryId); if (state.status === 'free') { selectedCustomerAccessories = [...selected]; renderCustomerView(); } else { updateSeatState(currentSeatId, { selectedAccessories: [...selected] }); renderCustomerView(); } }

function requestExtra() {
  addExtraRequest(currentSeatId);
  renderCustomerView();
  showToast('已通知前台，请稍候~');
}

let pendingCustomerIronMode = null;
function openIronForm() { pendingCustomerIronMode = getIronModes()[0] || '普通熨烫'; customerIronFormOpen = true; renderCustomerView(); }
function selectCustomerIronMode(mode, button) { pendingCustomerIronMode = mode; document.querySelectorAll('.customer-iron-tags .status-tag').forEach(x => x.classList.remove('selected')); button.classList.add('selected'); }

function compressImage(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      image.onerror = reject; image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function submitIronRequest() {
  const mode = pendingCustomerIronMode || getIronModes()[0] || '普通熨烫';
  const imageInput = document.getElementById('iron-image');
  const file = imageInput?.files?.[0] || null;
  let image = null;
  try { image = await compressImage(file); } catch (_) { return showToast('图片读取失败，请重试'); }
  const request = { mode, image, requestedAt: Date.now() };
  const queueItem = addIronQueueRequest(currentSeatId, request);
  updateSeatState(currentSeatId, { ironRequestedAt: request.requestedAt, ironMode: mode, ironImage: image, ironDone: false, ironStatus:'pending', needIron: true, lastIronRequestId: queueItem.id });
  saveIronRequest(currentSeatId, request);
  updateTodayStats({ needIron: 1 });
  customerIronFormOpen = false;
  showToast(`熨烫申请已提交，当前排第 ${getIronQueuePosition(queueItem.id)} 位`);
  renderCustomerView();
}
