import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { firebaseConfig, ADMIN_EMAILS, PERSONEL_EMAILS } from "./firebase-config.js";

const STORE_KEY = "hickorkmaz_garaj_v7_data";
const AUTH_KEY = "hickorkmaz_garaj_v7_google_auth";

const DELETE_PASSWORD = "212198";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
let activeUser = null;

function normalizeEmail(email){
  return (email || "").toLocaleLowerCase("tr-TR").trim();
}

function getRoleForEmail(email){
  const e = normalizeEmail(email);
  const admins = (ADMIN_EMAILS || []).map(normalizeEmail);
  const personnel = (PERSONEL_EMAILS || []).map(normalizeEmail);

  if(admins.includes(e)) return { role:"admin", label:"Admin" };
  if(personnel.includes(e)) return { role:"personel", label:"Personel" };
  return null;
}

function isAdmin(){ return activeUser?.role === "admin"; }
function isPersonel(){ return activeUser?.role === "personel"; }

const seed = {
  customers: [],
  vehicles: [],
  services: [],
  payments: []
};

let db = loadData();
let lastPageBeforeDetail = "dashboard";

const SERVICE_ITEMS = [
  "Motor Yağı",
  "Yağ Filtresi",
  "Hava Filtresi",
  "Polen Filtresi",
  "Yakıt / Mazot Filtresi",
  "Ön Balata",
  "Arka Balata",
  "Fren Diski",
  "Fren Hidroliği",
  "Antifriz",
  "Akü",
  "Buji",
  "Triger Seti",
  "Debriyaj",
  "Şanzıman Yağı",
  "Rot Balans",
  "Lastik",
  "Klima Gazı",
  "Genel Kontrol",
  "Elektrik Arıza",
  "Kaporta / Boya",
  "Diğer"
];

function serviceItemsText(s){
  if(Array.isArray(s.items) && s.items.length) return s.items.join(", ");
  return s.title || "-";
}

function serviceItemCheckboxes(){
  return `<div class="field"><label>Yapılan işlemler / parçalar</label>
    <div class="check-grid">
      ${SERVICE_ITEMS.map(item => `<label class="check-item"><input type="checkbox" name="items" value="${item}"><span>${item}</span></label>`).join("")}
    </div>
  </div>`;
}

function serviceTargetOptions(){
  return db.vehicles.map(v => {
    const c = getCustomer(v.customerId);
    const label = `${v.noPlateName ? v.noPlateName + " / " : ""}${v.plate} - ${c?.name || "-"} ${v.brand || ""} ${v.model || ""}`.trim();
    return `<option value="${v.id}">${label}</option>`;
  }).join("");
}

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
  setupAuth();
setupMobileMenu();
applyAuthState();
if(activeUser) render();
}
function newId(prefix){ return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,7); }
function money(n){ return (Number(n)||0).toLocaleString("tr-TR", {maximumFractionDigits:0}) + " TL"; }
function today(){ return new Date().toISOString().slice(0,10); }
function safe(v){ return (v ?? "").toString(); }
function norm(v){ return safe(v).toLocaleLowerCase("tr-TR").replace(/\s+/g," ").trim(); }

function getCustomer(id){ return db.customers.find(x=>x.id===id); }
function findCustomerByName(name){
  const target = norm(name);
  if(!target) return null;

  let found = db.customers.find(c => norm(c.name) === target);
  if(found) return found;

  const compact = target.replace(/\s+/g, "");
  found = db.customers.find(c => norm(c.name).replace(/\s+/g, "") === compact);
  if(found) return found;

  found = db.customers.find(c => {
    const cn = norm(c.name);
    return cn.includes(target) || target.includes(cn);
  });
  if(found) return found;

  return null;
}
function findOrCreateCustomerByName(name, phone=""){
  const cleanName = safe(name).trim();
  let found = findCustomerByName(cleanName);
  if(found) return found;

  const created = {
    id:newId("c"),
    name:cleanName,
    phone:phone || "",
    type:"Şahıs/Firma",
    note:"Kayıt sırasında otomatik oluşturuldu"
  };
  db.customers.push(created);
  return created;
}
function getVehicle(id){ return db.vehicles.find(x=>x.id===id); }
function normalizePlate(plate){
  return safe(plate).toLocaleUpperCase("tr-TR").replace(/\s+/g,"").trim();
}
function findVehicleByPlate(plate){
  const target = normalizePlate(plate);
  if(!target) return null;
  return db.vehicles.find(v => normalizePlate(v.plate) === target || normalizePlate(v.noPlateName) === target);
}

function findServiceTarget(query){
  const q = norm(query);
  const qp = normalizePlate(query);
  if(!q) return { status:"empty", vehicles:[] };

  const exactVehicle = db.vehicles.find(v =>
    normalizePlate(v.plate) === qp ||
    normalizePlate(v.noPlateName) === qp
  );
  if(exactVehicle) return { status:"single", vehicle:exactVehicle, vehicles:[exactVehicle] };

  const matchingVehicles = db.vehicles.filter(v => {
    const c = getCustomer(v.customerId);
    return norm(`${v.plate} ${v.noPlateName} ${v.brand} ${v.model} ${c?.name} ${c?.phone}`).includes(q);
  });

  if(matchingVehicles.length === 1) return { status:"single", vehicle:matchingVehicles[0], vehicles:matchingVehicles };
  if(matchingVehicles.length > 1) return { status:"multiple", vehicles:matchingVehicles };

  const matchingCustomers = db.customers.filter(c => norm(`${c.name} ${c.phone} ${c.type}`).includes(q));
  const customerVehicles = matchingCustomers.flatMap(c => getVehiclesByCustomer(c.id));

  if(customerVehicles.length === 1) return { status:"single", vehicle:customerVehicles[0], vehicles:customerVehicles };
  if(customerVehicles.length > 1) return { status:"multiple", vehicles:customerVehicles };

  return { status:"none", vehicles:[] };
}
function getVehiclesByCustomer(customerId){ return db.vehicles.filter(x=>x.customerId===customerId); }
function getServicesByVehicle(vehicleId){ return db.services.filter(x=>x.vehicleId===vehicleId).sort((a,b)=>safe(b.date).localeCompare(safe(a.date))); }
function getPaymentsByVehicle(vehicleId){ return db.payments.filter(x=>x.vehicleId===vehicleId).sort((a,b)=>safe(b.date).localeCompare(safe(a.date))); }
function vehicleTotal(vehicleId){ return getServicesByVehicle(vehicleId).reduce((t,x)=>t+Number(x.amount||0),0); }





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
}

function vehiclePaid(vehicleId){
  // Sadece araç plakasına işlenen tahsilatlar araç borcundan düşer.
  return db.payments
    .filter(p => p.vehicleId === vehicleId)
    .reduce((t,p)=>t+Number(p.amount||0),0);
}

function vehicleDebt(vehicleId){
  return vehicleTotal(vehicleId)-vehiclePaid(vehicleId);
}

function customerPaid(customerId){
  return db.payments
    .filter(p => p.customerId === customerId)
    .reduce((t,p)=>t+Number(p.amount||0),0);
}

function customerDebt(customerId){
  return customerTotal(customerId)-customerPaid(customerId);
}






function paymentTypeText(p){
  if(p.paymentType === "vehicle_only") return "Sadece Araç";
  if(p.paymentType === "customer_only") return "Sadece Cari Hesap";
  if(p.paymentType === "vehicle_customer") return "Araç + Cari Hesap";
  return p.vehicleId ? "Sadece Araç" : "Sadece Cari Hesap";
}
;



function setupMobileMenu(){
  const btn = document.getElementById("mobileMenuBtn");
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("mobileOverlay");

  if(!btn || !sidebar || !overlay) return;

  const close = () => {
    sidebar.classList.remove("mobile-open");
    overlay.classList.remove("show");
  };

  btn.addEventListener("click", () => {
    sidebar.classList.toggle("mobile-open");
    overlay.classList.toggle("show");
  });

  overlay.addEventListener("click", close);

  document.querySelectorAll(".menu-item").forEach(item => {
    item.addEventListener("click", close);
  });
}

function applyAuthState(){
  const loginScreen = document.getElementById("loginScreen");
  const layout = document.querySelector(".layout");
  const quickActions = document.querySelector(".quick-actions");
  const userText = document.getElementById("activeUserText");

  if(!activeUser){
    if(loginScreen) loginScreen.classList.remove("hidden");
    if(layout) layout.classList.add("locked");
    if(quickActions) quickActions.classList.add("hidden");
    return;
  }

  if(loginScreen) loginScreen.classList.add("hidden");
  if(layout) layout.classList.remove("locked");
  if(quickActions) quickActions.classList.remove("hidden");

  if(userText){
    userText.textContent = `${activeUser.label}: ${activeUser.email}`;
  }

  document.body.dataset.role = activeUser.role;

  // Personel sadece müşteri/firma, araç ve servis kaydı görebilsin/kullanabilsin
  document.querySelectorAll('[data-page="dashboard"], [data-page="payments"], [data-page="debts"], [data-page="reports"], [data-page="settings"]').forEach(el => {
    el.style.display = activeUser.role === "admin" ? "" : "none";
  });

  // Personel ekranı yetkisiz sayfadaysa müşterilere al
  const activePage = document.querySelector(".page.active")?.id;
  if(activeUser.role !== "admin" && !["customers","vehicles","services","detail"].includes(activePage)){
    openPage("customers");
  }

  // Personel için bazı hızlı aksiyonları kapat
  const paymentBtn = document.getElementById("btnPayment");
  if(paymentBtn) paymentBtn.style.display = activeUser.role === "admin" ? "" : "none";
}

function setupAuth(){
  const form = document.getElementById("loginForm");
  const logoutBtn = document.getElementById("logoutBtn");
  const loginError = document.getElementById("loginError");

  function showLoginError(msg){
    if(loginError){
      loginError.textContent = msg;
      loginError.classList.remove("hidden");
    }else{
      alert(msg);
    }
  }

  if(form){
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;

      try{
        if(loginError) loginError.classList.add("hidden");
        await signInWithEmailAndPassword(auth, email, password);
      }catch(err){
        showLoginError("Giriş başarısız. E-posta veya şifre hatalı olabilir.");
      }
    });
  }

  onAuthStateChanged(auth, (user) => {
    if(!user){
      activeUser = null;
      applyAuthState();
      return;
    }

    const access = getRoleForEmail(user.email);
    if(!access){
      activeUser = null;
      signOut(auth);
      showLoginError(`${user.email} için yetki tanımlı değil. firebase-config.js içinde ADMIN_EMAILS veya PERSONEL_EMAILS listesine ekle.`);
      applyAuthState();
      return;
    }

    activeUser = {
      uid:user.uid,
      email:user.email,
      name:user.email,
      role:access.role,
      label:access.label
    };

    applyAuthState();
    render();
  });

  if(logoutBtn){
    logoutBtn.addEventListener("click", async () => {
      await signOut(auth);
      activeUser = null;
      applyAuthState();
    });
  }
}

function requireAdmin(){
  if(!activeUser || activeUser.role !== "admin"){
    alert("Bu işlem için admin yetkisi gerekir.");
    return false;
  }
  return true;
}

function requireRecordPermission(){
  if(!activeUser){
    alert("Giriş yapman gerekir.");
    return false;
  }
  return true;
}


document.querySelectorAll(".menu-item").forEach(btn => {
  btn.addEventListener("click", () => openPage(btn.dataset.page));
});

function openPage(page){
  if(!activeUser){
    applyAuthState();
    return;
  }
  if(activeUser.role !== "admin" && !["customers","vehicles","services","detail"].includes(page)){
    alert("Bu sayfa için admin yetkisi gerekir.");
    page = "customers";
  }
  if(page !== "detail") lastPageBeforeDetail = page;
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById(page).classList.add("active");
  document.querySelectorAll(".menu-item").forEach(b=>b.classList.toggle("active", b.dataset.page===page));
  document.getElementById("pageTitle").textContent = pages[page] || "Dashboard";
  document.getElementById("pageSubtitle").textContent = "Her ekranda isim, firma veya plaka ile global arama";
  clearSearchOnly();
  setupAuth();
setupMobileMenu();
applyAuthState();
if(activeUser) render();
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
  const upcoming = db.vehicles
    .filter(v => vehicleNextKm(v.id))
    .map(v => ({ vehicle:v, currentKm:vehicleLastKm(v.id), nextKm:vehicleNextKm(v.id), remaining:remainingKm(v.id) }))
    .sort((a,b)=>(a.remaining ?? 999999999)-(b.remaining ?? 999999999))
    .slice(0,8);

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
        <div class="panel"><div class="panel-head"><h3>Yaklaşan Bakım / KM Kontrol</h3></div>${upcomingTable(upcoming)}</div>
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
    return (!date || s.date === date) && (!txt || norm(`${s.title} ${serviceItemsText(s)} ${s.note} ${s.currentKm} ${s.nextKm} ${v?.plate} ${c?.name}`).includes(txt));
  }).sort((a,b)=>safe(b.date).localeCompare(safe(a.date)));
  document.getElementById("serviceList").innerHTML = servicesTable(list);
}
function renderPayments(){
  document.getElementById("payments").innerHTML = `<div class="panel"><div class="panel-head"><h3>Tahsilat Takibi</h3><button class="small-btn" onclick="openModal('payment')">+ Yeni</button></div>
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
      <p class="notice">Firebase e-posta/şifre girişi aktiftir. Admin ve personel e-posta listeleri <b>firebase-config.js</b> dosyasından düzenlenir.</p>
      <div class="toolbar">
        <button class="btn" onclick="exportData()">Verileri Yedekle</button>
        <button class="btn" onclick="document.getElementById('importFile').click()">Yedekten Yükle</button>
        <input id="importFile" class="hidden" type="file" accept="application/json" onchange="importData(event)" />
        <button class="btn ghost" onclick="clearDemo()">Örnek Kayıtları Temizle</button><button class="btn danger-btn" onclick="resetAllData()">Tüm Verileri Sıfırla</button>
      </div>
    </div>

    <div class="panel">
      <h3>Yetki Listesi</h3>
      <p class="notice">
        Admin tüm yetkilere sahiptir. Personel sadece müşteri/firma, araç ve servis kaydı yapabilir.
        Yetki vermek için ZIP içindeki <b>firebase-config.js</b> dosyasında ADMIN_EMAILS ve PERSONEL_EMAILS listelerini düzenle.
      </p>
      <pre class="code-box">ADMIN_EMAILS = ["admin@aractakip.com"]
PERSONEL_EMAILS = ["personel1@aractakip.com"]</pre>
    </div>`;
}

function customersTable(list){
  return `<div class="table-wrap"><table><thead><tr><th>Ad Soyad / Firma</th><th>Telefon</th><th>Tür</th><th>Araç Sayısı</th><th>Toplam Borç</th><th>Toplam Ödeme</th><th>İşlem</th></tr></thead><tbody>
  ${list.map(c=>`<tr><td><b>${c.name}</b></td><td>${c.phone || "-"}</td><td>${c.type || "-"}</td><td>${getVehiclesByCustomer(c.id).length}</td><td class="amount ${customerDebt(c.id)>0?"bad":"good"}">${money(customerDebt(c.id))}</td><td class="amount good">${money(customerPaid(c.id))}</td><td><button class="small-btn" onclick="openCustomer('${c.id}')">Detay</button></td></tr>`).join("") || emptyRow(7)}
  </tbody></table></div>`;
}
function vehiclesTable(list){
  return `<div class="table-wrap"><table><thead><tr><th>Plaka</th><th>Sahibi / Firma</th><th>Araç</th><th>Son Servis</th><th>Plaka Borcu</th><th>Not</th><th>İşlemi Yapan</th><th>İşlem</th></tr></thead><tbody>
  ${list.map(v=>`<tr><td><b>${v.noPlateName ? v.noPlateName + " / " + v.plate : v.plate}</b></td><td>${getCustomer(v.customerId)?.name || "-"}</td><td>${[v.brand,v.model,v.year].filter(Boolean).join(" ") || "-"}</td><td>${lastServiceDate(v.id)}</td><td class="amount ${vehicleDebt(v.id)>0?"bad":"good"}">${money(vehicleDebt(v.id))}</td><td>${v.note || "-"}</td><td>
      <button class="small-btn" onclick="openVehicle('${v.id}')">Geçmişi Gör</button>
      ${isAdmin() ? `<button class="small-btn" onclick="printServiceHistory('${v.id}')">Yazdır</button>
      <button class="small-btn" onclick="shareServiceHistoryWhatsApp('${v.id}')">WP</button>` : ``}
    </td></tr>`).join("") || emptyRow(7)}
  </tbody></table></div>`;
}
function servicesTable(list){
  return `<div class="table-wrap"><table><thead><tr><th>Tarih</th><th>Plaka</th><th>Müşteri/Firma</th><th>Geldiği KM</th><th>Sonraki Bakım KM</th><th>Seçilen İşlemler</th><th>İşçilik</th><th>Parça</th><th>Toplam</th><th>Not</th><th>İşlemi Yapan</th><th>İşlem</th></tr></thead><tbody>
  ${list.map(s=>{
    const v=getVehicle(s.vehicleId);
    const c=getCustomer(v?.customerId);
    return `<tr>
      <td>${s.date || "-"}</td>
      <td>${v ? `<button class="small-btn" onclick="openVehicle('${v.id}')">${v.noPlateName ? v.noPlateName + " / " + v.plate : v.plate}</button>` : "-"}</td>
      <td>${c?.name || "-"}</td>
      <td>${kmFormat(s.currentKm)}</td>
      <td>${kmFormat(s.nextKm)}</td>
      <td>${serviceItemsText(s)}${s.title ? " / " + s.title : ""}</td>
      <td class="amount">${money(s.laborAmount || 0)}</td>
      <td class="amount">${money(s.partsAmount || 0)}</td>
      <td class="amount">${money(s.amount)}</td>
      <td>${s.note || "-"}</td>
      <td>${s.createdBy || "-"}</td>
      <td>
        ${isAdmin() ? `
        <button class="small-btn" onclick="printSingleService('${s.id}')">Yazdır</button>
        <button class="small-btn" onclick="downloadSingleServicePdf('${s.id}')">PDF</button>
        <button class="small-btn" onclick="shareSingleServiceWhatsApp('${s.id}')">WP</button>` : `<span class="badge">Personel</span>`}
      </td>
    </tr>`;
  }).join("") || emptyRow(12)}
  </tbody></table></div>`;
}
function paymentsTable(list){
  return `<div class="table-wrap"><table><thead><tr><th>Ödeme Tarihi</th><th>Müşteri/Firma</th><th>Plaka</th><th>Tür</th><th>Tutar</th><th>Not</th><th>İşlemi Yapan</th></tr></thead><tbody>
  ${list.map(p=>{
    const v = getVehicle(p.vehicleId);
    const c = getCustomer(p.customerId);
    const plateText = v ? (v.noPlateName ? v.noPlateName + " / " + v.plate : v.plate) : (p.manualPlate || "-");
    return `<tr>
      <td>${p.date || "-"}</td>
      <td>${c?.name || "-"}</td>
      <td>${plateText}</td>
      <td><span class="badge">${paymentTypeText(p)}</span></td>
      <td class="amount good">${money(p.amount)}</td>
      <td>${p.note || "-"}</td>
      <td>${p.createdBy || "-"}</td>
    </tr>`;
  }).join("") || emptyRow(7)}
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
  return `<div class="table-wrap"><table><thead><tr><th>Plaka</th><th>Son KM</th><th>Sonraki Bakım KM</th><th>Kalan KM</th></tr></thead><tbody>
  ${list.map(x=>`<tr><td><button class="small-btn" onclick="openVehicle('${x.vehicle.id}')">${x.vehicle.plate}</button></td><td>${kmFormat(x.currentKm)}</td><td>${kmFormat(x.nextKm)}</td><td class="amount ${x.remaining <= 1000 ? "bad" : "warn"}">${x.remaining === null ? "-" : kmFormat(x.remaining)}</td></tr>`).join("") || emptyRow(4)}
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



function canOutput(){
  if(!requireAdmin()) return false;
  return true;
}

function serviceSinglePlainText(serviceId){
  const s = db.services.find(x => x.id === serviceId);
  if(!s) return "Servis kaydı bulunamadı.";
  const v = getVehicle(s.vehicleId);
  const c = getCustomer(v?.customerId);
  const vehicleName = `${v?.noPlateName ? v.noPlateName + " / " : ""}${v?.plate || "-"}`;
  let text = `Hiçkorkmaz Garaj - Servis Kaydı\n\n`;
  text += `Müşteri/Firma: ${c?.name || "-"}\n`;
  text += `Araç: ${vehicleName}\n`;
  text += `Marka/Model: ${[v?.brand,v?.model,v?.year].filter(Boolean).join(" ") || "-"}\n`;
  text += `Tarih: ${s.date || "-"}\n`;
  text += `Geldiği KM: ${kmFormat(s.currentKm)}\n`;
  text += `Bir Sonraki Bakım KM: ${kmFormat(s.nextKm)}\n`;
  text += `Yapılan İşlemler: ${serviceItemsText(s)}${s.title ? " / " + s.title : ""}\n`;
  text += `İşçilik: ${money(s.laborAmount || 0)}\n`;
  text += `Parça: ${money(s.partsAmount || 0)}\n`;
  text += `Toplam: ${money(s.amount)}\n`;
  text += `Not: ${s.note || "-"}\n` +
    `İşlemi Yapan: ${s.createdBy || "-"}\n`;
  return text;
}

function serviceSingleHtml(serviceId){
  const s = db.services.find(x => x.id === serviceId);
  if(!s) return "<p>Servis kaydı bulunamadı.</p>";
  const v = getVehicle(s.vehicleId);
  const c = getCustomer(v?.customerId);
  const vehicleName = `${v?.noPlateName ? v.noPlateName + " / " : ""}${v?.plate || "-"}`;

  return `
    <!doctype html>
    <html lang="tr">
    <head>
      <meta charset="utf-8">
      <title>Servis Kaydı - ${vehicleName}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#111;margin:24px}
        .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}
        h1{margin:0;font-size:24px}
        h2{margin:4px 0 0;font-size:18px}
        p{margin:5px 0}
        .muted{color:#555}
        .summary{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:16px 0}
        .box{border:1px solid #ccc;border-radius:8px;padding:10px}
        .box span{display:block;color:#666;font-size:12px}
        .box b{display:block;margin-top:5px;font-size:16px}
        table{width:100%;border-collapse:collapse;margin-top:16px;font-size:13px}
        th,td{border:1px solid #ccc;padding:9px;text-align:left;vertical-align:top}
        th{background:#f2f2f2;width:220px}
        .footer{margin-top:24px;color:#666;font-size:12px}
        @media print{button{display:none} body{margin:12px}}
      </style>
    </head>
    <body>
      <button onclick="window.print()" style="padding:10px 14px;margin-bottom:14px">Yazdır / PDF Kaydet</button>
      <div class="head">
        <div>
          <h1>Hiçkorkmaz Garaj</h1>
          <h2>Tek Servis Kaydı</h2>
          <p class="muted">Seçilen işlem dökümü</p>
        </div>
        <div><p><b>Çıktı Tarihi:</b> ${today()}</p></div>
      </div>

      <div class="summary">
        <div class="box"><span>Müşteri/Firma</span><b>${c?.name || "-"}</b></div>
        <div class="box"><span>Araç</span><b>${vehicleName}</b></div>
        <div class="box"><span>Marka/Model</span><b>${[v?.brand,v?.model,v?.year].filter(Boolean).join(" ") || "-"}</b></div>
        <div class="box"><span>Servis Tarihi</span><b>${s.date || "-"}</b></div>
      </div>

      <table>
        <tr><th>Geldiği KM</th><td>${kmFormat(s.currentKm)}</td></tr>
        <tr><th>Bir Sonraki Bakım KM</th><td>${kmFormat(s.nextKm)}</td></tr>
        <tr><th>Yapılan İşlemler</th><td>${serviceItemsText(s)}${s.title ? " / " + s.title : ""}</td></tr>
        <tr><th>İşçilik</th><td>${money(s.laborAmount || 0)}</td></tr>
        <tr><th>Parça</th><td>${money(s.partsAmount || 0)}</td></tr>
        <tr><th>Toplam</th><td><b>${money(s.amount)}</b></td></tr>
        <tr><th>Not</th><td>${s.note || "-"}</td></tr><tr><th>İşlemi Yapan</th><td>${s.createdBy || "-"}</td></tr>
      </table>

      <div class="footer">Bu çıktı Hiçkorkmaz Garaj V7 sistemi üzerinden oluşturulmuştur.</div>
    </body>
    </html>
  `;
}

window.printSingleService = function(serviceId){
  if(!canOutput()) return;
  const w = window.open("", "_blank");
  w.document.open();
  w.document.write(serviceSingleHtml(serviceId));
  w.document.close();
};

window.downloadSingleServicePdf = function(serviceId){
  if(!canOutput()) return;
  const w = window.open("", "_blank");
  w.document.open();
  w.document.write(serviceSingleHtml(serviceId));
  w.document.close();
  setTimeout(() => w.print(), 500);
};

window.shareSingleServiceWhatsApp = function(serviceId){
  if(!canOutput()) return;
  const text = encodeURIComponent(serviceSinglePlainText(serviceId));
  window.open(`https://wa.me/?text=${text}`, "_blank");
};


function serviceHistoryPlainText(vehicleId){
  const v = getVehicle(vehicleId);
  const c = getCustomer(v?.customerId);
  const rows = getServicesByVehicle(vehicleId);
  const title = `Hiçkorkmaz Garaj - Servis Geçmişi`;
  const vehicleName = `${v?.noPlateName ? v.noPlateName + " / " : ""}${v?.plate || "-"}`;
  let text = `${title}\n\nMüşteri/Firma: ${c?.name || "-"}\nAraç: ${vehicleName}\nMarka/Model: ${[v?.brand,v?.model,v?.year].filter(Boolean).join(" ") || "-"}\nSon KM: ${kmFormat(vehicleLastKm(vehicleId))}\nSonraki Bakım KM: ${kmFormat(vehicleNextKm(vehicleId))}\nToplam Borç: ${money(vehicleDebt(vehicleId))}\n\n`;
  if(!rows.length){
    text += "Servis kaydı bulunamadı.";
    return text;
  }
  rows.forEach((s, i) => {
    text += `${i+1}) Tarih: ${s.date || "-"}\n`;
    text += `   Geldiği KM: ${kmFormat(s.currentKm)}\n`;
    text += `   Sonraki Bakım KM: ${kmFormat(s.nextKm)}\n`;
    text += `   Yapılan İşlemler: ${serviceItemsText(s)}${s.title ? " / " + s.title : ""}\n`;
    text += `   İşçilik: ${money(s.laborAmount || 0)}\n`;
    text += `   Parça: ${money(s.partsAmount || 0)}\n`;
    text += `   Toplam: ${money(s.amount)}\n`;
    text += `   Not: ${s.note || "-"}\n\n`;
  });
  return text;
}

function serviceHistoryHtml(vehicleId){
  const v = getVehicle(vehicleId);
  const c = getCustomer(v?.customerId);
  const rows = getServicesByVehicle(vehicleId);
  const vehicleName = `${v?.noPlateName ? v.noPlateName + " / " : ""}${v?.plate || "-"}`;
  const rowsHtml = rows.map(s => `
    <tr>
      <td>${s.date || "-"}</td>
      <td>${kmFormat(s.currentKm)}</td>
      <td>${kmFormat(s.nextKm)}</td>
      <td>${serviceItemsText(s)}${s.title ? " / " + s.title : ""}</td>
      <td>${money(s.laborAmount || 0)}</td>
      <td>${money(s.partsAmount || 0)}</td>
      <td>${money(s.amount)}</td>
      <td>${s.note || "-"}</td>
    </tr>
  `).join("");

  return `
    <!doctype html>
    <html lang="tr">
    <head>
      <meta charset="utf-8">
      <title>Servis Geçmişi - ${vehicleName}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#111;margin:24px}
        .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}
        h1{margin:0;font-size:24px}
        h2{margin:4px 0 0;font-size:18px}
        p{margin:4px 0}
        .muted{color:#555}
        .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}
        .box{border:1px solid #ccc;border-radius:8px;padding:10px}
        .box span{display:block;color:#666;font-size:12px}
        .box b{display:block;margin-top:5px;font-size:16px}
        table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}
        th,td{border:1px solid #ccc;padding:8px;text-align:left;vertical-align:top}
        th{background:#f2f2f2}
        .footer{margin-top:24px;color:#666;font-size:12px}
        @media print{button{display:none} body{margin:12px}}
      </style>
    </head>
    <body>
      <button onclick="window.print()" style="padding:10px 14px;margin-bottom:14px">Yazdır / PDF Kaydet</button>
      <div class="head">
        <div>
          <h1>Hiçkorkmaz Garaj</h1>
          <h2>Servis Geçmişi</h2>
          <p class="muted">Araç bakım ve işlem dökümü</p>
        </div>
        <div>
          <p><b>Tarih:</b> ${today()}</p>
        </div>
      </div>
      <p><b>Müşteri/Firma:</b> ${c?.name || "-"}</p>
      <p><b>Araç:</b> ${vehicleName}</p>
      <p><b>Marka/Model:</b> ${[v?.brand,v?.model,v?.year].filter(Boolean).join(" ") || "-"}</p>
      <div class="summary">
        <div class="box"><span>Son KM</span><b>${kmFormat(vehicleLastKm(vehicleId))}</b></div>
        <div class="box"><span>Sonraki Bakım KM</span><b>${kmFormat(vehicleNextKm(vehicleId))}</b></div>
        <div class="box"><span>Toplam Borç</span><b>${money(vehicleDebt(vehicleId))}</b></div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Tarih</th>
            <th>Geldiği KM</th>
            <th>Sonraki Bakım KM</th>
            <th>Yapılan İşlemler</th>
            <th>İşçilik</th>
            <th>Parça</th>
            <th>Toplam</th>
            <th>Not</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="8">Servis kaydı bulunamadı.</td></tr>`}
        </tbody>
      </table>
      <div class="footer">Bu çıktı Hiçkorkmaz Garaj V7 sistemi üzerinden oluşturulmuştur.</div>
    </body>
    </html>
  `;
}

window.printServiceHistory = function(vehicleId){
  if(!canOutput()) return;
  const w = window.open("", "_blank");
  w.document.open();
  w.document.write(serviceHistoryHtml(vehicleId));
  w.document.close();
};

window.downloadServiceHistoryPdf = function(vehicleId){
  if(!canOutput()) return;
  const w = window.open("", "_blank");
  w.document.open();
  w.document.write(serviceHistoryHtml(vehicleId));
  w.document.close();
  setTimeout(() => w.print(), 500);
};

window.shareServiceHistoryWhatsApp = function(vehicleId){
  if(!canOutput()) return;
  const text = encodeURIComponent(serviceHistoryPlainText(vehicleId));
  window.open(`https://wa.me/?text=${text}`, "_blank");
};


window.openVehicle = function(vehicleId){
  const v = getVehicle(vehicleId); if(!v) return;
  const c = getCustomer(v.customerId);
  document.getElementById("detail").innerHTML = `
    <div class="detail-title">
      <div><span class="badge">Araç Kartı / Plaka Geçmişi</span><h2>${v.noPlateName ? v.noPlateName + " / " + v.plate : v.plate}</h2><p>${c?.name || "-"} • ${[v.brand,v.model,v.year].filter(Boolean).join(" ") || "-"}</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn primary" onclick="openCustomer('${v.customerId}')">Bu müşterinin tüm araçlarını göster</button>
        ${isAdmin() ? `<button class="btn" onclick="printServiceHistory('${v.id}')">Tüm Geçmişi Yazdır</button>
        <button class="btn" onclick="downloadServiceHistoryPdf('${v.id}')">Tüm Geçmiş PDF</button>
        <button class="btn" onclick="shareServiceHistoryWhatsApp('${v.id}')">Tüm Geçmiş WP</button>` : ``}
        <button class="btn" onclick="openPage('${lastPageBeforeDetail}')">Geri</button>
      </div>
    </div>
    <div class="customer-card">
      <div class="info-box"><span>Plaka / Tanım</span><b>${v.noPlateName ? v.noPlateName + " / " + v.plate : v.plate}</b></div><div class="info-box"><span>Sahibi / Firma</span><b>${c?.name || "-"}</b></div><div class="info-box"><span>Marka model</span><b>${[v.brand,v.model,v.year].filter(Boolean).join(" ") || "-"}</b></div>
      <div class="info-box"><span>Son KM</span><b>${kmFormat(vehicleLastKm(v.id))}</b></div><div class="info-box"><span>Bir Sonraki Bakım KM</span><b>${kmFormat(vehicleNextKm(v.id))}</b></div><div class="info-box"><span>Kalan KM</span><b class="${remainingKm(v.id) !== null && remainingKm(v.id) <= 1000 ? "bad" : "warn"}">${remainingKm(v.id) === null ? "-" : kmFormat(remainingKm(v.id))}</b></div>
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
    return norm(`${v.plate} ${v.noPlateName} ${v.brand} ${v.model} ${v.year} ${v.note} ${c?.name} ${c?.phone}`).includes(q);
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
      return `<div class="search-row" onclick="openVehicle('${v.id}')"><b>🚗 ${v.noPlateName ? v.noPlateName + " / " + v.plate : v.plate}</b><span>${c?.name || "-"} • direkt araç geçmişi açılır</span></div>`;
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
  if(!requireRecordPermission()) return;
  if(activeUser.role !== "admin" && !["customer","vehicle","service"].includes(type)){
    alert("Bu işlem için admin yetkisi gerekir.");
    return;
  }
  modalType = type;
  const titleMap = {customer:"Müşteri/Firma Ekle", vehicle:"Araç Ekle", service:"Servis Kaydı Ekle", payment:"Tahsilat Ekle"};
  document.getElementById("modalTitle").textContent = titleMap[type];

  const customerOptions = db.customers.map(c=>`<option value="${c.id}">${c.name}</option>`).join("");
  const vehicleOptions = db.vehicles.map(v=>`<option value="${v.id}">${v.plate} - ${getCustomer(v.customerId)?.name || ""}</option>`).join("");

  if(type === "customer"){
    document.getElementById("modalBody").innerHTML = `${field("Ad Soyad / Firma Adı","name")}${field("Telefon","phone","text","",false)}${selectField("Tür","type","<option>Şahıs</option><option>Firma</option>")}${textareaField("Not","note")}`;
  }
  if(type === "vehicle"){
    document.getElementById("modalBody").innerHTML = `${field("Müşteri / Firma Adı","customerName","text","")}${field("Telefon","customerPhone","text","",false)}${field("Plaka","plate","text","",false)}${field("Plakasız Araç Tanımı","noPlateName","text","",false)}${field("Marka","brand","text","",false)}${field("Model","model","text","",false)}${field("Yıl","year","number","",false)}${textareaField("Araç Notu","note")}<p class="notice">Plaka varsa yaz. Plakası olmayan araçlarda Plakasız Araç Tanımı alanına örnek olarak “Forklift”, “Römork”, “Atölye Aracı” yazabilirsin. Müşteri/firma sistemde yoksa otomatik oluşturulur.</p>`;
  }
  if(type === "service"){
    document.getElementById("modalBody").innerHTML = `${field("Plaka / Araç Tanımı / Müşteri-Firma Adı","serviceTarget","text","")}${field("Servis Tarihi","date","date",today())}${field("Geldiği KM","currentKm","number")}${field("Bir Sonraki Bakım KM","nextKm","number","",false)}${serviceItemCheckboxes()}${field("Ek İşlem Başlığı / Açıklama","title","text","",false)}${field("İşçilik Tutarı","laborAmount","number","0",false)}${field("Parça Tutarı","partsAmount","number","0",false)}<div class="field"><label>Toplam Tutar</label><input id="serviceTotalPreview" type="text" value="0 TL" readonly></div><div id="serviceTargetChoice" class="hidden">${selectField("Birden fazla araç bulunduysa seç","manualVehicleId",serviceTargetOptions())}</div>${textareaField("Not","note")}<p class="notice">Plaka, plakasız araç tanımı veya müşteri/firma adı yazabilirsin. Tek araç bulunursa otomatik kaydeder. Birden fazla araç varsa aşağıdan doğru aracı seçebilirsin.</p>`;
    setTimeout(() => { bindServiceTotalPreview(); bindServiceTargetFinder(); }, 0);
  }
  if(type === "payment"){
    document.getElementById("modalBody").innerHTML = `${field("Müşteri / Firma Adı","customerName","text","",false)}${field("Plaka","plate","text","",false)}${field("Ödeme Tarihi","date","date",today())}${field("Tutar","amount","number")}${textareaField("Not","note")}<p class="notice">Plaka kayıtlıysa ödeme sadece o aracın borcuna işlenir. Plaka boşsa Müşteri/Firma adına cari hesaptan düşer.</p>`;
  }
  modal.showModal();
};

function bindServiceTotalPreview(){
  const labor = modalForm.querySelector('input[name="laborAmount"]');
  const parts = modalForm.querySelector('input[name="partsAmount"]');
  const out = document.getElementById("serviceTotalPreview");
  if(!labor || !parts || !out) return;
  const update = () => {
    const total = Number(labor.value || 0) + Number(parts.value || 0);
    out.value = money(total);
  };
  labor.addEventListener("input", update);
  parts.addEventListener("input", update);
  update();
}

function bindServiceTargetFinder(){
  const input = modalForm.querySelector('input[name="serviceTarget"]');
  const choiceWrap = document.getElementById("serviceTargetChoice");
  const select = modalForm.querySelector('select[name="manualVehicleId"]');
  if(!input || !choiceWrap || !select) return;

  const update = () => {
    const result = findServiceTarget(input.value);
    if(result.status === "multiple"){
      select.innerHTML = result.vehicles.map(v => {
        const c = getCustomer(v.customerId);
        const label = `${v.noPlateName ? v.noPlateName + " / " : ""}${v.plate} - ${c?.name || "-"} ${v.brand || ""} ${v.model || ""}`.trim();
        return `<option value="${v.id}">${label}</option>`;
      }).join("");
      choiceWrap.classList.remove("hidden");
    }else{
      choiceWrap.classList.add("hidden");
    }
  };
  input.addEventListener("input", update);
  update();
}

modalForm.addEventListener("submit", function(e){
  e.preventDefault();
  const fd = new FormData(modalForm);
  const obj = Object.fromEntries(fd.entries());

  if(modalType === "customer") db.customers.push({ id:newId("c"), name:obj.name, phone:obj.phone, type:obj.type, note:obj.note });
  if(modalType === "vehicle"){
    const c = findOrCreateCustomerByName(obj.customerName, obj.customerPhone);
    const plateText = safe(obj.plate).trim() ? safe(obj.plate).toLocaleUpperCase("tr-TR") : `PLAKASIZ-${new Date().getTime().toString().slice(-5)}`;
    const noPlateName = safe(obj.noPlateName).trim();
    db.vehicles.push({ id:newId("v"), customerId:c.id, plate:plateText, noPlateName:noPlateName, brand:obj.brand, model:obj.model, year:obj.year, note:obj.note });
  }
  if(modalType === "service"){
    const result = findServiceTarget(obj.serviceTarget);
    let foundVehicle = null;

    if(result.status === "single"){
      foundVehicle = result.vehicle;
    }else if(result.status === "multiple"){
      foundVehicle = getVehicle(obj.manualVehicleId);
    }

    if(!foundVehicle){
      alert("Araç bulunamadı. Plaka, plakasız araç tanımı veya müşteri/firma adını kontrol edin. Gerekirse önce Araçlar bölümünden aracı ekleyin.");
      return;
    }

    const lastKm = vehicleLastKm(foundVehicle.id);
    const currentKm = Number(obj.currentKm || 0);
    if(lastKm && currentKm && currentKm < lastKm){
      const ok = confirm("Girilen KM önceki servis kaydından düşük görünüyor. Yine de kaydedilsin mi?");
      if(!ok) return;
    }

    const selectedItems = fd.getAll("items");
    const laborAmount = Number(obj.laborAmount || 0);
    const partsAmount = Number(obj.partsAmount || 0);
    const totalAmount = laborAmount + partsAmount;
    db.services.push({ id:newId("s"), vehicleId:foundVehicle.id, date:obj.date, currentKm:currentKm, nextKm:Number(obj.nextKm || 0), items:selectedItems, title:obj.title, laborAmount:laborAmount, partsAmount:partsAmount, amount:totalAmount, note:obj.note, createdBy:activeUser?.email || "-", createdByRole:activeUser?.role || "-", createdAt:new Date().toISOString() });
  }
  if(modalType === "payment"){
    const typedCustomerName = safe(obj.customerName).trim();
    const typedPlate = safe(obj.plate).trim();
    const foundVehicle = typedPlate ? findVehicleByPlate(typedPlate) : null;

    let targetCustomer = null;
    let paymentType = "customer_only";

    if(foundVehicle){
      targetCustomer = getCustomer(foundVehicle.customerId);
      paymentType = "vehicle_only";
    }else{
      if(!typedCustomerName){
        alert("Cari tahsilat için Müşteri / Firma Adı yazman gerekir.");
        return;
      }

      targetCustomer = findCustomerByName(typedCustomerName);

      if(!targetCustomer){
        const createOk = confirm("Bu Müşteri/Firma mevcut kayıtlarda bulunamadı. Yeni cari kart oluşturulsun mu?");
        if(!createOk) return;
        targetCustomer = findOrCreateCustomerByName(typedCustomerName, "");
      }

      paymentType = "customer_only";
    }

    db.payments.push({
      id:newId("p"),
      customerId:targetCustomer.id,
      vehicleId:foundVehicle ? foundVehicle.id : "",
      manualPlate:typedPlate ? typedPlate.toLocaleUpperCase("tr-TR") : "",
      paymentType:paymentType,
      date:obj.date,
      amount:Number(obj.amount||0),
      note:obj.note,
      createdBy:activeUser?.email || "-",
      createdAt:new Date().toISOString()
    });
  }

  modal.close();
  persist();
});

window.saveUserPasswords = function(){
  if(!requireAdmin()) return;
  if(!requireAdmin()) return;
  const users = getUsers();
  const adminPass = document.getElementById("adminPassInput")?.value.trim();
  const personelPass = document.getElementById("personelPassInput")?.value.trim();

  if(adminPass) users.admin.password = adminPass;
  if(personelPass) users.personel.password = personelPass;

  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  alert("Şifreler kaydedildi.");
};

window.exportData = function(){
  if(!requireAdmin()) return;
  const blob = new Blob([JSON.stringify(db,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "hickorkmaz-garaj-v7-yedek.json"; a.click();
  URL.revokeObjectURL(url);
};
window.importData = function(event){
  if(!requireAdmin()) return;
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
window.resetAllData = function(){
  if(!requireAdmin()) return;
  const ok = confirm("Tüm müşteri, araç, servis ve tahsilat kayıtları silinecek. Emin misin?");
  if(!ok) return;
  db = { customers: [], vehicles: [], services: [], payments: [] };
  persist();
  alert("Sistem temizlendi.");
};

window.clearDemo = function(){
  if(!requireAdmin()) return;
  db.customers = db.customers.filter(x=>!x.id.includes("_demo_"));
  db.vehicles = db.vehicles.filter(x=>!x.id.includes("_demo_"));
  db.services = db.services.filter(x=>!x.id.includes("_demo_"));
  db.payments = db.payments.filter(x=>!x.id.includes("_demo_"));
  persist();
};

setupAuth();
setupMobileMenu();
applyAuthState();
if(activeUser) render();


window.debugCustomerPayments = function(){
  return db.customers.map(c => ({
    name:c.name,
    id:c.id,
    paid:customerPaid(c.id),
    debt:customerDebt(c.id),
    payments:db.payments.filter(p=>p.customerId===c.id)
  }));
};


window.findCariDebug = function(name){
  const c = findCustomerByName(name);
  if(!c) return null;
  return {
    customer:c,
    total:customerTotal(c.id),
    paid:customerPaid(c.id),
    debt:customerDebt(c.id),
    payments:db.payments.filter(p=>p.customerId===c.id)
  };
};
window.clearDemo = function(){
  window.deleteVehicle = function(vehicleId){
  if(!requireAdmin()) return;

  const password = prompt("Silme şifresini giriniz:");

  if(password !== DELETE_PASSWORD){
    alert("Hatalı şifre!");
    return;
  }

  const ok = confirm("Araç ve tüm servis geçmişi silinecek. Emin misin?");
  if(!ok) return;

  db.services = db.services.filter(s => s.vehicleId !== vehicleId);
  db.payments = db.payments.filter(p => p.vehicleId !== vehicleId);
  db.vehicles = db.vehicles.filter(v => v.id !== vehicleId);

  persist();
  alert("Araç silindi.");
};
