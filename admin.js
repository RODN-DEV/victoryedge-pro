// ═══════════════════════════════════════════════════
// VictoryEdge Pro — admin.js
// Admin panel logic (runs after app.js)
// ═══════════════════════════════════════════════════

'use strict';

// ── ADMIN AUTH ────────────────────────────────────────
function openAdmin() {
  document.getElementById('adminPanel').classList.add('open');
  if (adminLoggedIn) showADash();
}
function closeAdmin() {
  document.getElementById('adminPanel').classList.remove('open');
}
function checkAdmin() {
  const input = document.getElementById('aPw').value;
  if (btoa(input) === ADMIN_PW_HASH) {
    adminLoggedIn = true;
    showADash();
  } else {
    document.getElementById('aPw').style.borderColor = 'var(--rd)';
    document.getElementById('aPw').value = '';
    setTimeout(() => { document.getElementById('aPw').style.borderColor = ''; }, 800);
    showNotif('❌ Wrong password', '🔐');
  }
}
function showADash() {
  document.getElementById('aLogin').style.display = 'none';
  document.getElementById('aDash').style.display = 'block';
  renderDevTable();
  renderAdminTips();
  renderHistAdmin();
}

// ── ADMIN TABS ────────────────────────────────────────
function aTab(tab, btn) {
  document.querySelectorAll('.atab').forEach(t => t.classList.remove('act'));
  document.querySelectorAll('.acontent').forEach(c => c.classList.remove('act'));
  btn.classList.add('act');
  document.getElementById('a-' + tab).classList.add('act');
}

// ── DEVICE TABLE ──────────────────────────────────────
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
    const tLeft   = elapsed != null ? Math.max(0, Math.ceil((THREE_DAYS - elapsed) / 3600000)) + 'h left' : '-';
    const planBadge = { free:'🆓', trial:'⏱', gold:'🥇', silver:'🥈', diamond:'💎' }[d.plan] || '?';
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
    // If setting a paid plan, clear trial timer
    if (['gold','silver','diamond','free'].includes(plan)) {
      delete r[id].trialStart;
    }
    saveReg(r);
    // Write directly to Firebase for immediate propagation
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

// ── TIPS ADMIN ────────────────────────────────────────
function addTip() {
  const tips = getTips().filter(t => t.id > 1000); // only custom tips
  const nt = {
    id:      Date.now(),
    time:    document.getElementById('tTime').value,
    country: document.getElementById('tCountry').value.trim(),
    match:   document.getElementById('tMatch').value.trim(),
    tip:     document.getElementById('tTip').value,
    odds:    document.getElementById('tOdds').value,
    result:  document.getElementById('tResult').value,
    plan:    document.getElementById('tPlan').value,
  };
  if (!nt.match || !nt.country || !nt.odds) { showNotif('⚠️ Fill all fields', '⚠️'); return; }
  const all = getTips();
  const lim = nt.plan === 'free' ? 3 : 5;
  if (all.filter(t => t.plan === nt.plan && t.id > 1000).length >= lim) {
    showNotif(`⚠️ Max ${lim} custom tips for ${nt.plan} — delete one first`, '⚠️');
    return;
  }
  const newAll = [nt, ...all.filter(t => t.id > 1000)]; // only persist custom
  saveTips(newAll);
  showNotif('✅ Tip added!', '✅');
  ['tMatch','tCountry','tOdds'].forEach(i => { document.getElementById(i).value = ''; });
}

function renderAdminTips() {
  const c = document.getElementById('adminTipList');
  if (!c) return;
  const tips = getTips().filter(t => t.id > 1000); // show only custom
  if (!tips.length) {
    c.innerHTML = `<div style="text-align:center;color:var(--muted);padding:14px;font-size:12px;">No custom tips yet. Add above.</div>`;
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
      <button class="del-btn" onclick="delTip(${tip.id})">🗑</button>
    </div>`).join('');
}

function setTipResult(id, r) {
  const tips = getTips();
  const t = tips.find(x => x.id === id);
  if (t) { t.result = r; saveTips(tips.filter(x => x.id > 1000)); }
}

function delTip(id) {
  saveTips(getTips().filter(t => t.id !== id && t.id > 1000));
  showNotif('🗑 Deleted', '🗑');
}

// ── HISTORY ADMIN ─────────────────────────────────────
function addHistory() {
  const hist = getHistory().filter(h => h.id > 1000);
  const nh = {
    id:     Date.now(),
    date:   document.getElementById('hDate').value,
    league: document.getElementById('hLeague').value.trim(),
    match:  document.getElementById('hMatch').value.trim(),
    tip:    document.getElementById('hTip').value.trim(),
    odds:   document.getElementById('hOdds').value,
    score:  '',
  };
  if (!nh.match || !nh.league) { showNotif('⚠️ Fill all fields', '⚠️'); return; }
  const newHist = [nh, ...hist];
  saveHistory(newHist);
  showNotif('✅ History added!', '✅');
  ['hDate','hLeague','hMatch','hTip','hOdds'].forEach(i => { document.getElementById(i).value = ''; });
}

function delHistory(id) {
  saveHistory(getHistory().filter(h => h.id !== id && h.id > 1000));
}

function renderHistAdmin() {
  const c = document.getElementById('histAdminList');
  if (!c) return;
  const h = getHistory().filter(x => x.id > 1000);
  if (!h.length) {
    c.innerHTML = `<div style="text-align:center;color:var(--muted);padding:14px;font-size:12px;">No custom history entries yet.</div>`;
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

// ── NOTIFY ────────────────────────────────────────────
function adminSendNotif() {
  const m = document.getElementById('notifMsg').value.trim();
  if (!m) return;
  showNotif('📣 ' + m, '📣');
  pushNotif(m);
  document.getElementById('notifMsg').value = '';
  showNotif('✅ Notification sent!', '✅');
}
