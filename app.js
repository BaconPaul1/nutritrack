// ─── State ────────────────────────────────────────────────────────────────────
const State = {
  profile: null,
  diary: {},      // { 'YYYY-MM-DD': { breakfast:[], lunch:[], dinner:[], snacks:[] } }
  exercise: {},   // { 'YYYY-MM-DD': [] }
  water: {},      // { 'YYYY-MM-DD': number }
  weights: [],    // [{ date, kg }]
  currentPage: 'dashboard',
  currentDate: todayStr(),

  // Pending food add context
  pendingMeal: null,
  pendingFood: null,

  // Weight chart filters
  weightPeriod: localStorage.getItem('nt_weight_period') || 'ALL',
};

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function save() {
  localStorage.setItem('nt_profile', JSON.stringify(State.profile));
  localStorage.setItem('nt_diary', JSON.stringify(State.diary));
  localStorage.setItem('nt_exercise', JSON.stringify(State.exercise));
  localStorage.setItem('nt_water', JSON.stringify(State.water));
  localStorage.setItem('nt_weights', JSON.stringify(State.weights));
}

function load() {
  try { State.profile  = JSON.parse(localStorage.getItem('nt_profile')) || null; } catch(e){}
  try { State.diary    = JSON.parse(localStorage.getItem('nt_diary'))   || {}; } catch(e){}
  try { State.exercise = JSON.parse(localStorage.getItem('nt_exercise'))|| {}; } catch(e){}
  try { State.water    = JSON.parse(localStorage.getItem('nt_water'))   || {}; } catch(e){}
  try { State.weights  = JSON.parse(localStorage.getItem('nt_weights')) || []; } catch(e){}
}

// ─── Calculations ─────────────────────────────────────────────────────────────
function calcBMR(p) {
  const base = 10 * p.weight + 6.25 * p.height - 5 * p.age;
  return Math.round(p.sex === 'male' ? base + 5 : base - 161);
}
function calcTDEE(p) { return Math.round(calcBMR(p) * p.activity); }
function calcGoalCal(p) {
  const tdee = calcTDEE(p);
  const adj = parseInt(p.goal);
  const raw = tdee + adj;
  const floor = p.sex === 'male' ? 1500 : 1200;
  return Math.max(raw, floor);
}
function calcExerciseCal(ex, weightKg) {
  // MET × weight(kg) × hours
  return ex.met ? Math.round(ex.met * weightKg * (ex.duration / 60)) : 0;
}

// ─── Day Data Helpers ─────────────────────────────────────────────────────────
function getDayDiary(date) {
  if (!State.diary[date]) State.diary[date] = { breakfast:[], lunch:[], dinner:[], snacks:[] };
  return State.diary[date];
}
function getDayExercise(date) {
  if (!State.exercise[date]) State.exercise[date] = [];
  return State.exercise[date];
}
function getDayWater(date) { return State.water[date] || 0; }
function setDayWater(date, cups) { State.water[date] = cups; save(); }

function sumMacros(entries) {
  return entries.reduce((acc, e) => {
    acc.kcal    += e.kcal    || 0;
    acc.protein += e.protein || 0;
    acc.carbs   += e.carbs   || 0;
    acc.fat     += e.fat     || 0;
    acc.fiber   += e.fiber   || 0;
    acc.sodium  += e.sodium  || 0;
    return acc;
  }, { kcal:0, protein:0, carbs:0, fat:0, fiber:0, sodium:0 });
}

function getDayTotals(date) {
  const d = getDayDiary(date);
  const all = [...d.breakfast, ...d.lunch, ...d.dinner, ...d.snacks];
  const food = sumMacros(all);
  const exList = getDayExercise(date);
  const exKcal = exList.reduce((s, e) => s + (e.burned || 0), 0);
  return { ...food, exKcal, net: food.kcal - exKcal };
}

function getWeeklyData() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const t = getDayTotals(ds);
    days.push({ date: ds, label: d.toLocaleDateString('zh-TW',{weekday:'short'}), kcal: t.kcal });
  }
  return days;
}

// ─── Router ───────────────────────────────────────────────────────────────────
const pages = { dashboard, diary, exercise, nutrition, progress, myfoods };

function navigate(page) {
  State.currentPage = page;
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.page === page));
  document.querySelectorAll('.bottom-nav-item').forEach(l => l.classList.toggle('active', l.dataset.page === page));
  const mc = document.getElementById('main-content');
  mc.innerHTML = '';
  const el = pages[page]();
  mc.appendChild(el);
}

document.addEventListener('click', e => {
  const link = e.target.closest('[data-page]');
  if (link) { e.preventDefault(); navigate(link.dataset.page); }
});

// ─── Onboarding ───────────────────────────────────────────────────────────────
let currentStep = 1;

function nextStep(from) {
  if (from === 1) {
    const name   = document.getElementById('ob-name').value.trim();
    const age    = parseInt(document.getElementById('ob-age').value);
    const height = parseFloat(document.getElementById('ob-height').value);
    const weight = parseFloat(document.getElementById('ob-weight').value);
    if (!name || !age || !height || !weight) { alert('請填寫所有欄位'); return; }
    if (age < 10 || height < 100 || weight < 20) { alert('請輸入合理的數值'); return; }
  }
  document.getElementById(`step-${currentStep}`).classList.remove('active');
  currentStep++;
  document.getElementById(`step-${currentStep}`).classList.add('active');
}

function prevStep(from) {
  document.getElementById(`step-${from}`).classList.remove('active');
  currentStep--;
  document.getElementById(`step-${currentStep}`).classList.add('active');
}

function finishOnboarding() {
  const sex      = document.querySelector('input[name="ob-sex"]:checked').value;
  const activity = parseFloat(document.querySelector('input[name="ob-activity"]:checked').value);
  const goal     = document.querySelector('input[name="ob-goal"]:checked').value;
  State.profile = {
    name:     document.getElementById('ob-name').value.trim(),
    sex,
    age:      parseInt(document.getElementById('ob-age').value),
    height:   parseFloat(document.getElementById('ob-height').value),
    weight:   parseFloat(document.getElementById('ob-weight').value),
    activity, goal,
    createdAt: new Date().toISOString(),
  };
  // Save initial weight
  State.weights.push({ date: todayStr(), kg: State.profile.weight });
  save();
  showApp();
}

function showApp() {
  document.getElementById('onboarding-overlay').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  navigate('dashboard');
}

// ─── Init ─────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  load();
  if (State.profile) {
    showApp();
  } else {
    document.getElementById('onboarding-overlay').classList.remove('hidden');
  }
  document.getElementById('nav-myfoods').addEventListener('click', () => {
    // Ensuring it works if clicked directly in some cases
  });

  // Dedicated listener for settings
  document.getElementById('settings-btn-desktop')?.addEventListener('click', () => {
    openSettingsModal();
  });
});

// Explicitly make functions global for index.html onclick handlers
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.saveProfileSettings = saveProfileSettings;
window.dangerResetAll = dangerResetAll;
window.setWeightPeriod = setWeightPeriod;

// ─── SETTINGS MODAL ──────────────────────────────────────────────────────────
function openSettingsModal() {
  const p = State.profile;
  if (!p) {
    console.error("Profile not found");
    return;
  }
  
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };

  setVal('st-name', p.name);
  setVal('st-age', p.age);
  setVal('st-height', p.height);
  setVal('st-weight', p.weight);
  
  // Set radio buttons - more robust way using iteration
  const setRadio = (name, value) => {
    const radios = document.querySelectorAll(`input[name="${name}"]`);
    radios.forEach(r => {
      // Compare as strings to be safe
      if (r.value.toString() === (value || '').toString()) {
        r.checked = true;
      }
    });
  };

  setRadio('st-activity', p.activity);
  setRadio('st-goal', p.goal);

  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.classList.remove('hidden');
  } else {
    console.error("Settings modal element match not found");
    alert("無法開啟設定視窗，請重新整理頁面。");
  }
}

function closeSettingsModal() {
  document.getElementById('settings-modal').classList.add('hidden');
}

function saveProfileSettings() {
  const name = document.getElementById('st-name').value.trim();
  const age = parseInt(document.getElementById('st-age').value);
  const height = parseFloat(document.getElementById('st-height').value);
  const weight = parseFloat(document.getElementById('st-weight').value);
  const activityInput = document.querySelector('input[name="st-activity"]:checked');
  const goalInput = document.querySelector('input[name="st-goal"]:checked');

  if (!name || isNaN(age) || isNaN(height) || isNaN(weight) || !activityInput || !goalInput) {
    alert('請填寫所有必要欄位並選擇活動量與目標');
    return;
  }

  const activity = parseFloat(activityInput.value);
  const goal = goalInput.value; // Store as string ("-500", "0", "500") as calcGoalCal uses parseInt()

  State.profile = {
    ...State.profile,
    name, age, height, weight, activity, goal
  };

  // If weight changed, log it in history if not already there for today
  const lastW = State.weights[State.weights.length-1];
  if (!lastW || lastW.date !== todayStr() || lastW.kg !== weight) {
    State.weights.push({ date: todayStr(), kg: weight });
  }

  save();
  closeSettingsModal();
  navigate(State.currentPage || 'dashboard');
  alert('設定已更新！');
}

// Remove dangerResetAll as requested
function dangerResetAll() {
  // Function logic removed as per user request to remove the reset functionality
  console.log("Reset functionality has been disabled.");
}

// ─── DASHBOARD PAGE ───────────────────────────────────────────────────────────
function dashboard() {
  const p = State.profile;
  const goalCal = calcGoalCal(p);
  const bmr = calcBMR(p);
  const tdee = calcTDEE(p);
  const totals = getDayTotals(State.currentDate);
  const netCal = totals.net;
  const waterCups = getDayWater(State.currentDate);

  const macroGoal = { protein: Math.round(goalCal * 0.30 / 4), carbs: Math.round(goalCal * 0.45 / 4), fat: Math.round(goalCal * 0.25 / 9) };

  const el = document.createElement('div');
  el.className = 'page';
  el.innerHTML = `
    <div class="page-header" style="display:flex; justify-content:space-between; align-items:center; gap:12px;">
      <div class="page-title" style="min-width:0; flex:1;">
        <h1 style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">今日總覽 👋</h1>
        <p style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">哈囉 ${p.name}！今天是 ${new Date().toLocaleDateString('zh-TW',{year:'numeric',month:'long',day:'numeric'})}</p>
      </div>
      <button class="btn-settings-mobile" onclick="openSettingsModal()" title="個人設定" style="flex-shrink:0; min-width: 42px; min-height: 42px; font-size: 20px;">⚙️</button>
    </div>
    <script>console.log("NutriTrack UI v1.5 loaded");</script>

    <div class="stats-strip">
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(56,178,172,0.1)">🎯</div>
        <div><div class="stat-val" style="color:var(--accent-teal)">${goalCal}</div><div class="stat-lbl">每日目標熱量</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(237,137,54,0.1)">🍽️</div>
        <div><div class="stat-val" style="color:var(--accent-orange)">${totals.kcal}</div><div class="stat-lbl">已攝取熱量</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(72,187,120,0.1)">🏋️</div>
        <div><div class="stat-val" style="color:var(--accent-green)">${totals.exKcal}</div><div class="stat-lbl">運動消耗</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:rgba(128,90,213,0.1)">⚡</div>
        <div><div class="stat-val" style="color:var(--accent-purple)">${goalCal - netCal}</div><div class="stat-lbl">剩餘預算</div></div>
      </div>
    </div>

    <div class="dashboard-top">
      <div class="card calorie-ring-card">
        <div class="card-title">淨熱量</div>
        <div class="ring-container" id="ring-container">
          <svg class="ring-svg" viewBox="0 0 200 200">
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#38b2ac"/>
                <stop offset="100%" style="stop-color:#805ad5"/>
              </linearGradient>
            </defs>
            <circle class="ring-bg" cx="100" cy="100" r="90"/>
            <circle class="ring-fill" id="ring-fill" cx="100" cy="100" r="90"/>
          </svg>
          <div class="ring-center">
            <div class="ring-calories" id="ring-cal">${netCal}</div>
            <div class="ring-label">淨熱量</div>
            <div class="ring-budget">目標 ${goalCal} 大卡</div>
          </div>
        </div>
        <div class="calorie-stats">
          <div class="cal-stat food-stat"><div class="cal-stat-val">${totals.kcal}</div><div class="cal-stat-lbl">🍽️ 攝入</div></div>
          <div class="cal-stat exercise-stat"><div class="cal-stat-val">${totals.exKcal}</div><div class="cal-stat-lbl">🏃 運動</div></div>
          <div class="cal-stat net-stat"><div class="cal-stat-val">${netCal}</div><div class="cal-stat-lbl">⚡ 淨值</div></div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:16px">
        <div class="card">
          <div class="card-title">宏量營養素</div>
          <div class="macro-bars">
            ${macroBar('蛋白質','#f6ad55', totals.protein, macroGoal.protein)}
            ${macroBar('碳水化合物','#68d391', totals.carbs, macroGoal.carbs)}
            ${macroBar('脂肪','#76e4f7', totals.fat, macroGoal.fat)}
          </div>
        </div>
        <div class="card">
          <div class="card-title" style="display:flex;justify-content:space-between;align-items:center">
            <span>💧 飲水追蹤</span>
            <span style="font-size:13px;color:var(--text-primary);font-weight:700">${waterCups} / 8 杯</span>
          </div>
          <div class="water-cups" id="water-cups-grid">
            ${Array.from({length:8}, (_,i) => `<div class="water-cup ${i < waterCups ? 'filled' : ''}" data-cup="${i+1}" onclick="toggleWater(${i+1})">💧</div>`).join('')}
          </div>
          <div class="water-info" style="margin-top:10px">
            <span>已喝 <strong>${(waterCups * 250)}ml</strong></span>
            <span>剩餘 <strong>${Math.max(0,(8 - waterCups) * 250)}ml</strong></span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">代謝概覽</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:center">
          <div><div style="font-size:22px;font-weight:800;color:var(--accent-teal)">${bmr}</div><div style="font-size:11px;color:var(--text-secondary)">BMR (基礎代謝)</div></div>
          <div><div style="font-size:22px;font-weight:800;color:var(--accent-purple)">${tdee}</div><div style="font-size:11px;color:var(--text-secondary)">TDEE (每日消耗)</div></div>
          <div><div style="font-size:22px;font-weight:800;color:var(--accent-orange)">${goalCal}</div><div style="font-size:11px;color:var(--text-secondary)">熱量目標</div></div>
          <div><div style="font-size:22px;font-weight:800;color:${goalCal - netCal >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">${goalCal - netCal}</div><div style="font-size:11px;color:var(--text-secondary)">剩餘預算</div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">今日纖維與鈉攝取</div>
        <div style="display:flex;flex-direction:column;gap:12px">
          ${microBar('膳食纖維', totals.fiber, 25, 'g', 'var(--accent-green)')}
          ${microBar('鈉', totals.sodium, 2300, 'mg', 'var(--accent-orange)')}
        </div>
      </div>
    </div>
  `;

  // Animate ring
  setTimeout(() => {
    const pct = Math.min(netCal / goalCal, 1.15);
    const circ = 2 * Math.PI * 90;
    const offset = circ - pct * circ;
    const fill = el.querySelector('#ring-fill') || document.getElementById('ring-fill');
    if (fill) fill.style.strokeDashoffset = Math.max(0, offset);
  }, 100);

  return el;
}

function macroBar(name, color, current, goal) {
  const pct = Math.min((current / goal) * 100, 100).toFixed(0);
  return `<div class="macro-item">
    <div class="macro-row">
      <span class="macro-name"><span class="macro-dot" style="background:${color}"></span>${name}</span>
      <span class="macro-vals"><strong>${current.toFixed(1)}g</strong> / ${goal}g</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
  </div>`;
}

function microBar(name, val, max, unit, color) {
  const pct = Math.min((val / max) * 100, 100).toFixed(0);
  return `<div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px">
      <span style="font-size:13px;font-weight:600">${name}</span>
      <span style="font-size:12px;color:var(--text-secondary)">${val.toFixed(0)}${unit} / ${max}${unit}</span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
  </div>`;
}

function toggleWater(cup) {
  const date = State.currentDate;
  const current = getDayWater(date);
  setDayWater(date, current >= cup ? cup - 1 : cup);
  navigate('dashboard');
}

// ─── DIARY PAGE ───────────────────────────────────────────────────────────────
function diary() {
  const el = document.createElement('div');
  el.className = 'page';
  el.innerHTML = buildDiaryHTML(State.currentDate);
  return el;
}

function buildDiaryHTML(date) {
  const d = getDayDiary(date);
  const t = getDayTotals(date);
  const goalCal = calcGoalCal(State.profile);
  const meals = [
    { key:'breakfast', label:'早餐', icon:'🌅' },
    { key:'lunch',     label:'午餐', icon:'☀️' },
    { key:'dinner',    label:'晚餐', icon:'🌙' },
    { key:'snacks',    label:'點心', icon:'🍎' },
  ];
  return `
    <div class="page-header">
      <div class="page-title"><h1>飲食日記 📖</h1><p>記錄每一餐的攝取</p></div>
      <div class="diary-date-nav">
        <button class="btn-icon" onclick="changeDate(-1)">←</button>
        <span class="date-display">${new Date(date+'T12:00:00').toLocaleDateString('zh-TW',{month:'long',day:'numeric',weekday:'short'})}</span>
        <button class="btn-icon" onclick="changeDate(1)">→</button>
      </div>
    </div>
    <div class="diary-summary-bar">
      <div class="summary-item"><div class="summary-val" style="color:var(--accent-orange)">${t.kcal}</div><div class="summary-lbl">熱量</div></div>
      <div class="summary-item"><div class="summary-val" style="color:#f6ad55">${t.protein.toFixed(1)}g</div><div class="summary-lbl">蛋白質</div></div>
      <div class="summary-item"><div class="summary-val" style="color:#68d391">${t.carbs.toFixed(1)}g</div><div class="summary-lbl">碳水</div></div>
      <div class="summary-item"><div class="summary-val" style="color:#76e4f7">${t.fat.toFixed(1)}g</div><div class="summary-lbl">脂肪</div></div>
      <div class="summary-item"><div class="summary-val" style="color:${goalCal - t.net >= 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">${goalCal - t.net}</div><div class="summary-lbl">剩餘</div></div>
    </div>
    ${meals.map(m => buildMealSection(m, d[m.key], date)).join('')}
  `;
}

function buildMealSection(meal, entries, date) {
  const mCal = entries.reduce((s, e) => s + (e.kcal || 0), 0);
  return `<div class="card meal-section" style="padding:0;overflow:hidden;margin-bottom:16px">
    <div class="meal-header">
      <span class="meal-title">${meal.icon} ${meal.label}</span>
      <span class="meal-cals">${mCal} 大卡</span>
    </div>
    ${entries.length ? entries.map((e,i) => `
      <div class="food-entry">
        <div>
          <div class="food-entry-name">${e.name}</div>
          <div class="food-entry-sub">${e.grams}g · 蛋白 ${e.protein.toFixed(1)}g · 碳水 ${e.carbs.toFixed(1)}g · 脂肪 ${e.fat.toFixed(1)}g</div>
        </div>
        <div class="food-entry-right">
          <span class="food-entry-kcal">${e.kcal} 大卡</span>
          <button class="btn-icon" onclick="removeFoodEntry('${date}','${meal.key}',${i})" style="width:28px;height:28px;font-size:12px">✕</button>
        </div>
      </div>`).join('') : `<div class="empty-state" style="padding:20px"><div class="empty-icon">🍽️</div><p>尚未記錄 ${meal.label}</p></div>`}
    <div class="meal-footer">
      <button class="btn-sm" onclick="openFoodModal('${meal.key}')">+ 新增食物</button>
    </div>
  </div>`;
}

function changeDate(delta) {
  const d = new Date(State.currentDate + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  State.currentDate = d.toISOString().slice(0, 10);
  navigate('diary');
}

function removeFoodEntry(date, meal, idx) {
  State.diary[date][meal].splice(idx, 1);
  save();
  navigate('diary');
}

// ─── Food Modal ───────────────────────────────────────────────────────────────
function openFoodModal(meal) {
  State.pendingMeal = meal;
  document.getElementById('food-modal').classList.remove('hidden');
  document.getElementById('food-search-input').value = '';
  searchFoods('');
  setTimeout(() => document.getElementById('food-search-input').focus(), 100);
}
function closeFoodModal() { document.getElementById('food-modal').classList.add('hidden'); }

function searchFoods(query) {
  const q = query.toLowerCase().trim();
  // Combine built-in + user-added
  const userFoods = JSON.parse(localStorage.getItem('nt_custom_foods') || '[]');
  const allFoods = [...FOOD_DB, ...userFoods];
  const results  = q ? allFoods.filter(f => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)) : allFoods.slice(0, 24);
  const el = document.getElementById('food-search-results');
  if (!results.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>找不到「${query}」，可嘗試手動新增</p></div>`;
    return;
  }
  el.innerHTML = results.map(f => `
    <div class="food-result-item" onclick="openServingModal('${f.id || f.cid}')">
      <div>
        <div class="food-result-name">${f.name}<span class="food-category-badge">${f.category}</span></div>
        <div class="food-result-sub">每100g · 蛋白 ${f.per100g.protein}g · 碳水 ${f.per100g.carbs}g · 脂肪 ${f.per100g.fat}g</div>
      </div>
      <div class="food-result-kcal">${f.per100g.kcal} 大卡</div>
    </div>`).join('');
  // Store reference
  window._searchResults = results;
}

function openServingModal(foodId) {
  const userFoods = JSON.parse(localStorage.getItem('nt_custom_foods') || '[]');
  const allFoods  = [...FOOD_DB, ...userFoods];
  const food = allFoods.find(f => (f.id || f.cid) === foodId);
  if (!food) return;
  State.pendingFood = food;
  document.getElementById('serving-food-name').textContent = food.name;
  document.getElementById('serving-grams').value = 100;
  updateServingPreview();
  closeFoodModal();
  document.getElementById('serving-modal').classList.remove('hidden');
}

function updateServingPreview() {
  const food = State.pendingFood;
  if (!food) return;
  const g = parseFloat(document.getElementById('serving-grams').value) || 0;
  const r = g / 100;
  document.getElementById('serving-preview').innerHTML = `
    <div class="serving-preview-item"><div class="sv-val" style="color:var(--accent-orange)">${Math.round(food.per100g.kcal * r)}</div><div class="sv-lbl">大卡</div></div>
    <div class="serving-preview-item"><div class="sv-val" style="color:#f6ad55">${(food.per100g.protein * r).toFixed(1)}g</div><div class="sv-lbl">蛋白質</div></div>
    <div class="serving-preview-item"><div class="sv-val" style="color:#68d391">${(food.per100g.carbs * r).toFixed(1)}g</div><div class="sv-lbl">碳水</div></div>
    <div class="serving-preview-item"><div class="sv-val" style="color:#76e4f7">${(food.per100g.fat * r).toFixed(1)}g</div><div class="sv-lbl">脂肪</div></div>
  `;
}

function closeServingModal() { document.getElementById('serving-modal').classList.add('hidden'); }

function confirmServing() {
  const food = State.pendingFood;
  const meal = State.pendingMeal;
  if (!food || !meal) return;
  const g = parseFloat(document.getElementById('serving-grams').value) || 0;
  const r = g / 100;
  const entry = {
    name:    food.name,
    grams:   g,
    kcal:    Math.round(food.per100g.kcal    * r),
    protein: parseFloat((food.per100g.protein * r).toFixed(1)),
    carbs:   parseFloat((food.per100g.carbs   * r).toFixed(1)),
    fat:     parseFloat((food.per100g.fat     * r).toFixed(1)),
    fiber:   parseFloat(((food.per100g.fiber||0)*r).toFixed(1)),
    sodium:  parseFloat(((food.per100g.sodium||0)*r).toFixed(0)),
  };
  getDayDiary(State.currentDate)[meal].push(entry);
  save();
  closeServingModal();
  navigate('diary');
}

function addCustomFood() {
  const name = document.getElementById('cf-name').value.trim();
  const kcal = parseFloat(document.getElementById('cf-kcal').value) || 0;
  const protein = parseFloat(document.getElementById('cf-protein').value) || 0;
  const carbs = parseFloat(document.getElementById('cf-carbs').value) || 0;
  const fat = parseFloat(document.getElementById('cf-fat').value) || 0;
  const serving = parseFloat(document.getElementById('cf-serving').value) || 100;
  if (!name || !kcal) { alert('請填寫食物名稱與熱量'); return; }
  const scale = 100 / serving;
  const food = {
    cid: 'c' + Date.now(),
    name, category: '自訂',
    per100g: {
      kcal: Math.round(kcal * scale), protein: parseFloat((protein * scale).toFixed(1)),
      carbs: parseFloat((carbs * scale).toFixed(1)), fat: parseFloat((fat * scale).toFixed(1)),
      fiber: 0, sodium: 0,
    }
  };
  const custom = JSON.parse(localStorage.getItem('nt_custom_foods') || '[]');
  custom.push(food);
  localStorage.setItem('nt_custom_foods', JSON.stringify(custom));
  ['cf-name','cf-kcal','cf-protein','cf-carbs','cf-fat'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('cf-serving').value = '100';
  State.pendingFood = food;
  updateServingPreview();
  closeFoodModal();
  document.getElementById('serving-modal').classList.remove('hidden');
}

// ─── EXERCISE PAGE ────────────────────────────────────────────────────────────
function exercise() {
  const el = document.createElement('div');
  el.className = 'page';
  const logs = getDayExercise(State.currentDate);
  const totalBurned = logs.reduce((s,e) => s + (e.burned||0), 0);
  el.innerHTML = `
    <div class="page-header">
      <div class="page-title"><h1>運動記錄 🏋️</h1><p>追蹤有氧與肌力訓練</p></div>
    </div>
    <div class="exercise-tabs">
      <button class="tab-btn active" id="tab-cardio" onclick="switchExTab('cardio')">有氧運動</button>
      <button class="tab-btn" id="tab-strength" onclick="switchExTab('strength')">肌力訓練</button>
      <button class="tab-btn" id="tab-log" onclick="switchExTab('log')">今日記錄 ${logs.length ? `<span style="background:var(--accent-teal);color:#000;border-radius:10px;padding:1px 7px;font-size:11px;margin-left:4px">${logs.length}</span>` : ''}</button>
    </div>
    <div id="ex-panel">
      ${buildCardioPanel()}
    </div>
    ${logs.length ? `<div class="card" style="margin-top:16px">
      <div class="card-title" style="display:flex;justify-content:space-between">
        <span>今日運動總計</span><span style="color:var(--accent-green);font-weight:700">${totalBurned} 大卡消耗</span>
      </div>
      ${logs.map((l,i) => `<div class="exercise-log-entry">
        <div>
          <div style="font-size:14px;font-weight:600">${l.icon||'🏃'} ${l.name}</div>
          <div style="font-size:12px;color:var(--text-secondary)">${l.type === 'cardio' ? `${l.duration} 分鐘` : `${l.sets}組 × ${l.reps}次 × ${l.weight}kg`}</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          ${l.burned ? `<span style="font-size:14px;font-weight:700;color:var(--accent-green)">-${l.burned} 大卡</span>` : `<span class="badge badge-teal">肌力</span>`}
          <button class="btn-icon" onclick="removeExercise(${i})" style="width:28px;height:28px;font-size:12px">✕</button>
        </div>
      </div>`).join('')}
    </div>` : ''}
  `;
  return el;
}

function buildCardioPanel() {
  const cardio = EXERCISE_DB.filter(e => e.type === 'cardio');
  return `<div class="exercise-grid">
    ${cardio.map(e => `<div class="exercise-card" onclick="openCardioForm('${e.id}')">
      <div style="font-size:24px;margin-bottom:6px">${e.icon}</div>
      <div class="exercise-name">${e.name}</div>
      <div class="exercise-meta">MET ${e.met} · 點擊開始記錄</div>
    </div>`).join('')}
  </div>`;
}

function buildStrengthPanel() {
  const strength = EXERCISE_DB.filter(e => e.type === 'strength');
  return `<div style="margin-bottom:16px">
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px">肌力訓練不直接計算當下熱量，其效益來自靜息代謝提升與後燃效應。</p>
    <div class="exercise-grid">
      ${strength.map(e => `<div class="exercise-card" onclick="openStrengthForm('${e.id}')">
        <div style="font-size:24px;margin-bottom:6px">${e.icon}</div>
        <div class="exercise-name">${e.name}</div>
        <div class="exercise-meta">點擊新增組數</div>
      </div>`).join('')}
    </div>
  </div>`;
}

function buildLogPanel() {
  const logs = getDayExercise(State.currentDate);
  if (!logs.length) return `<div class="empty-state"><div class="empty-icon">🏋️</div><p>今天還沒有運動記錄</p></div>`;
  const total = logs.reduce((s,e) => s + (e.burned||0), 0);
  return `<div class="card" style="padding:0;overflow:hidden">
    ${logs.map((l,i) => `<div class="exercise-log-entry">
      <div><div style="font-size:14px;font-weight:600">${l.icon||'🏃'} ${l.name}</div>
      <div style="font-size:12px;color:var(--text-secondary)">${l.type==='cardio'?`${l.duration}分鐘`:`${l.sets}組 × ${l.reps}次 × ${l.weight}kg`}</div></div>
      <div style="display:flex;gap:12px;align-items:center">
        ${l.burned?`<span style="font-size:14px;font-weight:700;color:var(--accent-green)">-${l.burned} 大卡</span>`:`<span class="badge badge-teal">肌力</span>`}
        <button class="btn-icon" onclick="removeExercise(${i})" style="width:28px;height:28px;font-size:12px">✕</button>
      </div>
    </div>`).join('')}
    <div style="padding:14px 18px;border-top:1px solid var(--border);display:flex;justify-content:space-between">
      <span style="font-size:13px;font-weight:600">總計</span>
      <span style="font-size:14px;font-weight:700;color:var(--accent-green)">${total} 大卡</span>
    </div>
  </div>`;
}

function switchExTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  const panel = document.getElementById('ex-panel');
  if (tab === 'cardio') panel.innerHTML = buildCardioPanel();
  else if (tab === 'strength') panel.innerHTML = buildStrengthPanel();
  else panel.innerHTML = buildLogPanel();
}

function openCardioForm(id) {
  const ex = EXERCISE_DB.find(e => e.id === id);
  const panel = document.getElementById('ex-panel');
  panel.innerHTML = `
    <div class="card">
      <div class="card-title">${ex.icon} ${ex.name}：記錄運動時間</div>
      <div class="form-group" style="margin-bottom:16px">
        <label>運動時長（分鐘）</label>
        <input type="number" id="ex-dur" value="30" min="1" max="600" style="background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-family:inherit;font-size:15px;padding:10px 14px;outline:none;width:100%" />
      </div>
      <div id="ex-cal-preview" style="background:rgba(72,187,120,0.1);border:1px solid rgba(72,187,120,0.2);border-radius:var(--radius-sm);padding:12px 16px;margin-bottom:16px;font-size:14px;color:var(--accent-green);font-weight:600">
        預計消耗：${Math.round(ex.met * State.profile.weight * 0.5)} 大卡
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn-primary" onclick="logCardio('${id}')">記錄運動</button>
        <button class="btn-secondary" onclick="switchExTab('cardio')">取消</button>
      </div>
    </div>
  `;
  document.getElementById('ex-dur').addEventListener('input', function() {
    const kcal = Math.round(ex.met * State.profile.weight * (this.value / 60));
    document.getElementById('ex-cal-preview').textContent = `預計消耗：${kcal} 大卡`;
  });
}

function logCardio(id) {
  const ex = EXERCISE_DB.find(e => e.id === id);
  const dur = parseInt(document.getElementById('ex-dur').value) || 30;
  const burned = calcExerciseCal(ex, State.profile.weight);
  const log = { ...ex, duration: dur, burned: Math.round(ex.met * State.profile.weight * (dur / 60)) };
  getDayExercise(State.currentDate).push(log);
  save();
  navigate('exercise');
}

function openStrengthForm(id) {
  const ex = EXERCISE_DB.find(e => e.id === id);
  const panel = document.getElementById('ex-panel');
  panel.innerHTML = `
    <div class="card">
      <div class="card-title">${ex.icon} ${ex.name}：記錄組數</div>
      <div class="form-grid" style="margin-bottom:16px">
        <div class="form-group"><label>組數</label><input type="number" id="ex-sets" value="3" min="1" max="20" style="background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-family:inherit;font-size:15px;padding:10px 14px;outline:none" /></div>
        <div class="form-group"><label>次數</label><input type="number" id="ex-reps" value="10" min="1" max="100" style="background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-family:inherit;font-size:15px;padding:10px 14px;outline:none" /></div>
        <div class="form-group full"><label>重量 (kg)，徒手輸入 0</label><input type="number" id="ex-weight" value="0" min="0" step="0.5" style="background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-family:inherit;font-size:15px;padding:10px 14px;outline:none" /></div>
      </div>
      <div style="display:flex;gap:10px">
        <button class="btn-primary" onclick="logStrength('${id}')">記錄訓練</button>
        <button class="btn-secondary" onclick="switchExTab('strength')">取消</button>
      </div>
    </div>
  `;
}

function logStrength(id) {
  const ex   = EXERCISE_DB.find(e => e.id === id);
  const sets  = parseInt(document.getElementById('ex-sets').value) || 3;
  const reps  = parseInt(document.getElementById('ex-reps').value) || 10;
  const wt    = parseFloat(document.getElementById('ex-weight').value) || 0;
  getDayExercise(State.currentDate).push({ ...ex, sets, reps, weight: wt, burned: 0 });
  save();
  navigate('exercise');
}

function removeExercise(idx) {
  getDayExercise(State.currentDate).splice(idx, 1);
  save();
  navigate('exercise');
}

// ─── NUTRITION PAGE ───────────────────────────────────────────────────────────
function nutrition() {
  const el = document.createElement('div');
  el.className = 'page';
  const t = getDayTotals(State.currentDate);
  const total = t.kcal || 1;
  const pPct  = Math.round((t.protein * 4 / total) * 100) || 0;
  const cPct  = Math.round((t.carbs   * 4 / total) * 100) || 0;
  const fPct  = Math.round((t.fat     * 9 / total) * 100) || 0;
  const weekly = getWeeklyData();

  el.innerHTML = `
    <div class="page-header">
      <div class="page-title"><h1>營養分析 📊</h1><p>今日與本週營養洞察</p></div>
    </div>
    <div class="grid-2" style="margin-bottom:20px">
      <div class="card">
        <div class="card-title">宏量營養素分布</div>
        <div style="display:flex;align-items:center;gap:24px">
          <canvas id="macro-pie" width="160" height="160"></canvas>
          <div style="display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:center;gap:10px"><div style="width:12px;height:12px;border-radius:50%;background:#f6ad55"></div><div><div style="font-size:13px;font-weight:600">蛋白質 ${pPct}%</div><div style="font-size:12px;color:var(--text-secondary)">${t.protein.toFixed(1)}g</div></div></div>
            <div style="display:flex;align-items:center;gap:10px"><div style="width:12px;height:12px;border-radius:50%;background:#68d391"></div><div><div style="font-size:13px;font-weight:600">碳水 ${cPct}%</div><div style="font-size:12px;color:var(--text-secondary)">${t.carbs.toFixed(1)}g</div></div></div>
            <div style="display:flex;align-items:center;gap:10px"><div style="width:12px;height:12px;border-radius:50%;background:#76e4f7"></div><div><div style="font-size:13px;font-weight:600">脂肪 ${fPct}%</div><div style="font-size:12px;color:var(--text-secondary)">${t.fat.toFixed(1)}g</div></div></div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">微量營養素 (今日)</div>
        <div class="micro-grid">
          <div class="micro-item"><div class="micro-name">膳食纖維</div><div class="micro-val" style="color:var(--accent-green)">${t.fiber.toFixed(1)}g <span style="font-size:11px;color:var(--text-muted)">/ 25g</span></div><div class="micro-bar">${progressBarHTML(t.fiber, 25, 'var(--accent-green)')}</div></div>
          <div class="micro-item"><div class="micro-name">鈉</div><div class="micro-val" style="color:var(--accent-orange)">${t.sodium.toFixed(0)}mg <span style="font-size:11px;color:var(--text-muted)">/ 2300mg</span></div><div class="micro-bar">${progressBarHTML(t.sodium, 2300, 'var(--accent-orange)')}</div></div>
          <div class="micro-item"><div class="micro-name">蛋白質達成率</div><div class="micro-val" style="color:#f6ad55">${pPct}%</div><div class="micro-bar">${progressBarHTML(pPct, 100, '#f6ad55')}</div></div>
          <div class="micro-item"><div class="micro-name">今日總熱量</div><div class="micro-val" style="color:var(--accent-teal)">${t.kcal} <span style="font-size:11px;color:var(--text-muted)">大卡</span></div><div class="micro-bar">${progressBarHTML(t.kcal, calcGoalCal(State.profile), 'var(--accent-teal)')}</div></div>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">本週熱量趨勢（7天）</div>
      <canvas id="weekly-chart" width="800" height="200"></canvas>
    </div>
  `;

  setTimeout(() => {
    drawPie(pPct, cPct, fPct);
    drawWeeklyChart(weekly);
  }, 100);

  return el;
}

function progressBarHTML(val, max, color) {
  const pct = Math.min((val/max)*100, 100).toFixed(0);
  return `<div class="progress-bar" style="height:4px"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>`;
}

function drawPie(p, c, f) {
  const canvas = document.getElementById('macro-pie');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const total = p + c + f || 1;
  const data = [
    { pct: p/total, color: '#f6ad55' },
    { pct: c/total, color: '#68d391' },
    { pct: f/total, color: '#76e4f7' },
  ];
  const cx = 80, cy = 80, r = 65;
  ctx.clearRect(0, 0, 160, 160);
  let angle = -Math.PI / 2;
  data.forEach(d => {
    const sweep = d.pct * 2 * Math.PI;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle, angle + sweep);
    ctx.closePath(); ctx.fillStyle = d.color; ctx.fill();
    angle += sweep;
  });
  // Center hole
  ctx.beginPath(); ctx.arc(cx, cy, 36, 0, 2*Math.PI);
  ctx.fillStyle = '#0d0f14'; ctx.fill();
  if (p === 0 && c === 0 && f === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2*Math.PI); ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, 36, 0, 2*Math.PI);
    ctx.fillStyle = '#0d0f14'; ctx.fill();
  }
}

function drawWeeklyChart(data) {
  const canvas = document.getElementById('weekly-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 800;
  canvas.width = W; canvas.height = 200;
  const maxK = Math.max(...data.map(d => d.kcal), 100);
  const goalCal = calcGoalCal(State.profile);
  const pad = { t:20, r:20, b:40, l:50 };
  const fw = W - pad.l - pad.r;
  const fh = 200 - pad.t - pad.b;
  const bw = fw / data.length;

  // Goal line
  const goalY = pad.t + fh - (goalCal / (maxK * 1.1)) * fh;
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(56,178,172,0.4)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pad.l, goalY); ctx.lineTo(W - pad.r, goalY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(56,178,172,0.7)'; ctx.font = '11px Inter';
  ctx.fillText('目標 ' + goalCal, pad.l + 4, goalY - 5);

  data.forEach((d, i) => {
    const barH = (d.kcal / (maxK * 1.1)) * fh;
    const x = pad.l + i * bw + bw * 0.15;
    const bwInner = bw * 0.7;
    const y = pad.t + fh - barH;
    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, 'rgba(56,178,172,0.8)');
    grad.addColorStop(1, 'rgba(128,90,213,0.5)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(x, y, bwInner, barH, 4) : ctx.rect(x, y, bwInner, barH);
    ctx.fill();
    // Label
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '10px Inter'; ctx.textAlign = 'center';
    ctx.fillText(d.label, x + bwInner/2, 200 - pad.b + 14);
    if (d.kcal > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.font = '10px Inter';
      ctx.fillText(d.kcal, x + bwInner/2, y - 4);
    }
  });
}

// ─── PROGRESS PAGE ────────────────────────────────────────────────────────────
function progress() {
  const el = document.createElement('div');
  el.className = 'page';
  const p = State.profile;
  const bmr = calcBMR(p);
  const tdee = calcTDEE(p);
  const goalCal = calcGoalCal(p);
  
  // Filtering logic
  let weights = [...State.weights].sort((a,b) => a.date.localeCompare(b.date));
  const now = new Date();
  if (State.weightPeriod !== 'ALL') {
    const days = { '1W':7, '1M':30, '3M':90, '6M':180, '1Y':365 }[State.weightPeriod];
    const cutoff = new Date();
    cutoff.setDate(now.getDate() - days);
    weights = weights.filter(w => new Date(w.date) >= cutoff);
  }

  const periods = [
    {id:'1W', lbl:'1週'}, {id:'1M', lbl:'1個月'}, {id:'3M', lbl:'3個月'},
    {id:'6M', lbl:'6個月'}, {id:'1Y', lbl:'1年'}, {id:'ALL', lbl:'全部'}
  ];

  el.innerHTML = `
    <div class="page-header">
      <div class="page-title"><h1>體重進度 ⚖️</h1><p>記錄體重，自動重算代謝</p></div>
    </div>
    <div class="bmr-display">
      <div><div class="bmr-val">${bmr}</div><div class="bmr-lbl">BMR 基礎代謝</div></div>
      <div><div class="bmr-val">${tdee}</div><div class="bmr-lbl">TDEE 每日消耗</div></div>
      <div><div class="bmr-val">${goalCal}</div><div class="bmr-lbl">預算：${p.goal > 0 ? '+' : ''}${p.goal}</div></div>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="card-title">新增體重記錄</div>
      <div class="weight-input-form">
        <div class="form-group" style="flex:1">
          <label>日期</label>
          <input type="date" id="w-date" value="${todayStr()}" style="width:100%" />
        </div>
        <div class="form-group" style="flex:1">
          <label>體重 (kg)</label>
          <input type="number" id="w-kg" placeholder="${p.weight}" step="0.1" min="20" max="300"
            style="background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-family:inherit;font-size:15px;padding:10px 14px;outline:none;width:100%" />
        </div>
        <button class="btn-primary" style="width:auto;padding:10px 24px;align-self:flex-end" onclick="logWeight()">記錄</button>
      </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden;margin-bottom:20px">
      <div style="padding:14px 18px;border-bottom:1px solid var(--border)"><span class="card-title" style="margin:0">體重記錄歷史</span></div>
      <div style="max-height: 300px; overflow-y: auto;">
        ${State.weights.length ? [...State.weights].sort((a,b)=>b.date.localeCompare(a.date)).map((w,i,arr) => {
          const prev = arr[i+1];
          const diff = prev ? (w.kg - prev.kg).toFixed(1) : null;
          return `<div class="weight-entry">
            <span class="weight-date">${new Date(w.date+'T12:00:00').toLocaleDateString('zh-TW',{month:'short',day:'numeric'})}</span>
            <div>
              <span class="weight-val">${w.kg} kg</span>
              ${diff !== null ? `<span class="weight-diff" style="color:${diff > 0 ? 'var(--accent-red)' : diff < 0 ? 'var(--accent-green)' : 'var(--text-muted)'}">
                ${diff > 0 ? '+' : ''}${diff}
              </span>` : ''}
            </div>
          </div>`;
        }).join('') : `<div class="empty-state"><div class="empty-icon">⚖️</div><p>尚無體重記錄</p></div>`}
      </div>
    </div>

    <div class="card">
      <div class="card-title">體重趨勢分析</div>
      <div class="period-selector">
        ${periods.map(per => `<button class="period-btn ${State.weightPeriod === per.id ? 'active' : ''}" onclick="setWeightPeriod('${per.id}')">${per.lbl}</button>`).join('')}
      </div>
      ${weights.length > 1 ? `<canvas id="weight-chart" height="220"></canvas>` : `
        <div class="empty-state" style="padding:40px 0">
          <div style="font-size:32px;margin-bottom:10px">📉</div>
          <p style="color:var(--text-muted)">此區間內記錄不足，無法繪製趨勢圖</p>
        </div>
      `}
    </div>
  `;

  setTimeout(() => { if (weights.length > 1) drawWeightChart(weights); }, 100);
  return el;
}

function setWeightPeriod(p) {
  State.weightPeriod = p;
  localStorage.setItem('nt_weight_period', p);
  navigate('progress');
}

function logWeight() {
  const date = document.getElementById('w-date').value;
  const kg   = parseFloat(document.getElementById('w-kg').value);
  if (!date || !kg || kg < 20 || kg > 300) { alert('請輸入有效的體重值'); return; }
  // Remove existing entry for same date
  State.weights = State.weights.filter(w => w.date !== date);
  State.weights.push({ date, kg });
  // Update profile weight to latest
  const latest = [...State.weights].sort((a,b) => b.date.localeCompare(a.date))[0];
  if (latest) State.profile.weight = latest.kg;
  save();
  navigate('progress');
}

function drawWeightChart(weights) {
  const canvas = document.getElementById('weight-chart');
  if (!canvas) return;
  const W = canvas.offsetWidth || 800;
  const H = canvas.getAttribute('height') || 220;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const sorted = [...weights].sort((a,b) => a.date.localeCompare(b.date));
  const vals = sorted.map(w => w.kg);
  
  // Dynamic scale
  const minV = Math.min(...vals) - 0.5;
  const maxV = Math.max(...vals) + 0.5;
  const pad = { t:30, r:30, b:40, l:50 };
  const fw = W - pad.l - pad.r;
  const fh = H - pad.t - pad.b;
  
  const pts = sorted.map((w, i) => ({
    x: pad.l + (i / (sorted.length - 1 || 1)) * fw,
    y: pad.t + fh - ((w.kg - minV) / (maxV - minV)) * fh,
  }));

  // Background Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for(let i=0; i<=4; i++) {
    const y = pad.t + (fh/4)*i;
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
    // Y-axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.font = '10px Inter'; ctx.textAlign = 'right';
    const val = maxV - ((maxV-minV)/4)*i;
    ctx.fillText(val.toFixed(1), pad.l - 10, y + 3);
  }

  // Gradient Area
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + fh);
  grad.addColorStop(0, 'rgba(56,178,172,0.25)');
  grad.addColorStop(1, 'rgba(56,178,172,0)');
  ctx.beginPath();
  pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
  ctx.lineTo(pts[pts.length-1].x, pad.t + fh);
  ctx.lineTo(pts[0].x, pad.t + fh);
  ctx.closePath(); ctx.fillStyle = grad; ctx.fill();

  // Smoothing Line
  ctx.beginPath(); ctx.strokeStyle = '#38b2ac'; ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  pts.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
  ctx.stroke();

  // Dots and Labels (Conditional based on density)
  const showDetail = sorted.length <= 15;
  const labelStep = Math.ceil(sorted.length / 8);

  pts.forEach((pt, i) => {
    // Labels on X-axis (Dates)
    if (i % labelStep === 0 || i === sorted.length - 1) {
      const d = new Date(sorted[i].date + 'T12:00:00');
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.textAlign = 'center';
      ctx.font = '10px Inter';
      ctx.fillText(`${d.getMonth()+1}/${d.getDate()}`, pt.x, H - 15);
    }

    // Dots and weight values
    if (showDetail) {
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 4, 0, 2*Math.PI);
      ctx.fillStyle = '#141720'; ctx.fill(); 
      ctx.strokeStyle = '#38b2ac'; ctx.lineWidth = 2; ctx.stroke();
      
      ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = 'bold 11px Inter';
      ctx.fillText(sorted[i].kg, pt.x, pt.y - 12);
    }
  });
}

// ─── BARCODE SCANNER ──────────────────────────────────────────────────────────
let _html5QrScanner = null;
let _scannedBarcode = null;
let _barcodeFood    = null;

function openBarcodeScanner() {
  closeFoodModal();
  _scannedBarcode = null;
  _barcodeFood    = null;

  const modal = document.getElementById('barcode-modal');
  modal.classList.remove('hidden');
  document.getElementById('barcode-result').classList.add('hidden');
  document.getElementById('barcode-not-found').classList.add('hidden');
  document.getElementById('barcode-status').textContent = '等待相機啟動…';

  setTimeout(() => {
    if (!window.Html5Qrcode) {
      document.getElementById('barcode-status').textContent = '掃描器未載入，請確認網路連線後重新整理。';
      return;
    }
    _html5QrScanner = new Html5Qrcode('barcode-reader', { verbose: false });
    _html5QrScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 260, height: 160 } },
      onBarcodeDetected,
      () => {}
    ).then(() => {
      document.getElementById('barcode-status').textContent = '📷 請將鏡頭對準食品包裝上的條碼…';
    }).catch(err => {
      document.getElementById('barcode-status').textContent =
        '無法存取相機：' + (err.message || err) + '。請確認已允許相機權限。';
    });
  }, 300);
}

function closeBarcodeScanner() {
  document.getElementById('barcode-modal').classList.add('hidden');
  if (_html5QrScanner) {
    _html5QrScanner.stop().catch(() => {});
    _html5QrScanner = null;
  }
}

async function onBarcodeDetected(decodedText) {
  if (_scannedBarcode === decodedText) return;
  _scannedBarcode = decodedText;

  if (_html5QrScanner) {
    await _html5QrScanner.stop().catch(() => {});
    _html5QrScanner = null;
  }

  const statusEl   = document.getElementById('barcode-status');
  const resultEl   = document.getElementById('barcode-result');
  const notFoundEl = document.getElementById('barcode-not-found');

  statusEl.textContent = `條碼：${decodedText}　正在查詢 Open Food Facts 資料庫…`;
  resultEl.classList.add('hidden');
  notFoundEl.classList.add('hidden');

  try {
    const url  = `https://world.openfoodfacts.org/api/v0/product/${decodedText}.json`;
    const res  = await fetch(url);
    const data = await res.json();

    if (data.status !== 1 || !data.product) {
      statusEl.textContent = '查無此條碼的食品資料';
      notFoundEl.classList.remove('hidden');
      return;
    }

    const p = data.product;
    const n = p.nutriments || {};
    const servingG = parseFloat(p.serving_quantity) || 100;
    const scale    = 100 / servingG;

    const get100g = (key100, keyServ, fallback = 0) => {
      if (n[key100]  != null) return parseFloat(n[key100])  || fallback;
      if (n[keyServ] != null) return parseFloat(n[keyServ]) * scale || fallback;
      return fallback;
    };

    const food = {
      cid: 'bc-' + decodedText,
      name: p.product_name || p.product_name_en || p.generic_name || `條碼 ${decodedText}`,
      category: (p.categories_tags?.[0] || '').replace(/^en:/, '') || '掃描食品',
      per100g: {
        kcal:    Math.round(get100g('energy-kcal_100g', 'energy-kcal_serving')),
        protein: parseFloat(get100g('proteins_100g',       'proteins_serving').toFixed(1)),
        carbs:   parseFloat(get100g('carbohydrates_100g',  'carbohydrates_serving').toFixed(1)),
        fat:     parseFloat(get100g('fat_100g',            'fat_serving').toFixed(1)),
        fiber:   parseFloat(get100g('fiber_100g',          'fiber_serving').toFixed(1)),
        sodium:  parseFloat((get100g('sodium_100g', 'sodium_serving') * 1000).toFixed(0)),
      }
    };

    _barcodeFood = food;
    const brand = p.brands ? ` (${p.brands.split(',')[0].trim()})` : '';
    document.getElementById('barcode-food-name').textContent = food.name + brand;
    document.getElementById('barcode-food-macro').textContent =
      `每100g · 熱量 ${food.per100g.kcal}大卡 · 蛋白質 ${food.per100g.protein}g · 碳水 ${food.per100g.carbs}g · 脂肪 ${food.per100g.fat}g`;

    statusEl.textContent = '✅ 找到食品資訊！';
    resultEl.classList.remove('hidden');

  } catch (err) {
    statusEl.textContent = '查詢失敗：' + (err.message || '網路錯誤，請確認連線後重試');
    notFoundEl.classList.remove('hidden');
  }
}

function addBarcodeFood() {
  if (!_barcodeFood || !State.pendingMeal) return;
  closeBarcodeScanner();
  State.pendingFood = _barcodeFood;
  document.getElementById('serving-food-name').textContent = _barcodeFood.name;
  document.getElementById('serving-grams').value = 100;
  updateServingPreview();
  document.getElementById('serving-modal').classList.remove('hidden');
}

// ─── MY FOODS LIBRARY PAGE ────────────────────────────────────────────────────
function getCustomFoods() {
  try { return JSON.parse(localStorage.getItem('nt_custom_foods') || '[]'); } catch(e) { return []; }
}
function saveCustomFoods(list) {
  localStorage.setItem('nt_custom_foods', JSON.stringify(list));
}

function myfoods() {
  const el = document.createElement('div');
  el.className = 'page';
  el.innerHTML = buildMyFoodsHTML('');
  return el;
}

function buildMyFoodsHTML(filter) {
  const foods = getCustomFoods();
  const q = (filter || '').toLowerCase().trim();
  const shown = q ? foods.filter(f => f.name.toLowerCase().includes(q)) : foods;

  return `
    <div class="page-header">
      <div class="page-title"><h1>我的食物庫 🗂️</h1><p>自訂食物將出現在搜尋食物中，可直接復用</p></div>
    </div>

    <div class="card" style="margin-bottom:20px">
      <div class="card-title" id="mf-form-title">➕ 新增自訂食物</div>
      <div class="form-grid">
        <div class="form-group full">
          <label>食物名稱</label>
          <input type="text" id="mf-name" placeholder="例：營養棒、自製雞胸安格斯…" data-edit-idx="-1" />
        </div>
        <div class="form-group">
          <label>熱量（大卡 / 100g）</label>
          <input type="number" id="mf-kcal" placeholder="0" min="0" />
        </div>
        <div class="form-group">
          <label>蛋白質（g / 100g）</label>
          <input type="number" id="mf-protein" placeholder="0" min="0" step="0.1" />
        </div>
        <div class="form-group">
          <label>碳水化合物（g / 100g）</label>
          <input type="number" id="mf-carbs" placeholder="0" min="0" step="0.1" />
        </div>
        <div class="form-group">
          <label>脂肪（g / 100g）</label>
          <input type="number" id="mf-fat" placeholder="0" min="0" step="0.1" />
        </div>
        <div class="form-group">
          <label>膳食纖維（g / 100g）<span style="color:var(--text-muted);font-weight:400"> 可略</span></label>
          <input type="number" id="mf-fiber" placeholder="0" min="0" step="0.1" />
        </div>
        <div class="form-group">
          <label>鈉（mg / 100g）<span style="color:var(--text-muted);font-weight:400"> 可略</span></label>
          <input type="number" id="mf-sodium" placeholder="0" min="0" />
        </div>
        <div class="form-group">
          <label>分類標籤<span style="color:var(--text-muted);font-weight:400"> 可略</span></label>
          <input type="text" id="mf-category" placeholder="自訂" />
        </div>
      </div>
      <div style="display:flex;gap:10px;margin-top:4px">
        <button class="btn-primary" style="flex:1;width:auto" onclick="saveMfFood()">✔ 儲存食物</button>
        <button class="btn-secondary" style="flex-shrink:0" onclick="clearMfForm()">✕ 清除</button>
      </div>
      <div id="mf-feedback" style="margin-top:10px;font-size:13px;color:var(--accent-green);display:none"></div>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;row-gap:8px">
        <span class="card-title" style="margin:0">已儲存食物 <span style="color:var(--accent-teal);font-weight:700">${foods.length}</span> 筆</span>
        <input type="text" placeholder="🔍 搜尋已儲食物…" value="${filter}"
          oninput="refilterMf(this.value)"
          style="background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text-primary);font-family:inherit;font-size:13px;padding:7px 12px;outline:none;width:180px;transition:all var(--transition)"
          onfocus="this.style.borderColor='var(--accent-teal)'" onblur="this.style.borderColor='var(--border)'" />
      </div>
      ${shown.length === 0
        ? `<div class="empty-state"><div class="empty-icon">🍱</div>
           <p>${q ? `找不到「${filter}」相關的食物` : '還沒有自訂食物，在上方新增吧！'}</p></div>`
        : shown.map(f => {
            const realIdx = foods.indexOf(f);
            return `<div class="food-entry" style="align-items:flex-start;padding:14px 18px">
              <div style="flex:1;min-width:0">
                <div class="food-entry-name" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  ${f.name}
                  <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding:2px 7px;border-radius:4px;background:rgba(56,178,172,0.12);color:var(--accent-teal);flex-shrink:0">${f.category || '自訂'}</span>
                </div>
                <div class="food-entry-sub" style="margin-top:5px;display:flex;flex-wrap:wrap;gap:6px">
                  <span style="background:rgba(237,137,54,0.12);color:var(--accent-orange);padding:2px 7px;border-radius:4px;font-size:11px;font-weight:600">🔥 ${f.per100g.kcal}大卡</span>
                  <span style="background:rgba(246,173,85,0.12);color:#f6ad55;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:600">💪 蛋白 ${f.per100g.protein}g</span>
                  <span style="background:rgba(104,211,145,0.12);color:#68d391;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:600">🍚 碳水 ${f.per100g.carbs}g</span>
                  <span style="background:rgba(118,228,247,0.12);color:#76e4f7;padding:2px 7px;border-radius:4px;font-size:11px;font-weight:600">🥑 脂肪 ${f.per100g.fat}g</span>
                  ${f.per100g.fiber ? `<span style="background:rgba(72,187,120,0.1);color:var(--accent-green);padding:2px 7px;border-radius:4px;font-size:11px;font-weight:600">🌿 纖維 ${f.per100g.fiber}g</span>` : ''}
                </div>
              </div>
              <div style="display:flex;gap:8px;margin-left:12px;flex-shrink:0;margin-top:2px">
                <button class="btn-sm" onclick="editMfFood(${realIdx})" style="background:rgba(66,153,225,0.12);color:var(--accent-blue);border:1px solid rgba(66,153,225,0.25)">✏️</button>
                <button class="btn-ghost" onclick="deleteMfFood(${realIdx})">🗑️</button>
              </div>
            </div>`;
          }).join('')
      }
    </div>
  `;
}

function refilterMf(val) {
  document.getElementById('main-content').innerHTML = buildMyFoodsHTML(val);
}

function clearMfForm() {
  ['mf-name','mf-kcal','mf-protein','mf-carbs','mf-fat','mf-fiber','mf-sodium','mf-category']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const nameEl = document.getElementById('mf-name');
  if (nameEl) nameEl.dataset.editIdx = '-1';
  const titleEl = document.getElementById('mf-form-title');
  if (titleEl) titleEl.textContent = '➕ 新增自訂食物';
  const fb = document.getElementById('mf-feedback');
  if (fb) { fb.style.display = 'none'; fb.textContent = ''; }
}

function saveMfFood() {
  const nameEl    = document.getElementById('mf-name');
  const name      = (nameEl?.value || '').trim();
  const kcal      = parseFloat(document.getElementById('mf-kcal').value)    || 0;
  const protein   = parseFloat(document.getElementById('mf-protein').value) || 0;
  const carbs     = parseFloat(document.getElementById('mf-carbs').value)   || 0;
  const fat       = parseFloat(document.getElementById('mf-fat').value)     || 0;
  const fiber     = parseFloat(document.getElementById('mf-fiber').value)   || 0;
  const sodium    = parseFloat(document.getElementById('mf-sodium').value)  || 0;
  const category  = (document.getElementById('mf-category').value || '').trim() || '自訂';
  const editIdx   = parseInt(nameEl?.dataset.editIdx ?? '-1');

  if (!name) { alert('請輸入食物名稱'); return; }
  if (!kcal) { alert('請輸入熱量（不可為 0）'); return; }

  const foods = getCustomFoods();
  const entry = {
    cid: editIdx >= 0 ? foods[editIdx].cid : 'c' + Date.now(),
    name, category,
    per100g: { kcal, protein, carbs, fat, fiber, sodium }
  };

  if (editIdx >= 0) {
    foods[editIdx] = entry;
  } else {
    foods.push(entry);
  }
  saveCustomFoods(foods);

  const fb = document.getElementById('mf-feedback');
  if (fb) {
    fb.textContent = `✅ 「${name}」已${editIdx >= 0 ? '更新' : '儲存'}，可直接在搜尋食物中使用！`;
    fb.style.display = 'block';
  }

  clearMfForm();
  // Refresh the list below
  document.getElementById('main-content').innerHTML = buildMyFoodsHTML('');
  const newFb = document.getElementById('mf-feedback');
  if (newFb) {
    newFb.textContent = `✅ 「${name}」已${editIdx >= 0 ? '更新' : '儲存'}，可直接在搜尋食物中使用！`;
    newFb.style.display = 'block';
  }
}

function editMfFood(idx) {
  const foods = getCustomFoods();
  const f = foods[idx];
  if (!f) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  set('mf-name', f.name);
  set('mf-kcal', f.per100g.kcal);
  set('mf-protein', f.per100g.protein);
  set('mf-carbs', f.per100g.carbs);
  set('mf-fat', f.per100g.fat);
  set('mf-fiber', f.per100g.fiber || '');
  set('mf-sodium', f.per100g.sodium || '');
  set('mf-category', f.category || '');
  const nameEl = document.getElementById('mf-name');
  if (nameEl) nameEl.dataset.editIdx = idx;
  const titleEl = document.getElementById('mf-form-title');
  if (titleEl) titleEl.textContent = `✏️ 編輯「${f.name}」`;
  document.getElementById('mf-name')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  document.getElementById('mf-name')?.focus();
}

function deleteMfFood(idx) {
  const foods = getCustomFoods();
  const name = foods[idx]?.name || '';
  if (!confirm(`確定刪除「${name}」？`)) return;
  foods.splice(idx, 1);
  saveCustomFoods(foods);
  refilterMf('');
}
