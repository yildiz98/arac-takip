const STORE_KEY = "hickorkmaz_garaj_v7_data";

const seed = {
  customers: [
    { id:"c_demo_1", name:"Ahmet Yılmaz", phone:"0533 000 00 00", type:"Şahıs", note:"Örnek müşteri" },
    { id:"c_demo_2", name:"ABC Lojistik Ltd.", phone:"0542 111 11 11", type:"Firma", note:"Örnek firma / filo" }
  ],
  vehicles: [
    { id:"v_demo_1", customerId:"c_demo_1", plate:"33 ABC 123", brand:"Ford", model:"Transit", year:"2018", note:"" },
    { id:"v_demo_2", customerId:"c_demo_1", plate:"33 DEF 456", brand:"Fiat", model:"Doblo", year:"2020", note:"" },
    { id:"v_demo_3", customerId:"c_demo_2", plate:"33 FİL 001", brand:"Mercedes", model:"Sprinter", year:"2021", note:"Şirket aracı" }
  ],
  services: [
    { id:"s_demo_1", vehicleId:"v_demo_1", date:"2026-06-09", title:"Yağ bakımı", amount:5000, nextDate:"2026-09-09", note:"Yağ + filtre değişti" },
    { id:"s_demo_2", vehicleId:"v_demo_2", date:"2026-06-01", title:"Fren bakımı", amount:2500, nextDate:"2026-08-01", note:"Balata değişti" },
    { id:"s_demo_3", vehicleId:"v_demo_3", date:"2026-05-28", title:"Genel bakım", amount:12000, nextDate:"2026-07-28", note:"Filo bakım kaydı" }
  ],
  payments: [
    { id:"p_demo_1", customerId:"c_demo_1", vehicleId:"v_demo_1", date:"2026-06-09", amount:2000, note:"Nakit ödeme" },
    { id:"p_demo_2", customerId:"c_demo_2", vehicleId:"v_demo_3", date:"2026-06-09", amount:5000, note:"Kısmi tahsilat" }
  ]
};

let db = loadData();
let lastPageBeforeDetail = "dashboard";

function loadData(){
  const raw = localStorage.getItem(STORE_KEY);
  if(!raw){
    localStorage.setItem(STORE_KEY, JSON.stringify(seed));
    return structuredClone(seed);
  }
  try{
    const parsed = JSON.parse(raw);
    return {
      customers: parsed.customers || [],
      vehicles: parsed.vehicles || [],
      services: parsed.services || [],
      payments: parsed.payments || []
    };
  }catch(e){
    return structuredClone(seed);
  }
}
function persist(){
  localStorage.setItem(STORE_KEY, JSON.stringify(db));
  render();
}
function newId(prefix){ return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,7); }
function money(n){ return (Number(n)||0).toLocaleString("tr-TR", {maximumFractionDigits:0}) + " TL"; }
function today(){ return new Date().toISOString().slice(0,10); }
function safe(v){ return (v ?? "").toString(); }
function norm(v){ return safe(v).toLocaleLowerCase("tr-TR").replace(/\s+/g," ").trim(); }

function getCustomer(id){ return db.customers.find(x=>x.id===id); }
function getVehicle(id){ return db.vehicles.find(x=>x.id===id); }
function getVehiclesByCustomer(customerId){ return db.vehicles.filter(x=>x.customerId===customerId); }
function getServicesByVehicle(vehicleId){ return db.services.filter(x=>x.vehicleId===vehicleId).sort((a,b)=>safe(b.date).localeCompare(safe(a.date))); }
function getPaymentsByVehicle(vehicleId){ return db.payments.filter(x=>x.vehicleId===vehicleId).sort((a,b)=>safe(b.date).localeCompare(safe(a.date))); }
function vehicleTotal(vehicleId){ return getServicesByVehicle(vehicleId).reduce((t,x)=>t+Number(x.amount||0),0); }
function vehiclePaid(vehicleId){ return getPaymentsByVehicle(vehicleId).reduce((t,x)=>t+Number(x.amount||0),0); }
function vehicleDebt(vehicleId){ return vehicleTotal(vehicleId)-vehiclePaid(vehicleId); }
function customerTotal(customerId){ return getVehiclesByCustomer(customerId).reduce((t,v)=>t+vehicleTotal(v.id),0); }
function customerPaid(customerId){ return getVehiclesByCustomer(customerId).reduce((t,v)=>t+vehiclePaid(v.id),0); }
function customerDebt(customerId){ return customerTotal(customerId)-customerPaid(customerId); }
function lastServiceDate(vehicleId){ return getServicesByVehicle(vehicleId)[0]?.date || "-"; }

const pages = {
  dashboard:"Dashboard",
  customers:"Müşteriler / Firmalar",
  vehicles:"Araçlar",
  services:"Servis Kayıtları",
  payments:"Tahsilatlar",
  debts:"Borç Takibi",
  reports:"Raporlar",
  settings:"Ayarlar",
  detail:"Detay"
};

document.querySelectorAll(".menu-item").forEach(btn => {
  btn.addEventListener("click", () => openPage(btn.dataset.page));
});

function openPage(page){
  if(page !== "detail") lastPageBeforeDetail = page;
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById(page).classList.add("active");
  document.querySelectorAll(".menu-item").forEach(b=>b.classList.toggle("active", b.dataset.page===page));
  document.getElementById("pageTitle").textContent = pages[page] || "Dashboard";
  document.getElementById("pageSubtitle").textContent = "Her ekranda isim, firma veya plaka ile global arama";
  clearSearchOnly();
  render();
}

function stat(label,value,cls=""){
  return `<div class="card"><div class="label">${label}</div><div class="value ${cls}">${value}</div></div>`;
}

function render(){
  renderDashboard(); renderCustomers(); renderVehicles(); renderServices(); renderPayments(); renderDebts(); renderReports(); renderSettings();
}

function renderDashboard(){
  const totalRevenue = db.services.reduce((t,s)=>t+Number(s.amount||0),0);
  const totalPaid = db.payments.reduce((t,p)=>t+Number(p.amount||0),0);
  const totalDebt = totalRevenue - totalPaid;
  const todayPaid = db.payments.filter(p=>p.date===today()).reduce((t,p)=>t+Number(p.amount||0),0);
  const recentServices = db.services.slice().sort((a,b)=>safe(b.date).localeCompare(safe(a.date))).slice(0,8);
  const upcoming = db.services.filter(s=>s.nextDate).sort((a,b)=>safe(a.nextDate).localeCompare(safe(b.nextDate))).slice(0,8);

  document.getElementById("dashboard").innerHTML = `
    <div class="grid stats">
      ${stat("Toplam Araç", db.vehicles.length)}
      ${stat("Toplam Müşteri/Firma", db.customers.length)}
      ${stat("Toplam Alacak", money(totalDebt), totalDebt>0?"bad":"good")}
      ${stat("Toplam Ciro", money(totalRevenue))}
      ${stat("Bugünkü Tahsilat", money(todayPaid), "good")}
    </div>
    <div class="grid two">
      <div class="panel"><div class="panel-head"><h3>Son Servis Kayıtları</h3><button class="small-btn" onclick="openPage('services')">Tümü</button></div>${servicesTable(recentServices)}</div>
      <div>
        <div class="panel"><div class="panel-head"><h3>Alacaklı Müşteriler</h3><button class="small-btn" onclick="openPage('debts')">Borç Takibi</button></div>${customerDebtTable(true)}</div>
        <div class="panel"><div class="panel-head"><h3>Yaklaşan Bakım / Kontrol</h3></div>${upcomingTable(upcoming)}</div>
      </div>
    </div>`;
}
function renderCustomers(){
  document.getElementById("customers").innerHTML = `<div class="panel"><div class="panel-head"><h3>Müşteri / Firma Kartları</h3><button class="small-btn" onclick="openModal('customer')">+ Yeni</button></div>${customersTable(db.customers)}</div>`;
}
function renderVehicles(){
  document.getElementById("vehicles").innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>Araç Kartları</h3><button class="small-btn" onclick="openModal('vehicle')">+ Yeni</button></div>
      <div class="toolbar"><input id="vehicleFilter" placeholder="Plakaya göre hızlı erişim..." oninput="filterVehicles(this.value)" /></div>
      <div id="vehicleList">${vehiclesTable(db.vehicles)}</div>
    </div>`;
}
window.filterVehicles = function(q){
  const list = db.vehicles.filter(v => norm(v.plate).includes(norm(q)) || norm(`${v.brand} ${v.model} ${getCustomer(v.customerId)?.name}`).includes(norm(q)));
  document.getElementById("vehicleList").innerHTML = vehiclesTable(list);
}
function renderServices(){
  document.getElementById("services").innerHTML = `
    <div class="panel">
      <div class="panel-head"><h3>Servis Geçmişi</h3><button class="small-btn" onclick="openModal('service')">+ Yeni</button></div>
      <div class="toolbar">
        <input id="serviceDateFilter" type="date" onchange="filterServices()" />
        <input id="serviceTextFilter" placeholder="İsim / firma / plaka / işlem ara..." oninput="filterServices()" />
      </div>
      <div id="serviceList">${servicesTable(db.services.slice().sort((a,b)=>safe(b.date).localeCompare(safe(a.date))))}</div>
    </div>`;
}
window.filterServices = function(){
  const date = document.getElementById("serviceDateFilter")?.value || "";
  const txt = norm(document.getElementById("serviceTextFilter")?.value || "");
  let list = db.services.filter(s=>{
    const v = getVehicle(s.vehicleId);
    const c = getCustomer(v?.customerId);
    return (!date || s.date === date) && (!txt || norm(`${s.title} ${s.note} ${v?.plate} ${c?.name}`).includes(txt));
  }).sort((a,b)=>safe(b.date).localeCompare(safe(a.date)));
  document.getElementById("serviceList").innerHTML = servicesTable(list);
}
function renderPayments(){
  document.getElementById("payments").innerHTML = `<div class="panel"><div class="panel-head"><h3>Günlük Tahsilat Takibi</h3><button class="small-btn" onclick="openModal('payment')">+ Yeni</button></div>
    <div class="grid three">${stat("Bugünkü Tahsilat", money(db.payments.filter(p=>p.date===today()).reduce((t,p)=>t+Number(p.amount||0),0)), "good")}${stat("Toplam Tahsilat", money(db.payments.reduce((t,p)=>t+Number(p.amount||0),0)), "good")}${stat("Tahsilat Kaydı", db.payments.length)}</div><br>
    ${paymentsTable(db.payments.slice().sort((a,b)=>safe(b.date).localeCompare(safe(a.date))))}</div>`;
}
function renderDebts(){
  document.getElementById("debts").innerHTML = `<div class="grid two"><div class="panel"><div class="panel-head"><h3>Müşteri/Firma Toplam Borcu</h3></div>${customerDebtTable(false)}</div><div class="panel"><div class="panel-head"><h3>Plaka Bazlı Borç</h3></div>${vehiclesTable(db.vehicles.filter(v=>vehicleDebt(v.id)>0))}</div></div>`;
}
function renderReports(){
  const debtors = db.customers.filter(c=>customerDebt(c.id)>0).length;
  const avgDebt = db.vehicles.length ? db.vehicles.reduce((t,v)=>t+vehicleDebt(v.id),0)/db.vehicles.length : 0;
  document.getElementById("reports").innerHTML = `<div class="grid stats">${stat("Borçlu Müşteri/Firma", debtors)}${stat("Servis Kaydı", db.services.length)}${stat("Tahsilat Kaydı", db.payments.length)}${stat("Ortalama Plaka Borcu", money(avgDebt))}${stat("Bugünkü Servis", db.services.filter(s=>s.date===today()).length)}</div><div class="panel"><h3>Genel Plaka Raporu</h3>${vehiclesTable(db.vehicles)}</div>`;
}
function renderSettings(){
  document.getElementById("settings").innerHTML = `
    <div class="panel">
      <h3>Ayarlar</h3>
      <p class="notice">Veriler tarayıcı hafızasında saklanır. GitHub'a yeni dosya yüklemek mevcut kayıtları silmez. Yine de düzenli yedek al.</p>
      <div class="toolbar">
        <button class="btn" onclick="exportData()">Verileri Yedekle</button>
        <button class="btn" onclick="document.getElementById('importFile').click()">Yedekten Yükle</button>
        <input id="importFile" class="hidden" type="file" accept="application/json" onchange="importData(event)" />
        <button class="btn ghost" onclick="clearDemo()">Örnek Kayıtları Temizle</button>
      </div>
    </div>`;
}

function customersTable(list){
  return `<div class="table-wrap"><table><thead><tr><th>Ad Soyad / Firma</th><th>Telefon</th><th>Tür</th><th>Araç Sayısı</th><th>Toplam Borç</th><th>Toplam Ödeme</th><th>İşlem</th></tr></thead><tbody>
  ${list.map(c=>`<tr><td><b>${c.name}</b></td><td>${c.phone || "-"}</td><td>${c.type || "-"}</td><td>${getVehiclesByCustomer(c.id).length}</td><td class="amount ${customerDebt(c.id)>0?"bad":"good"}">${money(customerDebt(c.id))}</td><td class="amount good">${money(customerPaid(c.id))}</td><td><button class="small-btn" onclick="openCustomer('${c.id}')">Detay</button></td></tr>`).join("") || emptyRow(7)}
  </tbody></table></div>`;
}
function vehiclesTable(list){
  return `<div class="table-wrap"><table><thead><tr><th>Plaka</th><th>Sahibi / Firma</th><th>Araç</th><th>Son Servis</th><th>Plaka Borcu</th><th>Not</th><th>İşlem</th></tr></thead><tbody>
  ${list.map(v=>`<tr><td><b>${v.plate}</b></td><td>${getCustomer(v.customerId)?.name || "-"}</td><td>${[v.brand,v.model,v.year].filter(Boolean).join(" ") || "-"}</td><td>${lastServiceDate(v.id)}</td><td class="amount ${vehicleDebt(v.id)>0?"bad":"good"}">${money(vehicleDebt(v.id))}</td><td>${v.note || "-"}</td><td><button class="small-btn" onclick="openVehicle('${v.id}')">Geçmişi Gör</button></td></tr>`).join("") || emptyRow(7)}
  </tbody></table></div>`;
}
function servicesTable(list){
  return `<div class="table-wrap"><table><thead><tr><th>Tarih</th><th>Plaka</th><th>Müşteri/Firma</th><th>İşlem</th><th>Tutar</th><th>Sonraki Kontrol</th><th>Not</th></tr></thead><tbody>
  ${list.map(s=>{const v=getVehicle(s.vehicleId); const c=getCustomer(v?.customerId); return `<tr><td>${s.date || "-"}</td><td>${v ? `<button class="small-btn" onclick="openVehicle('${v.id}')">${v.plate}</button>` : "-"}</td><td>${c?.name || "-"}</td><td>${s.title || "-"}</td><td class="amount">${money(s.amount)}</td><td>${s.nextDate || "-"}</td><td>${s.note || "-"}</td></tr>`}).join("") || emptyRow(7)}
  </tbody></table></div>`;
}
function paymentsTable(list){
  return `<div class="table-wrap"><table><thead><tr><th>Tarih</th><th>Müşteri/Firma</th><th>Plaka</th><th>Tutar</th><th>Not</th></tr></thead><tbody>
  ${list.map(p=>{const v=getVehicle(p.vehicleId); const c=getCustomer(p.customerId); return `<tr><td>${p.date || "-"}</td><td>${c?.name || "-"}</td><td>${v?.plate || "-"}</td><td class="amount good">${money(p.amount)}</td><td>${p.note || "-"}</td></tr>`}).join("") || emptyRow(5)}
  </tbody></table></div>`;
}
function customerDebtTable(onlyDebt){
  let list = db.customers.map(c=>({ ...c, debt: customerDebt(c.id), count:getVehiclesByCustomer(c.id).length }));
  if(onlyDebt) list = list.filter(c=>c.debt>0).slice(0,8);
  return `<div class="table-wrap"><table><thead><tr><th>Müşteri/Firma</th><th>Araç</th><th>Toplam Borç</th><th>İşlem</th></tr></thead><tbody>
  ${list.map(c=>`<tr><td><b>${c.name}</b></td><td>${c.count}</td><td class="amount ${c.debt>0?"bad":"good"}">${money(c.debt)}</td><td><button class="small-btn" onclick="openCustomer('${c.id}')">Araçları Gör</button></td></tr>`).join("") || emptyRow(4)}
  </tbody></table></div>`;
}
function upcomingTable(list){
  return `<div class="table-wrap"><table><thead><tr><th>Tarih</th><th>Plaka</th><th>İşlem</th></tr></thead><tbody>
  ${list.map(s=>{const v=getVehicle(s.vehicleId); return `<tr><td>${s.nextDate}</td><td>${v?.plate || "-"}</td><td>${s.title || "-"}</td></tr>`}).join("") || emptyRow(3)}
  </tbody></table></div>`;
}
function emptyRow(cols){ return `<tr><td colspan="${cols}" style="color:var(--muted)">Kayıt bulunamadı.</td></tr>`; }

window.openCustomer = function(customerId){
  const c = getCustomer(customerId); if(!c) return;
  const vehicles = getVehiclesByCustomer(customerId);
  document.getElementById("detail").innerHTML = `
    <div class="detail-title"><div><span class="badge">Müşteri / Firma Kartı</span><h2>${c.name}</h2><p>${c.phone || "-"} ${c.note ? " • " + c.note : ""}</p></div><button class="btn" onclick="openPage('${lastPageBeforeDetail}')">Geri</button></div>
    <div class="customer-card">
      <div class="info-box"><span>Ad soyad / firma adı</span><b>${c.name}</b></div><div class="info-box"><span>Telefon</span><b>${c.phone || "-"}</b></div><div class="info-box"><span>Araç sayısı</span><b>${vehicles.length}</b></div>
      <div class="info-box"><span>Toplam borç</span><b class="${customerDebt(c.id)>0?"bad":"good"}">${money(customerDebt(c.id))}</b></div><div class="info-box"><span>Toplam ödeme</span><b class="good">${money(customerPaid(c.id))}</b></div><div class="info-box"><span>Toplam işlem tutarı</span><b>${money(customerTotal(c.id))}</b></div>
    </div>
    <div class="panel"><div class="panel-head"><h3>Kayıtlı Araçlar</h3></div>${vehiclesTable(vehicles)}</div>`;
  openPage("detail");
};

window.openVehicle = function(vehicleId){
  const v = getVehicle(vehicleId); if(!v) return;
  const c = getCustomer(v.customerId);
  document.getElementById("detail").innerHTML = `
    <div class="detail-title">
      <div><span class="badge">Araç Kartı / Plaka Geçmişi</span><h2>${v.plate}</h2><p>${c?.name || "-"} • ${[v.brand,v.model,v.year].filter(Boolean).join(" ") || "-"}</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn primary" onclick="openCustomer('${v.customerId}')">Bu müşterinin tüm araçlarını göster</button>
        <button class="btn" onclick="openPage('${lastPageBeforeDetail}')">Geri</button>
      </div>
    </div>
    <div class="customer-card">
      <div class="info-box"><span>Plaka</span><b>${v.plate}</b></div><div class="info-box"><span>Sahibi / Firma</span><b>${c?.name || "-"}</b></div><div class="info-box"><span>Marka model</span><b>${[v.brand,v.model,v.year].filter(Boolean).join(" ") || "-"}</b></div>
      <div class="info-box"><span>Toplam borç</span><b class="${vehicleDebt(v.id)>0?"bad":"good"}">${money(vehicleDebt(v.id))}</b></div><div class="info-box"><span>Toplam işlem</span><b>${money(vehicleTotal(v.id))}</b></div><div class="info-box"><span>Toplam tahsilat</span><b class="good">${money(vehiclePaid(v.id))}</b></div>
    </div>
    <div class="grid two"><div class="panel"><h3>Servis Geçmişi</h3>${servicesTable(getServicesByVehicle(v.id))}</div><div class="panel"><h3>Tahsilat Geçmişi</h3>${paymentsTable(getPaymentsByVehicle(v.id))}</div></div>
    <div class="panel"><h3>Notlar</h3><p class="notice">${v.note || "Bu plakaya ait not bulunmuyor."}</p></div>`;
  openPage("detail");
};

// GLOBAL ARAMA: Her sayfada çalışır, detail sayfası dahil.
const searchInput = document.getElementById("globalSearch");
const searchResults = document.getElementById("searchResults");

searchInput.addEventListener("input", function(){
  const q = norm(this.value);
  if(q.length < 2){ searchResults.classList.add("hidden"); return; }

  const customerMatches = db.customers.filter(c => norm(`${c.name} ${c.phone} ${c.type} ${c.note}`).includes(q));
  const vehicleMatches = db.vehicles.filter(v => {
    const c = getCustomer(v.customerId);
    return norm(`${v.plate} ${v.brand} ${v.model} ${v.year} ${v.note} ${c?.name} ${c?.phone}`).includes(q);
  });

  let html = "";
  if(customerMatches.length){
    html += `<div class="search-title">Müşteri / Firma Sonuçları</div>`;
    html += customerMatches.map(c=>{
      const count = getVehiclesByCustomer(c.id).length;
      return `<div class="search-row" onclick="openCustomer('${c.id}')"><b>👤 ${c.name}</b><span>${count} kayıtlı plaka • toplam borç: ${money(customerDebt(c.id))}</span></div>`;
    }).join("");
  }
  if(vehicleMatches.length){
    html += `<div class="search-title">Plaka Sonuçları</div>`;
    html += vehicleMatches.map(v=>{
      const c = getCustomer(v.customerId);
      return `<div class="search-row" onclick="openVehicle('${v.id}')"><b>🚗 ${v.plate}</b><span>${c?.name || "-"} • direkt araç geçmişi açılır</span></div>`;
    }).join("");
  }
  if(!html) html = `<div class="search-row"><b>Sonuç bulunamadı</b><span>İsim, firma adı veya plakayı farklı yazmayı deneyin.</span></div>`;
  searchResults.innerHTML = html;
  searchResults.classList.remove("hidden");
});
function clearSearchOnly(){ searchInput.value=""; searchResults.classList.add("hidden"); }

document.addEventListener("click", (e)=>{
  if(!e.target.closest(".search-area")) searchResults.classList.add("hidden");
});

document.getElementById("btnCustomer").onclick = () => openModal("customer");
document.getElementById("btnVehicle").onclick = () => openModal("vehicle");
document.getElementById("btnService").onclick = () => openModal("service");
document.getElementById("btnPayment").onclick = () => openModal("payment");
document.getElementById("closeModal").onclick = () => modal.close();
document.getElementById("cancelModal").onclick = () => modal.close();

const modal = document.getElementById("modal");
const modalForm = document.getElementById("modalForm");
let modalType = null;

function field(label,name,type="text",value="",required=true){ return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${value}" ${required?"required":""}></div>`; }
function selectField(label,name,options){ return `<div class="field"><label>${label}</label><select name="${name}" required>${options}</select></div>`; }
function textareaField(label,name){ return `<div class="field"><label>${label}</label><textarea name="${name}"></textarea></div>`; }

window.openModal = function(type){
  modalType = type;
  const titleMap = {customer:"Müşteri/Firma Ekle", vehicle:"Araç Ekle", service:"Servis Kaydı Ekle", payment:"Tahsilat Ekle"};
  document.getElementById("modalTitle").textContent = titleMap[type];

  const customerOptions = db.customers.map(c=>`<option value="${c.id}">${c.name}</option>`).join("");
  const vehicleOptions = db.vehicles.map(v=>`<option value="${v.id}">${v.plate} - ${getCustomer(v.customerId)?.name || ""}</option>`).join("");

  if(type === "customer"){
    document.getElementById("modalBody").innerHTML = `${field("Ad Soyad / Firma Adı","name")}${field("Telefon","phone","text","",false)}${selectField("Tür","type","<option>Şahıs</option><option>Firma</option>")}${textareaField("Not","note")}`;
  }
  if(type === "vehicle"){
    document.getElementById("modalBody").innerHTML = `${selectField("Sahibi / Firma","customerId",customerOptions)}${field("Plaka","plate")}${field("Marka","brand","text","",false)}${field("Model","model","text","",false)}${field("Yıl","year","number","",false)}${textareaField("Araç Notu","note")}`;
  }
  if(type === "service"){
    document.getElementById("modalBody").innerHTML = `${selectField("Plaka","vehicleId",vehicleOptions)}${field("Servis Tarihi","date","date",today())}${field("İşlem / Bakım Başlığı","title")}${field("Tutar","amount","number")}${field("Sonraki Bakım / Kontrol Tarihi","nextDate","date","",false)}${textareaField("Not","note")}`;
  }
  if(type === "payment"){
    document.getElementById("modalBody").innerHTML = `${selectField("Plaka","vehicleId",vehicleOptions)}${field("Tahsilat Tarihi","date","date",today())}${field("Tutar","amount","number")}${textareaField("Not","note")}`;
  }
  modal.showModal();
};

modalForm.addEventListener("submit", function(e){
  e.preventDefault();
  const fd = new FormData(modalForm);
  const obj = Object.fromEntries(fd.entries());

  if(modalType === "customer") db.customers.push({ id:newId("c"), name:obj.name, phone:obj.phone, type:obj.type, note:obj.note });
  if(modalType === "vehicle") db.vehicles.push({ id:newId("v"), customerId:obj.customerId, plate:safe(obj.plate).toLocaleUpperCase("tr-TR"), brand:obj.brand, model:obj.model, year:obj.year, note:obj.note });
  if(modalType === "service") db.services.push({ id:newId("s"), vehicleId:obj.vehicleId, date:obj.date, title:obj.title, amount:Number(obj.amount||0), nextDate:obj.nextDate, note:obj.note });
  if(modalType === "payment"){
    const v = getVehicle(obj.vehicleId);
    db.payments.push({ id:newId("p"), customerId:v?.customerId, vehicleId:obj.vehicleId, date:obj.date, amount:Number(obj.amount||0), note:obj.note });
  }

  modal.close();
  persist();
});

window.exportData = function(){
  const blob = new Blob([JSON.stringify(db,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "hickorkmaz-garaj-v7-yedek.json"; a.click();
  URL.revokeObjectURL(url);
};
window.importData = function(event){
  const file = event.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const imported = JSON.parse(reader.result);
      if(!imported.customers || !imported.vehicles || !imported.services || !imported.payments) throw new Error("format");
      db = imported; persist(); alert("Yedek başarıyla yüklendi.");
    }catch(e){ alert("Yedek dosyası okunamadı."); }
  };
  reader.readAsText(file);
};
window.clearDemo = function(){
  db.customers = db.customers.filter(x=>!x.id.includes("_demo_"));
  db.vehicles = db.vehicles.filter(x=>!x.id.includes("_demo_"));
  db.services = db.services.filter(x=>!x.id.includes("_demo_"));
  db.payments = db.payments.filter(x=>!x.id.includes("_demo_"));
  persist();
};

render();
