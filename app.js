// ═══════════════════════════════════════════════════
// VictoryEdge Pro — app.js
// Main application logic + Firebase data layer
// ═══════════════════════════════════════════════════

'use strict';

// ── SIMPLE ANTI‑DEVTOOLS (no false positives) ────────
(function() {
  let devToolsOpen = false;
  let warningShown = false;

  function checkConsole() {
    const element = new Image();
    Object.defineProperty(element, 'id', {
      get: function() {
        devToolsOpen = true;
        return 'triggered';
      }
    });
    console.log(element);
  }

  function checkDimensions() {
    const widthThreshold = window.outerWidth - window.innerWidth > 200;
    const heightThreshold = window.outerHeight - window.innerHeight > 200;
    if (widthThreshold || heightThreshold) {
      devToolsOpen = true;
    }
  }

  function checkDebugger() {
    const start = performance.now();
    debugger;
    const end = performance.now();
    if (end - start > 100) {
      devToolsOpen = true;
    }
  }

  function detect() {
    checkConsole();
    checkDimensions();
    if (devToolsOpen) {
      checkDebugger();
      if (devToolsOpen) return true;
    }
    return false;
  }

  function showWarning() {
    if (warningShown) return;
    warningShown = true;
    document.documentElement.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; height:100vh; background:#000; color:#ff0000; font-family:monospace; font-size:32px; text-align:center; padding:20px;">
        ⚠️ Developer tools are not permitted.<br>
        <span style="font-size:18px; margin-top:20px;">Please close DevTools and reload the page.</span>
      </div>
    `;
    throw new Error('DevTools detected');
  }

  setTimeout(() => {
    if (detect()) showWarning();
  }, 500);

  let count = 0;
  const interval = setInterval(() => {
    count++;
    if (detect()) {
      clearInterval(interval);
      showWarning();
    }
    if (count > 20) clearInterval(interval);
  }, 1000);
})();

// ── ADDITIONAL CODE PROTECTION ───────────────────────
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  const blocked =
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && ['I','J','C','K'].includes(e.key)) ||
    (e.ctrlKey && e.key === 'U') ||
    (e.ctrlKey && e.key === 'S');
  if (blocked) { e.preventDefault(); e.stopPropagation(); return false; }
});
document.addEventListener('dragstart', e => e.preventDefault());

// ── CONSTANTS ────────────────────────────────────────
const ADMIN_PW_HASH = btoa('victory2026');
const TG_ADMIN      = 'https://t.me/master_picks_odds';
const TG_CHANNEL    = 'https://t.me/+11ot3EOvrYozNmI8';
const TRIAL_DAYS    = 1;
const TRIAL_DURATION = TRIAL_DAYS * 24 * 60 * 60 * 1000;

// ── STATE ────────────────────────────────────────────
let adminLoggedIn  = false;
let activeVipTab   = 'gold';
let timerInt       = null;
let firebaseReady  = false;

let cachedDevices  = {};
let cachedTips     = [];
let cachedHistory  = [];

let dbDevices, dbTips, dbHistory;

// ── DEVICE ID ────────────────────────────────────────
function genDID() {
  const n = navigator, s = screen;
  const raw = [n.userAgent, n.language, s.width, s.height, s.colorDepth, new Date().getTimezoneOffset()].join('|');
  let h = 0;
  for (let i = 0; i < raw.length; i++) { h = ((h << 5) - h) + raw.charCodeAt(i); h |= 0; }
  const base = Math.abs(h).toString(16).toUpperCase().padStart(8, '0');
  let rand = localStorage.getItem('dRand');
  if (!rand) { rand = Math.random().toString(36).substr(2, 6).toUpperCase(); localStorage.setItem('dRand', rand); }
  return `VE-${base}-${rand}`;
}
const DEVICE_ID = genDID();

// ── LOCALSTORAGE DEVICE BACKUP ───────────────────────
function loadLocalDevice() {
  const saved = localStorage.getItem('ve_device');
  if (saved) {
    try { return JSON.parse(saved); } catch (e) { return null; }
  }
  return null;
}
function saveLocalDevice(deviceData) {
  localStorage.setItem('ve_device', JSON.stringify(deviceData));
}

// ── FIREBASE INIT ────────────────────────────────────
function initFirebase() {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    const db = firebase.database();
    dbDevices = db.ref('devices');
    dbTips    = db.ref('tips');
    dbHistory = db.ref('history');

    dbDevices.on('value', snap => {
      cachedDevices = snap.val() || {};
      if (!cachedDevices[DEVICE_ID]) {
        const localDev = loadLocalDevice();
        if (localDev && localDev.id === DEVICE_ID) {
          cachedDevices[DEVICE_ID] = localDev;
          dbDevices.child(DEVICE_ID).set(localDev);
        } else {
          const newDev = {
            id: DEVICE_ID,
            plan: 'trial',
            trialStart: Date.now(),
            joined: new Date().toLocaleDateString()
          };
          cachedDevices[DEVICE_ID] = newDev;
          dbDevices.child(DEVICE_ID).set(newDev);
          saveLocalDevice(newDev);
        }
      } else {
        saveLocalDevice(cachedDevices[DEVICE_ID]);
      }
      updateSBPlan();
      updateHomeUI();
      updateTimers();
      renderFreeTips();
      renderVipTips();
      if (adminLoggedIn) renderDevTable(); // refresh admin if logged in
    });

    dbTips.on('value', snap => {
      const val = snap.val();
      cachedTips = (val && typeof val === 'object') ? Object.values(val).sort((a,b) => b.id - a.id) : [];
      renderFreeTips();
      renderVipTips();
      if (adminLoggedIn) renderAdminTips();
    });

    dbHistory.on('value', snap => {
      const val = snap.val();
      cachedHistory = (val && typeof val === 'object') ? Object.values(val).sort((a,b) => b.id - a.id) : [];
      renderHistory();
      if (adminLoggedIn) renderHistAdmin();
    });

    firebaseReady = true;
    console.log('✅ Firebase connected');
    const badge = document.getElementById('fbStatus');
    if (badge) { badge.className = 'fb-status fb-ok'; badge.textContent = '🟢 Firebase Connected'; }

  } catch (err) {
    console.warn('Firebase error:', err.message);
    firebaseReady = false;
    cachedTips = [];
    cachedHistory = [];
    const localDev = loadLocalDevice();
    if (localDev && localDev.id === DEVICE_ID) {
      cachedDevices = { [DEVICE_ID]: localDev };
    } else {
      const newDev = {
        id: DEVICE_ID,
        plan: 'trial',
        trialStart: Date.now(),
        joined: new Date().toLocaleDateString()
      };
      cachedDevices = { [DEVICE_ID]: newDev };
      saveLocalDevice(newDev);
    }
    const badge = document.getElementById('fbStatus');
    if (badge) { badge.className = 'fb-status fb-err'; badge.textContent = '🔴 Firebase Offline — fill firebase-config.js'; }
    updateSBPlan();
    updateHomeUI();
    renderFreeTips();
    updateTimers();
  }
}

// ── DATA ACCESSORS ───────────────────────────────────
function getTips()    { return cachedTips || []; }
function getHistory() { return cachedHistory || []; }
function getReg()     { return cachedDevices; }

function saveTips(tipsArr) {
  cachedTips = tipsArr;
  if (!firebaseReady) return;
  const obj = {};
  tipsArr.forEach(t => obj[t.id] = t);
  dbTips.set(obj).catch(e => console.error('saveTips error:', e));
}
function saveHistory(histArr) {
  cachedHistory = histArr;
  if (!firebaseReady) return;
  const obj = {};
  histArr.forEach(h => obj[h.id] = h);
  dbHistory.set(obj).catch(e => console.error('saveHistory error:', e));
}
function saveReg(r) {
  cachedDevices = r;
  if (!firebaseReady) return;
  dbDevices.set(r).catch(e => console.error('saveReg error:', e));
}

// ── DEVICE REGISTRY ──────────────────────────────────
function getMyDev() {
  return cachedDevices[DEVICE_ID] || { id: DEVICE_ID, plan: 'trial', trialStart: Date.now(), joined: new Date().toLocaleDateString() };
}
function getEffPlan() {
  const d = getMyDev();
  if (!d) return 'free';
  if (!['trial', 'free'].includes(d.plan)) return d.plan;
  if (d.plan === 'trial') {
    const elapsed = Date.now() - d.trialStart;
    return elapsed < TRIAL_DURATION ? 'vip' : 'expired';
  }
  return 'free';
}
const planLvl = { free: 0, gold: 1, silver: 2, diamond: 3, vip: 10 };
function canSee(tipPlan, userPlan) {
  if (userPlan === 'vip') return true;
  if (userPlan === 'expired') return false;
  return (planLvl[userPlan] || 0) >= (planLvl[tipPlan] || 0);
}

// ── TIMER ─────────────────────────────────────────────
function updateTimers() {
  const d = getMyDev();
  if (!d || d.plan !== 'trial') {
    document.getElementById('trialStripActive')?.classList.add('hide');
    document.getElementById('trialStripExpired')?.classList.add('hide');
    ['heroTimer','sbTimer'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = '--:--:--';
    });
    const lbl = document.getElementById('sbTimerLabel');
    if (lbl) lbl.textContent = 'No Active Trial';
    updateSBPlan(); return;
  }
  const remaining = TRIAL_DURATION - (Date.now() - d.trialStart);
  if (remaining <= 0) {
    document.getElementById('trialStripActive')?.classList.add('hide');
    document.getElementById('trialStripExpired')?.classList.remove('hide');
    ['heroTimer','sbTimer'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = '00:00:00';
    });
    const lbl = document.getElementById('sbTimerLabel');
    if (lbl) lbl.textContent = 'Trial Expired';
    if (timerInt) { clearInterval(timerInt); timerInt = null; }
    updateSBPlan(); return;
  }
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  const fmt = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  document.getElementById('trialStripActive')?.classList.remove('hide');
  document.getElementById('trialStripExpired')?.classList.add('hide');
  ['heroTimer','sbTimer'].forEach(id => {
    const el = document.getElementById(id); if (el) el.textContent = fmt;
  });
  const lbl = document.getElementById('sbTimerLabel');
  if (lbl) lbl.textContent = 'FREE VIP Trial Remaining';
  if (remaining < 6 * 3600000 && remaining > 6 * 3600000 - 2000) {
    showNotif('⚠️ Less than 6hrs left on VIP trial!','⚠️');
    pushNotif('VIP Trial expires in 6 hours!');
  }
  updateSBPlan();
}

// ── RENDER TIPS & HISTORY (unchanged from your previous working version) ──
// (I'll keep them concise; you already have them in your file)

function renderFreeTips() {
  const tips = getTips().filter(t => t.plan === 'free');
  document.getElementById('freeCnt').textContent = tips.length + ' picks';
  const list = document.getElementById('freeTipsList');
  if (list) list.innerHTML = tips.map(t => buildCard(t, 'free', true)).join('');
}
function switchVipTab(plan, btn) {
  activeVipTab = plan;
  document.querySelectorAll('.ptab').forEach(t => t.className = 'ptab');
  const cls = { gold: 'ag', silver: 'as', diamond: 'ad' };
  if (btn) btn.className = 'ptab ' + (cls[plan] || '');
  renderVipTips();
}
function renderVipTips() {
  const p = getEffPlan();
  const tips = getTips().filter(t => t.plan === activeVipTab);
  const el = document.getElementById('vipTipsList');
  if (!el) return;
  const ok = canSee(activeVipTab, p);
  document.getElementById('vipBannerT').textContent = ok ? (p==='vip'?'🎁 Full VIP Access — Trial Active':'✅ Plan Active — Full Access') : `🔒 ${activeVipTab} Plan Required`;
  document.getElementById('vipBannerS').textContent = ok ? (p==='vip'?'Enjoy all premium picks during your 1-day trial!':'All picks unlocked for your subscription') : 'Upgrade to access these picks';
  ['gold','silver','diamond'].forEach(pl => {
    const c = document.getElementById('vcnt-'+pl);
    if (c) c.textContent = getTips().filter(t => t.plan === pl).length;
  });
  if (!ok) {
    el.innerHTML = `<div class="up-prompt"><h3>🔒 LOCKED</h3><p>You need a <strong>${activeVipTab}</strong> subscription.</p><button class="up-btn" onclick="showView('plans')">💎 Upgrade Now</button></div>`;
    return;
  }
  if (!tips.length) {
    el.innerHTML = `<div style="padding:28px;text-align:center;color:var(--muted);">No tips posted yet ⚽</div>`;
    return;
  }
  el.innerHTML = tips.map(t => buildCard(t, activeVipTab, ok)).join('');
}
function buildCard(tip, plan, ok) {
  if (!ok) {
    return `<div class="tip-card locked tc-${plan}"><div class="blur-c">...</div><div class="lock-ov"><span class="lock-ico">🔒</span><button class="lock-msg-btn" onclick="showView('plans')">Upgrade to Unlock</button></div></div>`;
  }
  return `<div class="tip-card tc-${plan}"><div class="tc-hd"><span class="tc-league">⚽ ${tip.country}</span><span class="tc-time">${tip.time}</span></div><div class="tc-match">${tip.match}</div><div class="tc-ft"><span class="tc-chip chip-${plan}">${tip.tip}</span><span class="tc-odds">${tip.odds}</span>${rdot(tip.result)}</div></div>`;
}
function rdot(r) {
  if (r === 'win') return `<div class="tc-res rw">W</div>`;
  if (r === 'lose') return `<div class="tc-res rl">L</div>`;
  return `<div class="tc-res rp">?</div>`;
}
function renderHistory() {
  const grid = document.getElementById('historyGrid');
  if (!grid) return;
  const h = getHistory();
  grid.innerHTML = h.map(x => {
    return `<div class="hc"><div class="hc-top"><span class="hc-date">📅 ${x.date}</span><span class="hc-win">✅ WIN</span></div><div class="hc-match">${x.match}</div><div class="hc-bot"><span class="hc-tip">${x.league} · ${x.tip}</span><span class="hc-odds">${x.odds}</span></div></div>`;
  }).join('');
  renderHistAdmin();
}
function showView(v) { /* unchanged */ }
function updateHomeUI() {
  const p = getEffPlan();
  const ico = document.getElementById('vipLock');
  if (ico) ico.textContent = (p === 'vip' || planLvl[p] >= 1) ? '🔓' : '🔒';
}
function updateSBPlan() {
  const p = getEffPlan();
  const el = document.getElementById('sbPlanDisplay');
  const m = {
    vip: ['pb-trial', '⏱ VIP Trial Active'],
    free: ['pb-free', '🆓 Free Plan'],
    gold: ['pb-gold', '🥇 Gold Plan'],
    silver: ['pb-silver', '🥈 Silver Plan'],
    diamond: ['pb-diamond', '💎 Diamond Plan'],
    expired: ['pb-expired', '⚠️ Trial Expired'],
  };
  const [cls, lbl] = m[p] || ['pb-free', 'Free Plan'];
  if (el) el.innerHTML = `<div class="plan-badge ${cls}">${lbl}</div>`;
}
function closeWelcome() {
  document.getElementById('welcomeModal').style.display = 'none';
  checkExpired();
  requestNotifPerm();
  updateTimers();
}
function joinTG() { window.open(TG_CHANNEL, '_blank'); }
function checkExpired() {
  if (getEffPlan() === 'expired') setTimeout(() => document.getElementById('trialModal').classList.add('show'), 700);
}
function closeTrialModal() {
  document.getElementById('trialModal').classList.remove('show');
  showView('plans');
}
function subscribePlan(plan) {
  const msg = encodeURIComponent(`Hi! I want to subscribe to the ${plan.toUpperCase()} plan.\n\nMy Device ID: ${DEVICE_ID}\n\nPlease activate my account. Thank you!`);
  window.open(`https://t.me/master_picks_odds?text=${msg}`, '_blank');
  showNotif(`📩 Opening Telegram for ${plan.toUpperCase()} subscription...`, '✈️');
}
function openTut()  { document.getElementById('tutModal').classList.add('show'); }
function closeTut() { document.getElementById('tutModal').classList.remove('show'); }
function requestNotifPerm() {
  if ('Notification' in window && Notification.permission === 'default')
    setTimeout(() => Notification.requestPermission(), 3000);
}
function pushNotif(m) {
  if ('Notification' in window && Notification.permission === 'granted')
    new Notification('VictoryEdge Pro', { body: m });
}
function showNotif(m, i = '⚽') {
  document.getElementById('notifIcon').textContent = i;
  document.getElementById('notifTxt').textContent = m;
  const n = document.getElementById('notif');
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 5000);
}
function closeNotif() { document.getElementById('notif').classList.remove('show'); }
function toggleSB() {
  document.getElementById('sb').classList.toggle('open');
  document.getElementById('sover').classList.toggle('open');
  document.getElementById('ham').classList.toggle('open');
}
function closeSB() {
  document.getElementById('sb').classList.remove('open');
  document.getElementById('sover').classList.remove('open');
  document.getElementById('ham').classList.remove('open');
}
function setTheme(t) {
  if (!t) t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('theme', t);
  const b = document.getElementById('themeBtn');
  if (b) b.textContent = t === 'dark' ? '🌙' : '☀️';
}
function setLang(l) {
  localStorage.setItem('lang', l);
  document.documentElement.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
  document.querySelectorAll('.lb').forEach(b =>
    b.classList.toggle('act', b.textContent.trim().toUpperCase().includes(l.toUpperCase()))
  );
  showNotif('🌐 Language updated', '🌐');
}
function copyDID() {
  navigator.clipboard.writeText(DEVICE_ID).then(() =>
    showNotif('✅ Device ID copied! Send to @master_picks_odds', '📋')
  );
}
window.addEventListener('scroll', () =>
  document.getElementById('sup').classList.toggle('show', window.scrollY > 300)
);
(function init() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);
  document.getElementById('didVal').textContent = DEVICE_ID;
  document.getElementById('footerDID').textContent = 'Device: ' + DEVICE_ID;
  initFirebase();
  timerInt = setInterval(updateTimers, 1000);
  setTimeout(() => {
    const overlay = document.getElementById('loadOverlay');
    if (overlay) overlay.classList.add('done');
    setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 600);
  }, 1200);
  setTimeout(() => {
    showNotif("⚽ Today's picks are live! Tap Daily Free Tips to start.", '⚽');
    pushNotif("Today's predictions are live!");
  }, 10000);
})();
