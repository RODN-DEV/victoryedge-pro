// ═══════════════════════════════════════════════════
// VictoryEdge Pro — app.js
// Main application logic + Firebase data layer
// ═══════════════════════════════════════════════════

'use strict';

// ── SIMPLE ANTI‑DEVTOOLS (no false positives) ────────
(function() {
  let devToolsOpen = false;
  let warningShown = false;

  // Method 1: Console getter trick (reliable)
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

  // Method 2: Dimension check (less reliable alone)
  function checkDimensions() {
    const widthThreshold = window.outerWidth - window.innerWidth > 200;
    const heightThreshold = window.outerHeight - window.innerHeight > 200;
    if (widthThreshold || heightThreshold) {
      devToolsOpen = true;
    }
  }

  // Method 3: Debugger timing (only if other checks hint)
  function checkDebugger() {
    const start = performance.now();
    debugger;
    const end = performance.now();
    // If paused significantly, likely DevTools open
    if (end - start > 100) {
      devToolsOpen = true;
    }
  }

  function detect() {
    checkConsole();          // will trigger if console is used
    checkDimensions();       // quick check
    if (devToolsOpen) {
      // Confirm with debugger before warning
      checkDebugger();
      if (devToolsOpen) {
        return true;
      }
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

  // Check immediately after a short delay
  setTimeout(() => {
    if (detect()) {
      showWarning();
    }
  }, 500);

  // Then check periodically for a short time
  let count = 0;
  const interval = setInterval(() => {
    count++;
    if (detect()) {
      clearInterval(interval);
      showWarning();
    }
    if (count > 20) { // stop after 20 seconds
      clearInterval(interval);
    }
  }, 1000);
})();

// ── ADDITIONAL CODE PROTECTION (keyboard shortcuts, etc.) ──
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
const ADMIN_PW_HASH = btoa('********');
const TG_ADMIN      = 'https://t.me/master_picks_odds';
const TG_CHANNEL    = 'https://t.me/+11ot3EOvrYozNmI8';
const THREE_DAYS    = 3 * 24 * 60 * 60 * 1000;

// ── STATE ────────────────────────────────────────────
let adminLoggedIn  = false;
let activeVipTab   = 'gold';
let timerInt       = null;
let firebaseReady  = false;

// In-memory cache (synced from Firebase)
let cachedDevices  = {};
let cachedTips     = [];
let cachedHistory  = [];

// Firebase references (set after init)
let dbDevices, dbTips, dbHistory;

// ── DEVICE ID (with localStorage persistence) ─────────
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
    try {
      return JSON.parse(saved);
    } catch (e) {
      return null;
    }
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

    // Real-time listeners — update cache when data changes
    dbDevices.on('value', snap => {
      const fbDevices = snap.val() || {};
      cachedDevices = fbDevices;

      // Ensure current device exists in Firebase (if not, add it)
      if (!cachedDevices[DEVICE_ID]) {
        // Check localStorage for existing device data
        const localDev = loadLocalDevice();
        if (localDev && localDev.id === DEVICE_ID) {
          // Use localStorage data to preserve trial start
          cachedDevices[DEVICE_ID] = localDev;
          dbDevices.child(DEVICE_ID).set(localDev);
        } else {
          // Create new device
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
        // Device exists in Firebase – update localStorage backup
        saveLocalDevice(cachedDevices[DEVICE_ID]);
      }

      // Update UI
      updateSBPlan();
      updateHomeUI();
      updateTimers();
      renderFreeTips();
      renderVipTips();
    });

    dbTips.on('value', snap => {
      const val = snap.val();
      if (val && typeof val === 'object') {
        cachedTips = Object.values(val);
        cachedTips.sort((a, b) => b.id - a.id);
      } else {
        cachedTips = [];
      }
      renderFreeTips();
      renderVipTips();
      if (adminLoggedIn) renderAdminTips();
    });

    dbHistory.on('value', snap => {
      const val = snap.val();
      if (val && typeof val === 'object') {
        cachedHistory = Object.values(val);
        cachedHistory.sort((a, b) => b.id - a.id);
      } else {
        cachedHistory = [];
      }
      renderHistory();
      if (adminLoggedIn) renderHistAdmin();
    });

    firebaseReady = true;
    console.log('✅ Firebase connected');

    // Update Firebase status badge in admin
    const badge = document.getElementById('fbStatus');
    if (badge) { badge.className = 'fb-status fb-ok'; badge.textContent = '🟢 Firebase Connected'; }

  } catch (err) {
    console.warn('Firebase error:', err.message);
    firebaseReady = false;
    cachedTips    = [];
    cachedHistory = [];

    // Use localStorage device data as fallback
    const localDev = loadLocalDevice();
    if (localDev && localDev.id === DEVICE_ID) {
      cachedDevices = { [DEVICE_ID]: localDev };
    } else {
      // Create new device and save to localStorage
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

    // Still boot the app
    updateSBPlan();
    updateHomeUI();
    renderFreeTips();
    updateTimers();
  }
}

// ── DATA ACCESSORS (sync from cache) ─────────────────
function getTips() {
  return cachedTips || [];
}

function saveTips(tipsArr) {
  cachedTips = tipsArr;
  if (!firebaseReady) return;
  const obj = {};
  tipsArr.forEach(t => { obj[t.id] = t; });
  dbTips.set(obj).catch(e => console.error('saveTips error:', e));
}

function getHistory() {
  return cachedHistory || [];
}

function saveHistory(histArr) {
  cachedHistory = histArr;
  if (!firebaseReady) return;
  const obj = {};
  histArr.forEach(h => { obj[h.id] = h; });
  dbHistory.set(obj).catch(e => console.error('saveHistory error:', e));
}

function getReg()    { return cachedDevices; }
function saveReg(r)  {
  cachedDevices = r;
  if (!firebaseReady) return;
  dbDevices.set(r).catch(e => console.error('saveReg error:', e));
}

// ── DEVICE REGISTRY (now using localStorage backup) ───
function getMyDev() {
  // This is now handled in the Firebase listener and fallback
  return cachedDevices[DEVICE_ID] || { id: DEVICE_ID, plan: 'trial', trialStart: Date.now(), joined: new Date().toLocaleDateString() };
}

function getEffPlan() {
  const d = getMyDev();
  if (!d) return 'free';
  if (!['trial', 'free'].includes(d.plan)) return d.plan;
  if (d.plan === 'trial') {
    const elapsed = Date.now() - d.trialStart;
    return elapsed < THREE_DAYS ? 'vip' : 'expired';
  }
  return 'free';
}

const planLvl = { free: 0, gold: 1, silver: 2, diamond: 3, vip: 10 };

function canSee(tipPlan, userPlan) {
  if (userPlan === 'vip')     return true;
  if (userPlan === 'expired') return false;
  return (planLvl[userPlan] || 0) >= (planLvl[tipPlan] || 0);
}

// ── TIMER ─────────────────────────────────────────────
function updateTimers() {
  const d = getMyDev();
  if (!d || d.plan !== 'trial') {
    document.getElementById('trialStripActive').classList.add('hide');
    document.getElementById('trialStripExpired').classList.add('hide');
    ['heroTimer','sbTimer'].forEach(id => {
      const el = document.getElementById(id); if (el) el.textContent = '--:--:--';
    });
    const lbl = document.getElementById('sbTimerLabel');
    if (lbl) lbl.textContent = 'No Active Trial';
    updateSBPlan(); return;
  }
  const remaining = THREE_DAYS - (Date.now() - d.trialStart);
  if (remaining <= 0) {
    document.getElementById('trialStripActive').classList.add('hide');
    document.getElementById('trialStripExpired').classList.remove('hide');
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
  document.getElementById('trialStripActive').classList.remove('hide');
  document.getElementById('trialStripExpired').classList.add('hide');
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

// ── RENDER FREE TIPS ──────────────────────────────────
function renderFreeTips() {
  const tips = getTips().filter(t => t.plan === 'free');
  const el = document.getElementById('freeCnt');
  if (el) el.textContent = tips.length + ' picks';
  const list = document.getElementById('freeTipsList');
  if (list) list.innerHTML = tips.map(t => buildCard(t, 'free', true)).join('');
}

// ── RENDER VIP TIPS ───────────────────────────────────
function switchVipTab(plan, btn) {
  activeVipTab = plan;
  document.querySelectorAll('.ptab').forEach(t => t.className = 'ptab');
  const cls = { gold: 'ag', silver: 'as', diamond: 'ad' };
  if (btn) btn.className = 'ptab ' + (cls[plan] || '');
  renderVipTips();
}

function renderVipTips() {
  const p    = getEffPlan();
  const tips = getTips().filter(t => t.plan === activeVipTab);
  const el   = document.getElementById('vipTipsList');
  if (!el) return;
  const ok  = canSee(activeVipTab, p);
  const bt  = document.getElementById('vipBannerT');
  const bs  = document.getElementById('vipBannerS');

  if (p === 'vip') {
    if (bt) bt.textContent = '🎁 Full VIP Access — Trial Active';
    if (bs) bs.textContent = 'Enjoy all premium picks during your 3-day trial!';
  } else if (ok) {
    if (bt) bt.textContent = '✅ Plan Active — Full Access';
    if (bs) bs.textContent = 'All picks unlocked for your subscription';
  } else {
    if (bt) bt.textContent = `🔒 ${activeVipTab.charAt(0).toUpperCase() + activeVipTab.slice(1)} Plan Required`;
    if (bs) bs.textContent = 'Upgrade to access these picks';
  }

  ['gold','silver','diamond'].forEach(pl => {
    const c = document.getElementById('vcnt-' + pl);
    if (c) c.textContent = getTips().filter(t => t.plan === pl).length;
  });

  if (!ok) {
    el.innerHTML = `<div class="up-prompt"><h3>🔒 LOCKED</h3><p>You need a <strong>${activeVipTab.charAt(0).toUpperCase() + activeVipTab.slice(1)}</strong> subscription.</p><button class="up-btn" onclick="showView('plans')">💎 Upgrade Now</button></div>`;
    return;
  }
  if (!tips.length) {
    el.innerHTML = `<div style="padding:28px;text-align:center;color:var(--muted);">No tips posted yet ⚽</div>`;
    return;
  }
  el.innerHTML = tips.map(t => buildCard(t, activeVipTab, ok)).join('');
}

// ── BUILD CARD ────────────────────────────────────────
function buildCard(tip, plan, ok) {
  if (tip.time === 'ACCA' && ok) {
    return `<div class="acca-card"><div class="acca-glow"></div><div class="acca-title">💎 7-FOLD MEGA ACCUMULATOR</div><div class="acca-teams">Bidco · Ludogorets · Rodina · Kakamega · Real Madrid · Slobozia · Sandviken</div><div class="acca-lbl">Total Odds</div><div class="acca-odds">${tip.odds}</div><div style="margin-top:9px;display:flex;align-items:center;gap:7px;"><div style="background:rgba(108,63,214,.18);border:1px solid rgba(108,63,214,.38);color:var(--pu2);padding:3px 11px;border-radius:7px;font-size:10px;font-weight:800;">DIAMOND EXCLUSIVE</div>${rdot(tip.result)}</div></div>`;
  }
  if (!ok) {
    return `<div class="tip-card locked tc-${plan}"><div class="blur-c"><div class="tc-hd"><span class="tc-league">🌍 ???</span><span class="tc-time">??:??</span></div><div class="tc-match">???? vs ????</div><div class="tc-ft"><span class="tc-chip chip-${plan}">🔒 Locked</span><span class="tc-odds">?.??</span></div></div><div class="lock-ov"><span class="lock-ico">🔒</span><button class="lock-msg-btn" onclick="showView('plans')">Upgrade to Unlock</button></div></div>`;
  }
  return `<div class="tip-card tc-${plan}"><div class="tc-hd"><span class="tc-league">⚽ ${tip.country}</span><span class="tc-time">${tip.time}</span></div><div class="tc-match">${tip.match}</div><div class="tc-ft"><span class="tc-chip chip-${plan}">${tip.tip}</span><span class="tc-odds">${tip.odds}</span>${rdot(tip.result)}</div></div>`;
}

function rdot(r) {
  if (r === 'win')  return `<div class="tc-res rw">W</div>`;
  if (r === 'lose') return `<div class="tc-res rl">L</div>`;
  return `<div class="tc-res rp">?</div>`;
}

// ── HISTORY ───────────────────────────────────────────
function renderHistory() {
  const grid = document.getElementById('historyGrid');
  if (!grid) return;
  const h = getHistory();
  grid.innerHTML = h.map(x => {
    const scoreTag = x.score ? ` · <span style="background:rgba(0,230,118,.15);color:var(--gr);border:1px solid var(--gr);padding:1px 7px;border-radius:5px;font-size:10px;font-weight:800;">${x.score}</span>` : '';
    return `<div class="hc"><div class="hc-top"><span class="hc-date">📅 ${x.date}</span><span class="hc-win">✅ WIN</span></div><div class="hc-match">${x.match}</div><div class="hc-bot" style="flex-wrap:wrap;gap:5px;"><span class="hc-tip">${x.league} · ${x.tip}${scoreTag}</span><span class="hc-odds">${x.odds}</span></div></div>`;
  }).join('');
  renderHistAdmin();
}

// ── VIEW NAV ──────────────────────────────────────────
function showView(v) {
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  const target = document.getElementById('view-' + v);
  if (target) target.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  document.querySelectorAll('.snav a').forEach(a => a.classList.remove('act'));
  const map = { home: 0, free: 1, vip: 2, history: 3, plans: 4 };
  const links = document.querySelectorAll('.snav a');
  if (map[v] !== undefined && links[map[v]]) links[map[v]].classList.add('act');
  if (v === 'free')    renderFreeTips();
  if (v === 'vip')     renderVipTips();
  if (v === 'history') renderHistory();
  updateHomeUI();
}

function updateHomeUI() {
  const p = getEffPlan();
  const ico = document.getElementById('vipLock');
  if (ico) ico.textContent = (p === 'vip' || planLvl[p] >= 1) ? '🔓' : '🔒';
}

function updateSBPlan() {
  const p  = getEffPlan();
  const el = document.getElementById('sbPlanDisplay');
  const m  = {
    vip:     ['pb-trial',   '⏱ VIP Trial Active'],
    free:    ['pb-free',    '🆓 Free Plan'],
    gold:    ['pb-gold',    '🥇 Gold Plan'],
    silver:  ['pb-silver',  '🥈 Silver Plan'],
    diamond: ['pb-diamond', '💎 Diamond Plan'],
    expired: ['pb-expired', '⚠️ Trial Expired'],
  };
  const [cls, lbl] = m[p] || ['pb-free', 'Free Plan'];
  if (el) el.innerHTML = `<div class="plan-badge ${cls}">${lbl}</div>`;
}

// ── WELCOME ───────────────────────────────────────────
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

// ── TUTORIAL ──────────────────────────────────────────
function openTut()  { document.getElementById('tutModal').classList.add('show'); }
function closeTut() { document.getElementById('tutModal').classList.remove('show'); }

// ── NOTIFICATIONS ─────────────────────────────────────
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
  document.getElementById('notifTxt').textContent  = m;
  const n = document.getElementById('notif');
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 5000);
}
function closeNotif() { document.getElementById('notif').classList.remove('show'); }

// ── SIDEBAR ───────────────────────────────────────────
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

// ── THEME ─────────────────────────────────────────────
function setTheme(t) {
  if (!t) t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('theme', t);
  const b = document.getElementById('themeBtn');
  if (b) b.textContent = t === 'dark' ? '🌙' : '☀️';
}

// ── LANGUAGE ──────────────────────────────────────────
function setLang(l) {
  localStorage.setItem('lang', l);
  document.documentElement.setAttribute('dir', l === 'ar' ? 'rtl' : 'ltr');
  document.querySelectorAll('.lb').forEach(b =>
    b.classList.toggle('act', b.textContent.trim().toUpperCase().includes(l.toUpperCase()))
  );
  showNotif('🌐 Language updated', '🌐');
}

// ── COPY DEVICE ID ────────────────────────────────────
function copyDID() {
  navigator.clipboard.writeText(DEVICE_ID).then(() =>
    showNotif('✅ Device ID copied! Send to @master_picks_odds', '📋')
  );
}

// ── SCROLL UP ─────────────────────────────────────────
window.addEventListener('scroll', () =>
  document.getElementById('sup').classList.toggle('show', window.scrollY > 300)
);

// ── INIT ──────────────────────────────────────────────
(function init() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);

  const didEl = document.getElementById('didVal');
  if (didEl) didEl.textContent = DEVICE_ID;
  const footerDid = document.getElementById('footerDID');
  if (footerDid) footerDid.textContent = 'Device: ' + DEVICE_ID;

  // Start Firebase
  initFirebase();

  // Start timers
  timerInt = setInterval(updateTimers, 1000);

  // Hide loader
  setTimeout(() => {
    const overlay = document.getElementById('loadOverlay');
    if (overlay) overlay.classList.add('done');
    setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 600);
  }, 1200);

  // Welcome notification
  setTimeout(() => {
    showNotif("⚽ Today's picks are live! Tap Daily Free Tips to start.", '⚽');
    pushNotif("Today's predictions are live!");
  }, 10000);
})();
