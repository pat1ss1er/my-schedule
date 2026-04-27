// ==========================================
// 1. 상수 및 상태 변수 (순수 로컬 버전)
// ==========================================
const STORAGE_KEY = "my_schedule_local_v2";
const WEEK = [{k:"Sun",l:"일"},{k:"Mon",l:"월"},{k:"Tue",l:"화"},{k:"Wed",l:"수"},{k:"Thu",l:"목"},{k:"Fri",l:"금"},{k:"Sat",l:"토"}];
const DEFAULT_PALETTE = ["transparent", "#ffadad", "#ffd6a5", "#fdffb6", "#caffbf", "#9bf6ff", "#a0c4ff", "#bdb2ff", "#ffc6ff", "#f8ad9d", "#f4978e", "#fbc4ab", "#ffdab9", "#d4e09b", "#e2e2df", "#f0f0f0"];
const DEFAULT_ICONS = ["fa-solid fa-house", "fa-solid fa-briefcase", "fa-solid fa-book", "fa-solid fa-pen", "fa-solid fa-utensils", "fa-solid fa-mug-hot", "fa-solid fa-cart-shopping", "fa-solid fa-car", "fa-solid fa-plane", "fa-solid fa-heart", "fa-solid fa-star", "fa-solid fa-music", "fa-solid fa-gamepad", "fa-solid fa-wallet", "fa-solid fa-calendar-check", "fa-solid fa-laptop-code"];
const EXTRA_ICONS = ["fa-solid fa-code", "fa-solid fa-laptop", "fa-solid fa-mobile-screen", "fa-solid fa-camera", "fa-solid fa-headphones", "fa-solid fa-film", "fa-solid fa-ticket", "fa-solid fa-plane-departure", "fa-solid fa-train", "fa-solid fa-bus", "fa-solid fa-bicycle", "fa-solid fa-pills", "fa-solid fa-syringe", "fa-solid fa-tooth", "fa-solid fa-stethoscope", "fa-solid fa-droplet", "fa-solid fa-fire-burner", "fa-solid fa-tree", "fa-solid fa-leaf", "fa-solid fa-paw", "fa-solid fa-shirt", "fa-solid fa-socks", "fa-solid fa-glasses", "fa-solid fa-umbrella", "fa-solid fa-gift", "fa-solid fa-cake-candles", "fa-solid fa-bell", "fa-solid fa-comments", "fa-solid fa-envelope", "fa-solid fa-phone", "fa-solid fa-key", "fa-solid fa-lock"];

let schedules = [];
let customColors = []; 
let customIconsArr = []; 
let settings = { theme: 'default' };

let selectedDate = new Date();
let currentCalMonth = new Date();
let editingId = null;
let currentType = 'single'; 
let pDays = new Set(), pColor = DEFAULT_PALETTE[0], pIcon = DEFAULT_ICONS[0];

const pad = n => String(n).padStart(2,"0");
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);
const getDayDiff = (t) => Math.ceil((new Date(t).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000);

// ==========================================
// 2. 데이터 저장 및 불러오기 (로컬스토리지)
// ==========================================
function saveToLocal() {
  const data = { schedules, customColors, customIconsArr, settings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadFromLocal() {
  const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (data) {
    schedules = data.schedules || [];
    customColors = data.customColors || [];
    customIconsArr = data.customIconsArr || [];
    settings = data.settings || { theme: 'default' };
  }
}

// ==========================================
// 3. 핵심 로직: 날짜별 일정 필터링 (기간 지정 기능 포함)
// ==========================================
function getSchedulesForDate(dateObj) {
  const dateStr = ymd(dateObj);
  const dayKey = WEEK[dateObj.getDay()].k;

  return schedules.filter(s => {
    // 스마트 삭제 체크 (보관된 일정은 삭제일 이후 표시 안 함)
    if (s.isArchived && s.deletedAt <= dateStr) return false;

    // 단일 일정
    if (s.type === 'single') return s.singleDate === dateStr;

    // 반복 일정 (기간 필터링 핵심)
    if (s.type === 'repeat') {
      const isDayMatch = s.days.includes(dayKey);
      // 시작일 전이거나 종료일 후면 목록에서 제외
      const isWithinRange = (!s.startDate || s.startDate <= dateStr) && 
                            (!s.endDate || s.endDate >= dateStr);
      return isDayMatch && isWithinRange;
    }
    return false;
  }).sort((a,b) => a.from.localeCompare(b.from));
}

// ==========================================
// 4. 앱 초기화 및 이벤트
// ==========================================
function init() {
  loadFromLocal();
  buildFormUI();
  applyTheme();
  
  if("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  renderAll();
  startAlarmLoop();
}

// 일정 저장 버튼 클릭 시
function saveItem() {
  const text = document.getElementById("fText").value.trim(); 
  if(!text) return alert("내용을 입력해주세요!");

  let cat = document.getElementById("fCat").value; 
  if(cat === 'custom') cat = document.getElementById("fCatCustom").value.trim() || '기타';

  const isDday = document.getElementById("fIsDday").checked; 
  const ddayTarget = document.getElementById("fDdayTarget").value;
  if(isDday && !ddayTarget) return alert("D-Day 목표 날짜를 선택해주세요.");

  const payload = {
    id: editingId || uid(), 
    type: currentType, 
    text, cat,
    singleDate: currentType === 'single' ? document.getElementById("fSingleDate").value : null,
    // 반복 일정용 시작/종료일 저장
    startDate: currentType === 'repeat' ? document.getElementById("fStartDate").value : null,
    endDate: currentType === 'repeat' ? document.getElementById("fEndDate").value : null,
    days: currentType === 'repeat' ? [...pDays] : [],
    from: document.getElementById("fFrom").value || "00:00", 
    to: document.getElementById("fTo").value || "23:59",
    notify: document.getElementById("fNotify").checked, 
    notifyEnd: document.getElementById("fNotifyEnd").checked,
    isDday, ddayTarget, color: pColor, icon: pIcon, 
    doneDates: editingId ? (schedules.find(x=>x.id===editingId)?.doneDates || []) : [],
    isArchived: false
  };

  if(editingId) schedules = schedules.map(x => x.id === editingId ? payload : x); 
  else schedules.push(payload);
  
  saveToLocal();
  closeModal('editModal'); 
  renderAll();
}

// 일정 완료 체크
function toggleDone(id, dateStr) {
  const s = schedules.find(x => x.id === id); 
  if(!s.doneDates) s.doneDates = [];
  s.doneDates.includes(dateStr) ? s.doneDates = s.doneDates.filter(d => d !== dateStr) : s.doneDates.push(dateStr);
  
  saveToLocal();
  renderAll();
  if(document.getElementById('dashboardModal').classList.contains('show')) openDashboard();
}

// 스마트 삭제 (보관)
function smartDelete(id) {
  if (!confirm("일정을 삭제할까요?\n(과거의 달성 기록은 대시보드에 보존됩니다!)")) return;
  const s = schedules.find(x => x.id === id);
  if(s) {
    s.isArchived = true;
    s.deletedAt = ymd(new Date());
    saveToLocal();
    renderAll();
  }
}

// ==========================================
// 5. UI 렌더링 (기존 로직 유지)
// ==========================================
function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
  event.target.classList.add('active'); document.getElementById(`view-${tabId}`).classList.add('active');
  if(tabId === 'monthly') { currentCalMonth = new Date(selectedDate); renderMonthlyGrid(); }
}

function renderAll() { renderDateBar(); renderDailyList(); renderWeeklyList(); renderMonthlyGrid(); renderDdays(); }

function renderDdays() {
  const container = document.getElementById("ddayContainer"); container.innerHTML = "";
  schedules.filter(s => s.isDday && s.ddayTarget && !s.isArchived).forEach(s => {
    const diff = getDayDiff(s.ddayTarget);
    const dText = diff === 0 ? "D-Day" : diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
    const chip = document.createElement("div"); chip.className = "dday-chip";
    chip.innerHTML = `<span>${s.text}</span> <span class="d-count">${dText}</span>`;
    container.appendChild(chip);
  });
}

function renderDateBar() {
  const bar = document.getElementById("dateBar"); bar.innerHTML = "";
  for(let i=-15; i<=15; i++){
    const d = new Date(selectedDate); d.setDate(selectedDate.getDate()+i);
    const btn = document.createElement("div");
    btn.className = "date-btn" + (i===0 ? " active" : "");
    btn.innerHTML = `<span style="font-size:10px; font-weight:700;">${WEEK[d.getDay()].l}</span><span style="font-size:16px; font-weight:900;">${d.getDate()}</span>`;
    btn.onclick = () => { selectedDate = d; renderAll(); };
    bar.appendChild(btn);
  }
  setTimeout(() => {
    const activeBtn = bar.querySelector('.active');
    if(activeBtn) { bar.scrollTo({ left: activeBtn.offsetLeft - bar.offsetWidth/2 + activeBtn.offsetWidth/2, behavior: 'smooth' }); }
  }, 10);
}

function renderDailyList() {
  const listEl = document.getElementById("list"); listEl.innerHTML = "";
  const dateStr = ymd(selectedDate); const items = getSchedulesForDate(selectedDate);
  if(!items.length) { listEl.innerHTML = `<div style="padding:30px; text-align:center; color:var(--muted); font-size:14px;">등록된 일정이 없어요.</div>`; return; }

  items.forEach(s => {
    const isDone = s.doneDates && s.doneDates.includes(dateStr);
    const iconHtml = s.icon.startsWith('data:image') ? `<img src="${s.icon}" class="custom-icon-img">` : `<i class="${s.icon}"></i>`;
    const item = document.createElement("div"); item.className = "item" + (isDone ? " done" : "");
    item.style.setProperty("--c", s.color === 'transparent' ? 'transparent' : s.color);
    
    item.innerHTML = `
      <div class="item-bg"></div>
      <div class="item-content">
        <div class="icon-col"><span class="cat-badge">${s.cat}</span>${iconHtml}</div>
        <div><div class="title">${s.text}</div><div class="time">${s.from} ~ ${s.to} ${s.notify ? '<i class="fa-solid fa-bell" style="color:#f39c12"></i>' : ''} ${s.notifyEnd ? '<i class="fa-solid fa-clock-rotate-left" style="color:#e74c3c"></i>' : ''}</div></div>
        <div class="actions">
          <button class="chk-btn" onclick="toggleDone('${s.id}', '${dateStr}')"><i class="fa-solid fa-check"></i></button>
          <button class="icon-btn" onclick="openEdit('${s.id}')"><i class="fa-solid fa-pen"></i></button>
          <button class="icon-btn" onclick="smartDelete('${s.id}')" style="color:#d11;"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>`;
    listEl.appendChild(item);
  });
}

function renderWeeklyList() {
  const listEl = document.getElementById("weekList"); listEl.innerHTML = "";
  const startOfWeek = new Date(selectedDate); startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());
  const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);
  document.getElementById("weekTitle").innerText = `${startOfWeek.getMonth()+1}월 ${startOfWeek.getDate()}일 ~ ${endOfWeek.getMonth()+1}월 ${endOfWeek.getDate()}일`;

  for(let i=0; i<7; i++) {
    const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i);
    const dateStr = ymd(d); const isToday = dateStr === ymd(new Date());
    const dayItems = getSchedulesForDate(d);
    
    const row = document.createElement("div"); row.className = "week-row" + (isToday ? " today" : "");
    row.onclick = () => { selectedDate = d; document.querySelectorAll('.tab')[0].click(); renderAll(); };

    let tasksHtml = dayItems.length === 0 ? `<div style="font-size:12px; color:var(--muted); margin-top:8px;">일정 없음</div>` : "";
    dayItems.forEach(s => {
      const isDone = s.doneDates && s.doneDates.includes(dateStr);
      tasksHtml += `<div class="week-task-line ${isDone ? 'done' : ''}" style="--c:${s.color === 'transparent' ? 'var(--line)' : s.color}">
                      <span style="font-weight:700;">${s.from}</span> <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${s.text}</span>
                    </div>`;
    });
    row.innerHTML = `<div class="week-head"><div class="week-day-name">${WEEK[i].l}</div><div class="week-date-num">${d.getDate()}일</div></div><div class="week-body">${tasksHtml}</div>`;
    listEl.appendChild(row);
  }
}

function renderMonthlyGrid() {
  const y = currentCalMonth.getFullYear(); const m = currentCalMonth.getMonth();
  document.getElementById("calMonthTitle").innerText = `${y}. ${pad(m+1)}`;
  const grid = document.getElementById("calGrid"); grid.innerHTML = "";
  WEEK.forEach(w => { grid.innerHTML += `<div class="cal-day-name">${w.l}</div>`; });
  const firstDay = new Date(y, m, 1).getDay(); const lastDate = new Date(y, m+1, 0).getDate();
  for(let i=0; i<firstDay; i++) grid.innerHTML += `<div></div>`;
  
  for(let i=1; i<=lastDate; i++) {
    const targetD = new Date(y, m, i); const dStr = ymd(targetD); const dayItems = getSchedulesForDate(targetD);
    const dotsHtml = dayItems.map(s => {
      const isDone = s.doneDates && s.doneDates.includes(dStr);
      return `<div class="cal-dot" style="background:${isDone || s.color === 'transparent' ? 'var(--line)' : s.color}; opacity:${isDone ? 0.3 : 1}"></div>`;
    }).join("");
    const cell = document.createElement("div"); cell.className = "cal-cell" + (dStr === ymd(new Date()) ? " today" : "");
    cell.innerHTML = `<span class="cal-date">${i}</span><div class="cal-dots">${dotsHtml}</div>`;
    cell.onclick = () => { selectedDate = targetD; document.querySelectorAll('.tab')[0].click(); renderAll(); };
    grid.appendChild(cell);
  }
}

function changeMonth(dir) { currentCalMonth.setMonth(currentCalMonth.getMonth() + dir); renderMonthlyGrid(); }
function openSettings() { document.getElementById('themeSelect').value = settings.theme; document.getElementById('settingModal').classList.add('show'); }
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function changeTheme() { settings.theme = document.getElementById('themeSelect').value; applyTheme(); saveToLocal(); }
function applyTheme() { document.body.setAttribute('data-theme', settings.theme); }

function setType(type) {
  currentType = type; 
  document.getElementById('typeSingle').classList.toggle('active', type === 'single'); 
  document.getElementById('typeRepeat').classList.toggle('active', type === 'repeat');
  document.getElementById('wrapSingleDate').style.display = type === 'single' ? 'block' : 'none'; 
  document.getElementById('wrapRepeatDays').style.display = type === 'repeat' ? 'block' : 'none';
  // 추가된 기간 지정 영역 토글
  document.getElementById('wrapRepeatDates').style.display = type === 'repeat' ? 'flex' : 'none';
}

function toggleCustomCat() { document.getElementById('fCatCustom').style.display = document.getElementById('fCat').value === 'custom' ? 'block' : 'none'; }
function toggleDdayDate() { document.getElementById('wrapDdayTarget').style.display = document.getElementById('fIsDday').checked ? 'block' : 'none'; }

function buildFormUI() {
  const fDays = document.getElementById("fDays"); fDays.innerHTML = "";
  WEEK.forEach(w => {
    const b = document.createElement("div"); b.className="chip"; b.innerText=w.l;
    b.onclick=() => { pDays.has(w.k) ? pDays.delete(w.k) : pDays.add(w.k); updateFormUI(); }; fDays.appendChild(b);
  });
  renderPalette(); renderIconsList();
}

function renderPalette() {
  const fPal = document.getElementById("fPalette"); fPal.innerHTML = "";
  const allColors = [...DEFAULT_PALETTE, ...customColors];
  allColors.forEach((c, index) => {
    const b = document.createElement("div"); b.className="swatch"; 
    if(c === 'transparent') { b.className = "swatch transparent"; b.innerHTML = '<i class="fa-solid fa-xmark"></i>'; } else { b.style.background=c; }
    if(index >= DEFAULT_PALETTE.length) {
      const delBtn = document.createElement("button"); delBtn.className = "icon-del-btn color-del-btn"; delBtn.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
      delBtn.onclick = (e) => { e.stopPropagation(); if(confirm("삭제할까요?")) { customColors.splice(index - DEFAULT_PALETTE.length, 1); if(pColor === c) pColor = DEFAULT_PALETTE[0]; saveToLocal(); renderPalette(); updateFormUI(); } };
      b.appendChild(delBtn);
    }
    b.onclick = () => { pColor = c; updateFormUI(); }; fPal.appendChild(b);
  });
}

function addCustomColor(e) { const col = e.target.value; customColors.push(col); saveToLocal(); pColor = col; renderPalette(); updateFormUI(); }

function renderIconsList() {
  const fIco = document.getElementById("fIcons"); fIco.innerHTML = "";
  const allIcons = [...DEFAULT_ICONS, ...customIconsArr];
  allIcons.forEach((iconStr, index) => {
    const b = document.createElement("div"); b.className="iconpick";
    b.innerHTML = iconStr.startsWith('data:image') ? `<img src="${iconStr}">` : `<i class="${iconStr}"></i>`;
    if(index >= DEFAULT_ICONS.length) {
      const delBtn = document.createElement("button"); delBtn.className = "icon-del-btn"; delBtn.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
      delBtn.onclick = (e) => { e.stopPropagation(); if(confirm("삭제할까요?")) { customIconsArr.splice(index - DEFAULT_ICONS.length, 1); if(pIcon === iconStr) pIcon = DEFAULT_ICONS[0]; saveToLocal(); renderIconsList(); updateFormUI(); } };
      b.appendChild(delBtn);
    }
    b.onclick = () => { pIcon = iconStr; updateFormUI(); }; fIco.appendChild(b);
  });
}

function uploadCustomIcon(e) {
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
      canvas.width = 64; canvas.height = 64; ctx.drawImage(img, 0, 0, 64, 64);
      const base64 = canvas.toDataURL('image/png');
      customIconsArr.push(base64); saveToLocal(); pIcon = base64; renderIconsList(); updateFormUI();
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function openMoreIcons() {
  const grid = document.getElementById("extraIconsGrid"); grid.innerHTML = "";
  EXTRA_ICONS.forEach(ic => {
    const b = document.createElement("div"); b.className = "iconpick"; b.innerHTML = `<i class="${ic}"></i>`;
    b.onclick = () => { if(!customIconsArr.includes(ic) && !DEFAULT_ICONS.includes(ic)) { customIconsArr.push(ic); saveToLocal(); renderIconsList(); } pIcon = ic; updateFormUI(); closeModal('moreIconsModal'); };
    grid.appendChild(b);
  });
  document.getElementById('moreIconsModal').classList.add('show');
}

function updateFormUI() {
  [...document.getElementById("fDays").children].forEach((c,i) => c.classList.toggle('on', pDays.has(WEEK[i].k)));
  const allColors = [...DEFAULT_PALETTE, ...customColors];
  document.getElementById("fPalette").querySelectorAll('.swatch').forEach((c, i) => c.classList.toggle('on', allColors[i] === pColor));
  const allIcons = [...DEFAULT_ICONS, ...customIconsArr];
  document.getElementById("fIcons").querySelectorAll('.iconpick').forEach((c, i) => c.classList.toggle('on', allIcons[i] === pIcon));
}

function openEdit(id = null) {
  editingId = id; document.getElementById("editTitle").innerText = id ? "일정 수정" : "새 일정 추가";
  if(id) {
    const s = schedules.find(x => x.id === id); setType(s.type || 'single'); document.getElementById("fText").value = s.text;
    const predefinedCats = ["공부", "업무", "운동", "약속", "일상"];
    if(predefinedCats.includes(s.cat)) { document.getElementById("fCat").value = s.cat; document.getElementById("fCatCustom").style.display = 'none'; }
    else { document.getElementById("fCat").value = 'custom'; document.getElementById("fCatCustom").value = s.cat; document.getElementById("fCatCustom").style.display = 'block'; }
    document.getElementById("fSingleDate").value = s.singleDate || ymd(new Date()); 
    document.getElementById("fStartDate").value = s.startDate || "";
    document.getElementById("fEndDate").value = s.endDate || "";
    document.getElementById("fFrom").value = s.from; document.getElementById("fTo").value = s.to;
    document.getElementById("fNotify").checked = s.notify || false; document.getElementById("fNotifyEnd").checked = s.notifyEnd || false;
    document.getElementById("fIsDday").checked = s.isDday || false; document.getElementById("fDdayTarget").value = s.ddayTarget || "";
    toggleDdayDate(); pDays = new Set(s.days || []); pColor = s.color || 'transparent'; pIcon = s.icon;
  } else {
    setType('single'); document.getElementById("fText").value = ""; document.getElementById("fCat").value = "공부"; document.getElementById("fCatCustom").style.display = 'none';
    document.getElementById("fSingleDate").value = ymd(selectedDate); 
    document.getElementById("fStartDate").value = ymd(new Date());
    document.getElementById("fEndDate").value = "";
    document.getElementById("fFrom").value = "09:00"; document.getElementById("fTo").value = "10:00";
    document.getElementById("fNotify").checked = false; document.getElementById("fNotifyEnd").checked = false;
    document.getElementById("fIsDday").checked = false; toggleDdayDate(); document.getElementById("fDdayTarget").value = "";
    pDays = new Set(["Mon","Tue","Wed","Thu","Fri"]); pColor = DEFAULT_PALETTE[0]; pIcon = DEFAULT_ICONS[0];
  }
  updateFormUI(); document.getElementById("editModal").classList.add("show");
}

function openDashboard() {
  const body = document.getElementById("dashboardBody"); body.innerHTML = "";
  const now = new Date(); const todayStr = ymd(now);
  const dailyItems = getSchedulesForDate(now);
  const dailyDone = dailyItems.filter(s => s.doneDates && s.doneDates.includes(todayStr)).length;
  const dailyPct = dailyItems.length ? Math.round((dailyDone / dailyItems.length) * 100) : 0;
  
  let weeklyTotal = 0; let weeklyDone = 0;
  const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay());
  for(let i=0; i<7; i++) {
    const d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i);
    const dStr = ymd(d); const dItems = getSchedulesForDate(d);
    weeklyTotal += dItems.length; weeklyDone += dItems.filter(s => s.doneDates && s.doneDates.includes(dStr)).length;
  }
  const weeklyPct = weeklyTotal ? Math.round((weeklyDone / weeklyTotal) * 100) : 0;

  const makeExpBar = (title, pct, done, total) => `
    <div class="dash-section">
      <div class="dash-title"><span>${title}</span> <span style="color:var(--accent)">${pct}% (${done}/${total})</span></div>
      <div class="exp-bg"><div class="exp-fill" style="width: 0%;" data-target="${pct}"></div>
      <div class="exp-text">${pct}% 달성 중</div></div>
    </div>
  `;
  body.innerHTML = `<p style="font-size:13px; color:var(--muted); margin-top:0;">오늘 하루도 성장하고 있어요! 💪</p>${makeExpBar('오늘의 경험치', dailyPct, dailyDone, dailyItems.length)}${makeExpBar('이번 주 경험치', weeklyPct, weeklyDone, weeklyTotal)}`;
  document.getElementById('dashboardModal').classList.add('show');
  setTimeout(() => { body.querySelectorAll('.exp-fill').forEach(el => { el.style.width = el.getAttribute('data-target') + '%'; }); }, 50);
}

function startAlarmLoop() {
  setInterval(() => {
    const now = new Date(); const dStr = ymd(now); const dayKey = WEEK[now.getDay()].k;
    const currTimeStr = pad(now.getHours()) + ":" + pad(now.getMinutes());
    schedules.forEach(s => {
      const isToday = (s.type === 'single' && s.singleDate === dStr) || (s.type === 'repeat' && s.days.includes(dayKey));
      if(!isToday || s.isArchived) return;
      const isDone = s.doneDates && s.doneDates.includes(dStr);
      if(s.notify && !isDone && s.from === currTimeStr) sendPush("스케줄 시작", `[${s.from}] ${s.text} 시작할 시간입니다!`);
      if(s.notifyEnd && !isDone && s.to) {
        const toParts = s.to.split(":");
        const toMins = parseInt(toParts[0]) * 60 + parseInt(toParts[1]);
        const currMins = now.getHours() * 60 + now.getMinutes();
        if(toMins - 5 === currMins) sendPush("종료 임박", `[${s.to} 종료] ${s.text} 완료 5분 전입니다.`);
      }
    });
  }, 60000);
}

function sendPush(title, body) {
  if(Notification.permission === "granted") new Notification(title, { body: body, icon: "https://cdn-icons-png.flaticon.com/512/3237/3237472.png" });
}

// 🚀 앱 실행
window.addEventListener('DOMContentLoaded', init);