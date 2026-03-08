// ═══════════════════════════════════════════════════
// VictoryEdge Pro — admin.js
// Admin panel logic (runs after app.js)
// ═══════════════════════════════════════════════════

'use strict';

let editingTipId = null;

function openAdmin() {
  if (!ADMIN_DEVICES.includes(DEVICE_ID)) return; // silently block unauthorized devices
  document.getElementById('adminPanel').classList.add('open');
  showADash();
}
function closeAdmin() {
  document.getElementById('adminPanel').classList.remove('open');
}
function checkAdmin() {
  // Legacy function — admin is now device-ID based, no password needed
  showNotif('🔒 Access denied', '🔐');
}
function showADash() {
  document.getElementById('aLogin').style.display = 'none';
  document.getElementById('aDash').style.display = 'block';
  renderDevTable();
  renderAdminTips();
  renderHistAdmin();
}
function aTab(tab, btn) {
  document.querySelectorAll('.atab').forEach(t => t.classList.remove('act'));
  document.querySelectorAll('.acontent').forEach(c => c.classList.remove('act'));
  btn.classList.add('act');
  document.getElementById('a-' + tab).classList.add('act');
}
function renderDevTable() {
  const reg  = getReg();
  const tbody = document.getElementById('devTbody');
  if (!tbody) return;
  const devs = Object.values(reg);
  if (!devs.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:18px;">No devices registered yet.<br><small style="font-size:10px;opacity:.7;">Devices appear here when users first visit the site.</small></td></tr>`;
    return;
  }
  tbody.innerHTML = devs.map(d => {
    const elapsed = d.plan === 'trial' ? Date.now() - d.trialStart : null;
    const tLeft   = elapsed != null ? Math.max(0, Math.ceil((TRIAL_DURATION - elapsed) / 3600000)) + 'h left' : '-';
    return `<tr>
      <td style="font-family:monospace;font-size:10px;color:var(--dm);word-break:break-all;max-width:150px;">${d.id}${d.id === DEVICE_ID ? ' <span style="background:var(--pu);color:#fff;padding:1px 5px;border-radius:4px;font-size:9px;">YOU</span>' : ''}</td>
      <td>
        <select class="psel" id="psel-${d.id}">
          ${['free','trial','gold','silver','diamond'].map(p => `<option value="${p}"${d.plan === p ? ' selected' : ''}>${p}</option>`).join('')}
        </select>
      </td>
      <td style="font-size:10px;color:var(--muted);">${tLeft}</td>
      <td style="font-size:10px;color:var(--muted);">${d.joined}</td>
      <td><button class="sav-btn" onclick="adminSetPlan('${d.id}')">💾 Save</button></td>
    </tr>`;
  }).join('');
}
function adminSetPlan(id) {
  const sel = document.getElementById('psel-' + id);
  if (!sel) return;
  const plan = sel.value;
  const r = getReg();
  if (r[id]) {
    r[id].plan = plan;
    if (['gold','silver','diamond','free'].includes(plan)) {
      delete r[id].trialStart;
    }
    saveReg(r);
    if (firebaseReady) {
      dbDevices.child(id).update({ plan });
    }
  }
  if (id === DEVICE_ID) {
    renderFreeTips();
    renderVipTips();
    updateSBPlan();
    updateHomeUI();
    updateTimers();
  }
  showNotif(`✅ ${id.slice(-10)} → ${plan.toUpperCase()}`, '✅');
}
function filterDev() {
  const q = document.getElementById('devSearch').value.toLowerCase();
  document.querySelectorAll('#devTbody tr').forEach(r =>
    r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none'
  );
}
function addTip() {
  if (editingTipId !== null) { updateTip(); return; }
  let tipValue = document.getElementById('tTipCustom').value.trim();
  if (!tipValue) {
    tipValue = document.getElementById('tTipSelect').value;
    if (!tipValue) { showNotif('⚠️ Please select or type a market', '⚠️'); return; }
  }
  const nt = {
    id:      Date.now(),
    time:    document.getElementById('tTime').value,
    country: document.getElementById('tCountry').value.trim(),
    match:   document.getElementById('tMatch').value.trim(),
    tip:     tipValue,
    odds:    document.getElementById('tOdds').value,
    result:  document.getElementById('tResult').value,
    plan:    document.getElementById('tPlan').value,
  };
  if (!nt.match || !nt.country || !nt.odds) { showNotif('⚠️ Fill all fields', '⚠️'); return; }
  const all = getTips();
  const lim = nt.plan === 'free' ? 3 : 5;
  if (all.filter(t => t.plan === nt.plan && t.id > 1000).length >= lim) {
    showNotif(`⚠️ Max ${lim} custom tips for ${nt.plan}`, '⚠️');
    return;
  }
  saveTips([nt, ...all.filter(t => t.id > 1000)]);
  showNotif('✅ Tip added!', '✅');
  clearTipForm();
}
function clearTipForm() {
  document.getElementById('tTime').value = '';
  document.getElementById('tCountry').value = '';
  document.getElementById('tMatch').value = '';
  document.getElementById('tTipSelect').value = '';
  document.getElementById('tTipCustom').value = '';
  document.getElementById('tOdds').value = '';
  document.getElementById('tResult').value = 'pending';
  document.getElementById('tPlan').value = 'free';
  const addBtn = document.querySelector('#a-tips .bsub');
  if (addBtn) { addBtn.textContent = '+ Add Tip'; addBtn.setAttribute('onclick', 'addTip()'); }
  editingTipId = null;
}
function startEditTip(id) {
  const tips = getTips();
  const tip = tips.find(t => t.id === id);
  if (!tip) return;
  document.getElementById('tTime').value = tip.time || '';
  document.getElementById('tCountry').value = tip.country || '';
  document.getElementById('tMatch').value = tip.match || '';
  document.getElementById('tOdds').value = tip.odds || '';
  document.getElementById('tResult').value = tip.result || 'pending';
  document.getElementById('tPlan').value = tip.plan || 'free';
  const select = document.getElementById('tTipSelect');
  const custom = document.getElementById('tTipCustom');
  const options = Array.from(select.options).map(opt => opt.value);
  if (options.includes(tip.tip)) {
    select.value = tip.tip;
    custom.value = '';
  } else {
    select.value = '';
    custom.value = tip.tip;
  }
  const addBtn = document.querySelector('#a-tips .bsub');
  addBtn.textContent = '✏️ Update Tip';
  addBtn.setAttribute('onclick', 'updateTip()');
  editingTipId = id;
}
function updateTip() {
  if (editingTipId === null) { showNotif('⚠️ No tip being edited', '⚠️'); return; }
  let tipValue = document.getElementById('tTipCustom').value.trim();
  if (!tipValue) {
    tipValue = document.getElementById('tTipSelect').value;
    if (!tipValue) { showNotif('⚠️ Please select or type a market', '⚠️'); return; }
  }
  const updatedTip = {
    id:      editingTipId,
    time:    document.getElementById('tTime').value,
    country: document.getElementById('tCountry').value.trim(),
    match:   document.getElementById('tMatch').value.trim(),
    tip:     tipValue,
    odds:    document.getElementById('tOdds').value,
    result:  document.getElementById('tResult').value,
    plan:    document.getElementById('tPlan').value,
  };
  if (!updatedTip.match || !updatedTip.country || !updatedTip.odds) { showNotif('⚠️ Fill all fields', '⚠️'); return; }
  const allTips = getTips();
  const filtered = allTips.filter(t => t.id > 1000);
  const index = filtered.findIndex(t => t.id === editingTipId);
  if (index !== -1) filtered[index] = updatedTip;
  else filtered.push(updatedTip);
  saveTips(filtered);
  showNotif('✅ Tip updated!', '✅');
  clearTipForm();
  renderAdminTips();
}
function renderAdminTips() {
  const c = document.getElementById('adminTipList');
  if (!c) return;
  const tips = getTips().filter(t => t.id > 1000);
  if (!tips.length) {
    c.innerHTML = `<div style="text-align:center;color:var(--muted);padding:14px;">No custom tips yet. Add above.</div>`;
    return;
  }
  c.innerHTML = tips.map(tip => `
    <div style="background:var(--card2);border:1px solid var(--border);border-radius:9px;padding:9px 11px;margin-bottom:7px;display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
      <div style="flex:1;min-width:120px;">
        <div style="font-weight:800;font-size:12px;">${tip.time} · ${tip.match}</div>
        <div style="font-size:10px;color:var(--muted)">${tip.country} | ${tip.tip} @ ${tip.odds} | <span style="color:var(--gd)">${tip.plan}</span></div>
      </div>
      <select class="rsel" onchange="setTipResult(${tip.id},this.value)">
        <option value="pending"${tip.result==='pending'?' selected':''}>Pending</option>
        <option value="win"${tip.result==='win'?' selected':''}>Win</option>
        <option value="lose"${tip.result==='lose'?' selected':''}>Lose</option>
      </select>
      <button class="sav-btn" onclick="startEditTip(${tip.id})">✏️ Edit</button>
      <button class="del-btn" onclick="delTip(${tip.id})">🗑</button>
    </div>`).join('');
}
function setTipResult(id, r) {
  const tips = getTips();
  const t = tips.find(x => x.id === id);
  if (!t) return;
  if (r === 'win' || r === 'lose') {
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}.${today.getFullYear()}`;
    const historyEntry = {
      id: Date.now(),
      date: formattedDate,
      league: t.country || 'Unknown',
      match: t.match,
      tip: t.tip,
      odds: t.odds,
      result: r,
      score: ''
    };
    const history = getHistory();
    saveHistory([historyEntry, ...history]);
    renderHistAdmin();
  }
  saveTips(tips.filter(x => x.id !== id));
  renderAdminTips();
  showNotif(`✅ Tip moved to history as ${r.toUpperCase()}`, '📋');
}
function delTip(id) {
  saveTips(getTips().filter(t => t.id !== id && t.id > 1000));
  showNotif('🗑 Deleted', '🗑');
}
function addHistory() {
  const hist = getHistory().filter(h => h.id > 1000);
  const nh = {
    id: Date.now(),
    date: document.getElementById('hDate').value,
    league: document.getElementById('hLeague').value.trim(),
    match: document.getElementById('hMatch').value.trim(),
    tip: document.getElementById('hTip').value.trim(),
    odds: document.getElementById('hOdds').value,
    score: ''
  };
  if (!nh.match || !nh.league) { showNotif('⚠️ Fill all fields', '⚠️'); return; }
  saveHistory([nh, ...hist]);
  showNotif('✅ History added!', '✅');
  ['hDate','hLeague','hMatch','hTip','hOdds'].forEach(i => document.getElementById(i).value = '');
}
function delHistory(id) {
  saveHistory(getHistory().filter(h => h.id !== id && h.id > 1000));
}
function renderHistAdmin() {
  const c = document.getElementById('histAdminList');
  if (!c) return;
  const h = getHistory().filter(x => x.id > 1000);
  if (!h.length) {
    c.innerHTML = `<div style="text-align:center;color:var(--muted);padding:14px;">No custom history entries yet.</div>`;
    return;
  }
  c.innerHTML = h.map(x => `
    <div style="background:var(--card2);border:1px solid var(--border);border-radius:9px;padding:9px 11px;margin-bottom:7px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <div style="flex:1;min-width:120px;">
        <div style="font-weight:800;font-size:12px;">${x.match}</div>
        <div style="font-size:10px;color:var(--muted)">${x.date} | ${x.tip} @ ${x.odds}</div>
      </div>
      <button class="del-btn" onclick="delHistory(${x.id})">🗑</button>
    </div>`).join('');
}
async function adminSendNotif() {
  const m = document.getElementById('notifMsg').value.trim();
  if (!m) return;

  // Save notification to Firebase — all devices with FCM tokens will receive it
  // via Firebase Cloud Messaging triggered by Cloud Functions or FCM HTTP API
  if (firebaseReady) {
    const notifRef = firebase.database().ref('notifications');
    await notifRef.push({
      message: m,
      title: 'VictoryEdge Pro 🏆',
      sentAt: Date.now(),
      sentBy: DEVICE_ID
    });
    showNotif('✅ Notification sent to all users!', '📣');
  } else {
    showNotif('❌ Firebase not connected', '⚠️');
    return;
  }

  // Also show locally
  showNotif('📣 ' + m, '📣');
  document.getElementById('notifMsg').value = '';
}
