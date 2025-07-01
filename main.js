const DEFAULT_CATEGORIES = ["Groceries", "Food", "Transport", "Bills", "Entertainment", "Other"];
const LS_KEY = "budget-entries";
const CAT_KEY = "budget-cats";
const THEME_KEY = "budget-theme";
const LIMIT_KEY = "budget-limits";
const USER_KEY = "budget-user";
const CURRENCY_KEY = "budget-currency";
let entries = [];
let categories = [];
let editingId = null;
let limits = {};
let user = { name: "", avatar: "" };
let currency = "zł";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const formatAmount = val => Number(val).toLocaleString('en-US', {minimumFractionDigits:2}) + " " + currency;
const today = () => (new Date()).toISOString().slice(0,10);

function saveData() { localStorage.setItem(LS_KEY, JSON.stringify(entries)); }
function loadData() { entries = JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
function saveCats() { localStorage.setItem(CAT_KEY, JSON.stringify(categories)); }
function loadCats() { categories = JSON.parse(localStorage.getItem(CAT_KEY) || "[]"); if (!categories.length) categories = [...DEFAULT_CATEGORIES]; }
function saveLimits() { localStorage.setItem(LIMIT_KEY, JSON.stringify(limits)); }
function loadLimits() { limits = JSON.parse(localStorage.getItem(LIMIT_KEY) || "{}"); }
function saveUser() { localStorage.setItem(USER_KEY, JSON.stringify(user)); }
function loadUser() { user = JSON.parse(localStorage.getItem(USER_KEY) || '{"name": "", "avatar": ""}'); }
function saveCurrency() { localStorage.setItem(CURRENCY_KEY, currency); }
function loadCurrency() { currency = localStorage.getItem(CURRENCY_KEY) || "zł"; }
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  $('#themeToggle').title = theme === "dark" ? "Light mode" : "Dark mode";
  if ($('#themePicker')) $('#themePicker').value = theme;
}
function getTheme() { return localStorage.getItem(THEME_KEY) || (window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light"); }
function updateCatSelects() {
  const catSel = $("#category");
  catSel.innerHTML = `<option value="" disabled selected>Category</option>`;
  categories.forEach(c => { catSel.innerHTML += `<option value="${c}">${c}</option>`; });
  const filterCat = $("#filterCat");
  filterCat.innerHTML = `<option value="">All</option>`;
  categories.forEach(c => { filterCat.innerHTML += `<option value="${c}">${c}</option>`; });
  const catList = $("#catList");
  catList.innerHTML = "";
  categories.forEach((c, i) => {
    catList.innerHTML += `<li>${c} <button data-idx="${i}" class="delCat" title="Remove category">✖</button></li>`;
  });
  // For edit popup
  const editCatSel = $("#editCategory");
  if (editCatSel) {
    editCatSel.innerHTML = "";
    categories.forEach(c => { editCatSel.innerHTML += `<option value="${c}">${c}</option>`; });
  }
}
function updateLimitList() {
  const limitList = $("#limitList");
  if (!limitList) return;
  limitList.innerHTML = "";
  categories.forEach(cat => {
    limitList.innerHTML += `<li>
      <label for="limit-${cat}">${cat}</label>
      <input type="number" min="0" step="0.01" value="${limits[cat]||""}" data-cat="${cat}" id="limit-${cat}" placeholder="None" class="settings-input">
      <span style="color:#aaa;font-size:.97em">(${currency})</span>
    </li>`;
  });
}
function checkLimits(showPopupIfExceeded = false, justAddedEntry = null) {
  let alerts = [];
  let popupMsg = "";
  for (let cat of categories) {
    let lim = limits[cat];
    if (!lim) continue;
    let sum = entries.filter(e=>e.type==="expense" && e.category===cat).reduce((a,b)=>a+Number(b.amount),0);
    if (sum > lim) {
      alerts.push(`Limit exceeded for <b>${cat}</b> (${formatAmount(sum)} > ${formatAmount(lim)})`);
      // If just added entry caused this, show more visible popup
      if (showPopupIfExceeded && justAddedEntry && justAddedEntry.category === cat && justAddedEntry.type === "expense") {
        popupMsg = `Limit exceeded for <b>${cat}</b>!<br/>You spent ${formatAmount(sum)} (limit: ${formatAmount(lim)}).`;
      }
    }
  }
  const alertDiv = $("#limitAlert");
  if (alertDiv) {
    if (alerts.length) {
      alertDiv.innerHTML = alerts.join("<br>");
      alertDiv.style.display = "block";
    } else {
      alertDiv.style.display = "none";
    }
  }
  showLimitPopup(popupMsg);
}
function showLimitPopup(msg) {
  const div = $("#limitPopup");
  if (msg) {
    div.innerHTML = msg;
    div.style.display = "block";
    setTimeout(()=>div.style.display="none", 5500);
  } else {
    div.style.display = "none";
  }
}
function showToast(msg, color) {
  const t = $("#toast");
  t.textContent = msg;
  t.style.background = color || "var(--accent)";
  t.classList.add("active");
  setTimeout(()=>t.classList.remove("active"), 2500);
}
function showAvatar() {
  const img = $("#user-avatar");
  if (img && user.avatar) {
    img.src = user.avatar;
    img.style.display = "block";
  } else if(img) {
    img.style.display = "none";
  }
}
function renderSummary() {
  const incomes = entries.filter(e=>e.type==="income").reduce((a,b)=>a+Number(b.amount),0);
  const expenses = entries.filter(e=>e.type==="expense").reduce((a,b)=>a+Number(b.amount),0);
  $("#incomes").textContent = formatAmount(incomes);
  $("#expenses").textContent = formatAmount(expenses);
  $("#balance").textContent = formatAmount(incomes-expenses);
  drawMainChart(incomes, expenses);
}
function renderTable() {
  const tbody = $("#entryTable tbody");
  tbody.innerHTML = "";
  let filtered = filterEntries();
  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:#aaa">No entries</td></tr>`;
    return;
  }
  filtered.sort((a,b)=>b.date.localeCompare(a.date));
  filtered.forEach((e, idx) => {
    tbody.innerHTML += `
      <tr${editingId===e.id?' class="pop"':''}>
        <td>${e.date}</td>
        <td>${e.desc}</td>
        <td>${e.category}</td>
        <td>${e.type==="income"?"Income":"Expense"}</td>
        <td${e.type==="expense"?" style='color:#e74c3c'":" style='color:#2ecc71'"}>${formatAmount(e.amount)}</td>
        <td>${e.note||""}</td>
        <td>
          <button class="edit" title="Edit" data-id="${e.id}">✏️</button>
          <button class="delete" title="Delete" data-id="${e.id}">🗑️</button>
        </td>
      </tr>
    `;
  });
}
function renderPieChart() {
  const data = {};
  entries.filter(e=>e.type==="expense").forEach(e=>{
    if (!data[e.category]) data[e.category]=0;
    data[e.category]+=Number(e.amount);
  });
  drawPieChart(data);
}
function renderBarChart() {
  const stats = {};
  entries.forEach(e=>{
    const ym = e.date.slice(0,7);
    if (!stats[ym]) stats[ym]={in:0, out:0};
    if (e.type==="income") stats[ym].in+=Number(e.amount);
    else stats[ym].out+=Number(e.amount);
  });
  const months = [];
  for(let i=6;i>=0;i--){
    const d = new Date();
    d.setMonth(d.getMonth()-i);
    const ym = d.toISOString().slice(0,7);
    months.push(ym);
  }
  drawBarChart(months.map(m=>({
    label: m,
    value: (stats[m]?.in??0)-(stats[m]?.out??0),
    income: stats[m]?.in??0,
    expense: stats[m]?.out??0
  })));
}
function filterEntries() {
  let arr = [...entries];
  const s = $("#search").value.trim().toLowerCase();
  const cat = $("#filterCat").value;
  const type = $("#filterType").value;
  if(s) arr = arr.filter(e=>e.desc.toLowerCase().includes(s) || (e.note||"").toLowerCase().includes(s));
  if(cat) arr = arr.filter(e=>e.category===cat);
  if(type) arr = arr.filter(e=>e.type===type);
  return arr;
}
function resetForm() {
  $("#entryForm").reset();
  $("#date").value=today();
  $("#category").selectedIndex=0;
  $("#type").value="expense";
  editingId = null;
  $("#entryForm button[type=submit]").textContent = "Add";
  showQuickHints();
}
function fillForm(e) {
  $("#date").value = e.date;
  $("#desc").value = e.desc;
  $("#amount").value = e.amount;
  $("#category").value = e.category;
  $("#type").value = e.type;
  $("#note").value = e.note||"";
  editingId = e.id;
  $("#entryForm button[type=submit]").textContent = "Save";
  $("#entryForm").scrollIntoView({behavior:"smooth"});
  showQuickHints();
}
function showQuickHints() {
  let last = null;
  if (entries.length) {
    if (editingId) {
      last = entries.slice().reverse().find(e=>e.id!==editingId && e.type === $("#type").value);
    } else {
      last = entries[entries.length-1];
    }
  }
  let quickAmount = "";
  let quickCat = "";
  if (last) {
    quickAmount = last.amount;
    quickCat = last.category;
  }
  const quick = $("#quick-insert");
  if (quick) {
    quick.textContent = quickAmount ? `↺ ${quickAmount}` : "";
    quick.style.display = quickAmount ? "inline-block" : "none";
    quick.onclick = (e) => {
      e.preventDefault();
      if (quickAmount) {
        $("#amount").value = quickAmount;
        $("#amount").focus();
      }
    };
  }
  const quickCatEl = $("#quick-insert-cat");
  if (quickCatEl) {
    quickCatEl.textContent = quickCat ? `↺ ${quickCat}` : "";
    quickCatEl.style.display = quickCat ? "inline-block" : "none";
    quickCatEl.onclick = (e) => {
      e.preventDefault();
      if (quickCat) {
        $("#category").value = quickCat;
        $("#category").focus();
      }
    };
  }
}
function handleFormShortcuts(ev) {
  const el = ev.target;
  if (el.closest("#entryForm")) {
    if (ev.key === "Enter") {
      if (!(el.tagName === "SELECT" || el.tagName === "BUTTON")) {
        ev.preventDefault();
        $("#entryForm").requestSubmit();
      }
    }
    if (ev.key === "Escape") {
      ev.preventDefault();
      resetForm();
    }
  }
}
document.addEventListener("keydown", function(e){
  const act = document.activeElement;
  if (act && act.closest && act.closest("#entryForm")) {
    handleFormShortcuts(e);
  }
});
document.addEventListener("DOMContentLoaded", ()=>{
  if ($("#type")) $("#type").addEventListener("change", showQuickHints);
  if ($("#desc")) $("#desc").addEventListener("focus", showQuickHints);
  if ($("#amount")) $("#amount").addEventListener("focus", showQuickHints);
  if ($("#category")) $("#category").addEventListener("focus", showQuickHints);
});
function bindEvents() {
  $("#entryForm").onsubmit = ev => {
    ev.preventDefault();
    const [date, desc, amount, category, type, note] = [
      $("#date").value,
      $("#desc").value.trim(),
      $("#amount").value,
      $("#category").value,
      $("#type").value,
      $("#note").value.trim()
    ];
    if (!date || !desc || !amount || !category) return;
    let newEntryObj = {id: (editingId||'e'+Date.now()), date, desc, amount, category, type, note};
    if (editingId) {
      const idx = entries.findIndex(e=>e.id===editingId);
      entries[idx] = {...newEntryObj};
      editingId = null;
    } else {
      entries.push(newEntryObj);
    }
    saveData();
    renderAll();
    resetForm();
    checkLimits(true, newEntryObj);
    showToast("Entry saved!","var(--accent)");
  };
  $("#entryTable").onclick = ev => {
    if (ev.target.classList.contains("edit")) {
      const e = entries.find(e=>e.id===ev.target.dataset.id);
      openEditModal(e);
    }
    if (ev.target.classList.contains("delete")) {
      if (confirm("Are you sure you want to delete this entry?")) {
        entries = entries.filter(e=>e.id!==ev.target.dataset.id);
        saveData();
        renderAll();
        checkLimits();
        showToast("Entry deleted!","#e74c3c");
      }
    }
  };
  document.body.addEventListener('click', function(e){
    if (e.target && e.target.id === "cancelEdit") closeEditModal();
  });
  document.body.addEventListener('click', function(e){
    if (e.target && e.target.classList.contains("close-btn")) {
      closeEditModal();
      closeSettingsModal();
    }
  });
  document.addEventListener("keydown", (e)=>{
    if ($("#editModal").classList.contains("active") && e.key==="Escape") closeEditModal();
    if ($("#settingsModal").classList.contains("active") && e.key==="Escape") closeSettingsModal();
  });
  $("#search").oninput = $("#filterCat").onchange = $("#filterType").onchange = renderTable;
  $("#addCat").onclick = (e) => {
    rippleEffect(e);
    const val = $("#newCat").value.trim();
    if (val && !categories.includes(val)) {
      categories.push(val);
      saveCats();
      updateCatSelects();
      updateLimitList();
      $("#newCat").value="";
      showToast("Category added!","var(--accent)");
    }
  };
  $("#catList").onclick = ev => {
    if (ev.target.classList.contains("delCat")) {
      if (categories.length<=1) return alert("There must be at least one category!");
      if (confirm("Remove this category?")) {
        const idx = Number(ev.target.dataset.idx);
        const cat = categories[idx];
        categories.splice(idx,1);
        delete limits[cat];
        saveCats(); saveLimits();
        updateCatSelects();
        updateLimitList();
        renderAll();
        showToast("Category removed!","#e67e22");
      }
    }
  };
  $("#exportBtn").onclick = (e) => {
    rippleEffect(e);
    const data = JSON.stringify({entries, categories, limits, user, currency});
    const blob = new Blob([data], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "budget_data.json";
    a.click();
    showToast("Data exported!","#6ec6ff");
  };
  $("#importBtn").onclick = (e) => { rippleEffect(e); $("#importFile").click(); };
  $("#importFile").onchange = ev => {
    const f = ev.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data.entries) || !Array.isArray(data.categories)) throw 0;
        entries = data.entries;
        categories = data.categories;
        limits = data.limits || {};
        user = data.user || {name:"",avatar:""};
        currency = data.currency || "zł";
        saveData(); saveCats(); saveLimits(); saveUser(); saveCurrency();
        renderAll();
        checkLimits();
        showToast("Data imported!","#6ec6ff");
      } catch {
        alert("Import error!");
      }
    };
    reader.readAsText(f);
    ev.target.value = "";
  };
  $("#resetBtn").onclick = (e) => {
    rippleEffect(e);
    if (confirm("Are you sure you want to remove all data?")) {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(CAT_KEY);
      localStorage.removeItem(LIMIT_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(CURRENCY_KEY);
      entries = [];
      categories = [...DEFAULT_CATEGORIES];
      limits = {};
      user = { name:"", avatar:""};
      currency = "zł";
      saveData(); saveCats(); saveLimits(); saveUser(); saveCurrency();
      renderAll();
      updateLimitList();
      checkLimits();
      showAvatar();
      showToast("Data reset!","#e74c3c");
    }
  };
  $("#themeToggle").onclick = () => {
    const theme = getTheme()==="dark" ? "light" : "dark";
    setTheme(theme);
    showToast("Theme changed!","var(--accent2)");
  }
  if ($("#themePicker")) $("#themePicker").onchange = (e) => {
    setTheme(e.target.value);
    showToast("Theme changed!","var(--accent2)");
  }
  if ($("#limitList")) $("#limitList").oninput = (e) => {
    if (e.target.type==="number") {
      const cat = e.target.dataset.cat;
      const v = e.target.value;
      if (!v) delete limits[cat];
      else limits[cat]=Number(v);
      saveLimits();
      checkLimits();
    }
  };
  if ($("#currency")) $("#currency").onchange = (e) => {
    currency = e.target.value;
    saveCurrency();
    renderAll();
    updateLimitList();
    showToast("Currency changed!","var(--accent2)");
  };
  if ($("#userName")) $("#userName").oninput = (e) => {
    user.name = e.target.value.slice(0,24);
    saveUser();
    showToast("Alias saved!","var(--accent)");
  };
  if ($("#avatarBtn")) $("#avatarBtn").onclick = () => $("#avatarUpload").click();
  if ($("#avatarUpload")) $("#avatarUpload").onchange = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) return showToast("Invalid file!","#e74c3c");
    const reader = new FileReader();
    reader.onload = ev => {
      user.avatar = ev.target.result;
      saveUser();
      showAvatar();
      showToast("Avatar saved!","var(--accent2)");
    };
    reader.readAsDataURL(f);
  };
  $$(".ripple-btn").forEach(btn=>{
    btn.addEventListener("click",rippleEffect);
  });

  $("#settingsBtn").onclick = function() {
    $("#settingsModal").classList.add("active");
    updateLimitList();
    showAvatar();
  }
  $("#closeSettings").onclick = closeSettingsModal;
}
function rippleEffect(e) {
  const btn = e.currentTarget;
  if (!btn) return;
  btn.classList.remove('ripple');
  void btn.offsetWidth;
  btn.classList.add('ripple');
  setTimeout(()=>btn.classList.remove('ripple'),500);
}
function renderAll() {
  updateCatSelects();
  renderSummary();
  renderTable();
  renderPieChart();
  renderBarChart();
  showQuickHints();
  updateLimitList();
  checkLimits();
  showAvatar();
  if ($("#userName")) $("#userName").value = user.name || "";
  if ($("#currency")) $("#currency").value = currency;
  if ($('#themePicker')) $('#themePicker').value = getTheme();
}
function init() {
  loadCats();
  loadData();
  loadLimits();
  loadUser();
  loadCurrency();
  setTheme(getTheme());
  updateCatSelects();
  resetForm();
  renderAll();
  bindEvents();
  $("#date").value = today();
  showQuickHints();
  showAvatar();
}
document.addEventListener("DOMContentLoaded", init);

function drawPieChart(data) {
  const container = document.getElementById("pieChart");
  container.innerHTML = "";
  const total = Object.values(data).reduce((a,b)=>a+b,0);
  if (!total) {
    container.innerHTML = '<div style="color:#aaa;text-align:center;margin-top:30px">No data</div>';
    $(".pie-legend")?.remove();
    return;
  }
  const colors = [
    "#2ecc71","#6ec6ff","#e67e22","#e74c3c","#9b59b6","#f1c40f",
    "#1abc9c","#34495e","#95a5a6","#a569bd"
  ];
  let angle = 0;
  let i = 0;
  const r = 75, c = 2*Math.PI*r;
  const svgsize = 2*r+38;
  let svg = `<svg width="${svgsize}" height="${svgsize}" viewBox="0 0 ${svgsize} ${svgsize}" class="pie-chart" style="display:block;margin:auto;">`;
  Object.entries(data).forEach(([cat, val],idx) => {
    const frac = val/total;
    const len = frac * c;
    svg += `<circle r="${r}" cx="${svgsize/2}" cy="${svgsize/2}" fill="transparent" stroke="${colors[i%colors.length]}"
      stroke-width="38" stroke-dasharray="${len} ${c-len}" stroke-dashoffset="${-angle}"
      style="transition:stroke-dasharray .7s cubic-bezier(.42,.01,.58,1.02)"/>`;
    angle += len;
    i++;
  });
  svg += `</svg>`;
  container.innerHTML = svg;
  let legend = `<div class="pie-legend">`;
  i=0;
  Object.entries(data).forEach(([cat,val])=>{
    legend += `<span><span class="dot" style="background:${colors[i%colors.length]}"></span> ${cat} (${formatAmount(val)})</span>`;
    i++;
  });
  legend += `</div>`;
  container.insertAdjacentHTML("beforeend",legend);
}
function drawBarChart(months) {
  const container = document.getElementById("barChart");
  container.innerHTML = "";
  if (!months.length) {
    container.innerHTML = 'No data';
    return;
  }
  const vals = months.map(m=>m.value);
  const max = Math.max(...vals.map(Math.abs),1);
  let html = `<div class="bar-chart">`;
  months.forEach((m,idx) => {
    const h = 120 * Math.abs(m.value)/max;
    html += `<div class="bar${m.value<0?' negative':''}" style="height:${h}px" title="Income: ${formatAmount(m.income||0)}\nExpense: ${formatAmount(m.expense||0)}">
      <span class="bar-value">${m.value<0?"":"+"}${Math.round(m.value)}</span>
      <span class="bar-label">${m.label.slice(5,7)}/${m.label.slice(2,4)}</span>
    </div>`;
  });
  html += `</div>`;
  container.innerHTML = html;
}
function drawMainChart(inc, exp) {
  const container = document.getElementById("mainChart");
  container.innerHTML = "";
  if (!inc && !exp) {
    container.innerHTML = '<div style="color:#aaa;text-align:center;margin-top:10px">No data</div>';
    return;
  }
  const total = inc+exp;
  const incFrac = inc/total;
  const expFrac = exp/total;
  const r = 54, c = 2*Math.PI*r, svgsize = 2*r+22;
  let svg = `<svg width="${svgsize}" height="${svgsize}" class="pie-chart" viewBox="0 0 ${svgsize} ${svgsize}" style="display:block;margin:auto;">
    <circle r="${r}" cx="${svgsize/2}" cy="${svgsize/2}" fill="transparent" stroke="#e74c3c" stroke-width="28"
      stroke-dasharray="${expFrac*c} ${c-expFrac*c}" stroke-dashoffset="0"
      style="transition:stroke-dasharray .7s cubic-bezier(.42,.01,.58,1.02)"/>
    <circle r="${r}" cx="${svgsize/2}" cy="${svgsize/2}" fill="transparent" stroke="#2ecc71" stroke-width="28"
      stroke-dasharray="${incFrac*c} ${c-incFrac*c}" stroke-dashoffset="${-expFrac*c}"
      style="transition:stroke-dasharray .7s cubic-bezier(.42,.01,.58,1.02)"/>
  </svg>
  <div style="display:flex;justify-content:center;gap:18px;font-size:1rem;margin-top:0;">
    <span style="color:#2ecc71;font-weight:600">Income</span>
    <span style="color:#e74c3c;font-weight:600">Expense</span>
  </div>`;
  container.innerHTML = svg;
}
function openEditModal(entry) {
  editingId = entry.id;
  const modal = $("#editModal");
  modal.innerHTML = `<div class="modal-content">
    <button class="close-btn" id="closeEditModal">&times;</button>
    <h2>Edit Entry</h2>
    <form id="editForm" autocomplete="off">
      <label>Date:<input type="date" id="editDate" required value="${entry.date}" class="settings-input"></label>
      <label>Description:<input type="text" id="editDesc" maxlength="32" required value="${entry.desc}" class="settings-input"></label>
      <label>Amount:<input type="number" id="editAmount" step="0.01" required value="${entry.amount}" class="settings-input"></label>
      <label>Category:
        <select id="editCategory" required class="settings-input">
          ${categories.map(c=>`<option value="${c}"${c===entry.category?" selected":""}>${c}</option>`).join("")}
        </select>
      </label>
      <label>Type:
        <select id="editType" required class="settings-input">
          <option value="income"${entry.type==="income"?" selected":""}>Income</option>
          <option value="expense"${entry.type==="expense"?" selected":""}>Expense</option>
        </select>
      </label>
      <label>Note:<input type="text" id="editNote" maxlength="64" value="${entry.note||""}" class="settings-input"></label>
      <div class="modal-actions" style="display:flex;justify-content:space-between;margin-top:22px;">
        <button type="submit" class="settings-btn">Save</button>
        <button type="button" id="cancelEdit" class="danger settings-btn">Cancel</button>
      </div>
    </form>
  </div>`;
  modal.classList.add("active");
  modal.style.display = "flex";
  $("#editForm").onsubmit = function(ev) {
    ev.preventDefault();
    const idx = entries.findIndex(e=>e.id===editingId);
    if (idx>-1) {
      entries[idx] = {
        id: editingId,
        date: $("#editDate").value,
        desc: $("#editDesc").value.trim(),
        amount: $("#editAmount").value,
        category: $("#editCategory").value,
        type: $("#editType").value,
        note: $("#editNote").value.trim()
      };
      saveData();
      renderAll();
      closeEditModal();
      checkLimits(true, entries[idx]);
      showToast("Entry updated!","var(--accent2)");
    }
  };
  $("#closeEditModal").onclick = closeEditModal;
  $("#cancelEdit").onclick = closeEditModal;
}
function closeEditModal() {
  $("#editModal").classList.remove("active");
  $("#editModal").innerHTML = "";
  $("#editModal").style.display = "none";
  editingId = null;
}
function closeSettingsModal() {
  $("#settingsModal").classList.remove("active");
}
