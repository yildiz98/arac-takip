import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { firebaseConfig, ADMIN_EMAILS, PERSONEL_EMAILS } from "./firebase-config.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// CANLI SİSTEM: Firebase Auth korunur.
// ÖNEMLİ: Mevcut aktif sistem verileri silinmesin diye STORE_KEY aynı bırakıldı.
const STORE_KEY = "hickorkmaz_garaj_v7_data";
const AUTH_KEY = "hickorkmaz_garaj_v7_google_auth";
const DELETE_PASSWORD = "212198";

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);
const SHARED_DATA_DOC = doc(firestore, "shared", "garageData");
let activeUser = null;
let unsubscribeSharedData = null;
let isApplyingCloudData = false;
let cloudDataLoaded = false;

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
function normalizeDb(data){
  return {
    customers: Array.isArray(data?.customers) ? data.customers : [],
    vehicles: Array.isArray(data?.vehicles) ? data.vehicles : [],
    services: Array.isArray(data?.services) ? data.services : [],
    payments: Array.isArray(data?.payments) ? data.payments : []
  };
}

function hasAnyRecord(data){
  const d = normalizeDb(data);
  return d.customers.length || d.vehicles.length || d.services.length || d.payments.length;
}

async function saveCloudData(){
  if(!activeUser || isApplyingCloudData) return;
  try{
    await setDoc(SHARED_DATA_DOC, {
      ...normalizeDb(db),
      updatedAt: serverTimestamp(),
      updatedBy: activeUser.email || "-"
    });
  }catch(err){
    console.error("Ortak kayıt havuzu kaydedilemedi:", err);
    alert("Kayıt cihazına kaydedildi fakat ortak Firebase verisine gönderilemedi. İnternet bağlantını ve Firestore kurallarını kontrol et.");
  }
}

async function startSharedDataSync(){
  // Firestore onSnapshot canlı dinleme GitHub Pages/Chrome üzerinde
  // "Listen/channel 400 Bad Request - Unknown SID" hatası oluşturduğu için kaldırıldı.
  // Bunun yerine girişte tek seferlik getDoc okuması yapılır.
  cloudDataLoaded = false;
  isApplyingCloudData = true;

  try{
    const snap = await getDoc(SHARED_DATA_DOC);

    if(snap.exists()){
      db = normalizeDb(snap.data());
      localStorage.setItem(STORE_KEY, JSON.stringify(db));
    }else if(hasAnyRecord(db)){
      await saveCloudData();
    }

    cloudDataLoaded = true;
    isApplyingCloudData = false;

    if(activeUser){
      applyAuthState();
      render();
    }
  }catch(err){
    isApplyingCloudData = false;
    cloudDataLoaded = true;
    console.error("Firestore veri okuma hatası:", err?.code, err?.message, err);

    // Firebase geçici hata verse bile sistem yerel verilerle açılsın.
    if(activeUser){
      applyAuthState();
      render();
    }
  }
}

function persist(){
  db = normalizeDb(db);
  localStorage.setItem(STORE_KEY, JSON.stringify(db));
  if(activeUser) saveCloudData();
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

  return found || null;
}
function findOrCreateCustomerByName(name, phone=""){
  let found = findCustomerByName(name);
  if(found) return found;
  const created = { id:newId("c"), name:safe(name).trim(), phone:phone || "", type:"Müşteri/Firma", note:"Araç ekleme sırasında otomatik oluşturuldu" };
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
function vehiclePaid(vehicleId){ return getPaymentsByVehicle(vehicleId).reduce((t,x)=>t+Number(x.amount||0),0); }
function vehicleDebt(vehicleId){ return vehicleTotal(vehicleId)-vehiclePaid(vehicleId); }
function servicePaidAmount(serviceId){ return db.payments.filter(p=>p.serviceId===serviceId).reduce((t,x)=>t+Number(x.amount||0),0); }
function serviceIsPaid(serviceId){
  const s = db.services.find(x=>x.id===serviceId);
  if(!s) return false;
  return s.paymentStatus === "paid" || (Number(s.amount||0) > 0 && servicePaidAmount(serviceId) >= Number(s.amount||0));
}
function serviceRemainingAmount(serviceId){
  const s = db.services.find(x=>x.id===serviceId);
  if(!s) return 0;
  return Math.max(Number(s.amount||0) - servicePaidAmount(serviceId), 0);
}
function customerTotal(customerId){ return getVehiclesByCustomer(customerId).reduce((t,v)=>t+vehicleTotal(v.id),0); }
function customerPaid(customerId){
  const vehiclePayments =
    getVehiclesByCustomer(customerId)
      .reduce((t,v)=>t+vehiclePaid(v.id),0);

  const directPayments =
    db.payments
      .filter(p =>
        p.customerId === customerId &&
        (!p.vehicleId || p.paymentType === "customer_only")
      )
      .reduce((t,p)=>t+Number(p.amount||0),0);

  return vehiclePayments + directPayments;
}
function customerDebt(customerId){ return customerTotal(customerId)-customerPaid(customerId); }
function lastServiceDate(vehicleId){ return getServicesByVehicle(vehicleId)[0]?.date || "-"; }
function lastServiceRecord(vehicleId){ return getServicesByVehicle(vehicleId)[0] || null; }
function vehicleLastKm(vehicleId){ return Number(lastServiceRecord(vehicleId)?.currentKm || 0); }
function vehicleNextKm(vehicleId){ return Number(lastServiceRecord(vehicleId)?.nextKm || 0); }
function kmFormat(n){ return Number(n||0) ? Number(n).toLocaleString("tr-TR") + " km" : "-"; }
function remainingKm(vehicleId){
  const next = vehicleNextKm(vehicleId);
  const current = vehicleLastKm(vehicleId);
  if(!next || !current) return null;
  return next - current;
}

function paymentTypeText(p){
  if(p.paymentType === "service_paid") return "Servis Ödendi";
  if(p.paymentType === "vehicle_only") return "Sadece Araç";
  if(p.paymentType === "customer_only") return "Sadece Cari Hesap";
  if(p.paymentType === "vehicle_customer") return "Araç + Cari Hesap";
  return p.vehicleId ? "Sadece Araç" : "Sadece Cari Hesap";
}

function servicePricingPending(s){
  return s?.pricingStatus === "pending" || (Number(s?.amount || 0) === 0 && s?.createdByRole === "personel");
}
function canViewFinance(){ return isAdmin(); }
function financeHiddenText(){ return "🔒 Admin"; }
function financeText(value){ return canViewFinance() ? money(value) : financeHiddenText(); }
function financeClass(value){ return canViewFinance() ? (Number(value||0)>0 ? "bad" : "good") : "muted"; }
function serviceMoneyText(s, field){
  if(!canViewFinance()) return financeHiddenText();
  return servicePricingPending(s) ? "Fiyat bekliyor" : money(s?.[field] || 0);
}
function servicePricingBadge(s){
  if(servicePricingPending(s)){
    return `<span class="badge price-pending">🟡 Fiyat bekliyor</span>`;
  }
  return `<span class="badge price-priced">🟢 Fiyatlandırıldı</span>`;
}


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



function setupMobileMenu(){
  const btn = document.getElementById("mobileMenuBtn");
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.getElementById("mobileOverlay");

  if(!btn || !sidebar || !overlay) return;

  // PWA/telefon kullanımında aynı eventlerin tekrar bağlanmasını engeller.
  if(btn.dataset.menuReady === "1") return;
  btn.dataset.menuReady = "1";

  const close = () => {
    sidebar.classList.remove("mobile-open");
    overlay.classList.remove("show");
    document.body.classList.remove("menu-open");
  };

  const toggle = (e) => {
    if(e) e.preventDefault();
    sidebar.classList.toggle("mobile-open");
    overlay.classList.toggle("show");
    document.body.classList.toggle("menu-open", sidebar.classList.contains("mobile-open"));
  };

  btn.addEventListener("click", toggle);
  btn.addEventListener("touchend", toggle, { passive:false });
  overlay.addEventListener("click", close);
  overlay.addEventListener("touchend", close, { passive:false });

  document.querySelectorAll(".menu-item").forEach(item => {
    item.addEventListener("click", close);
  });

  window.addEventListener("pageshow", () => {
    // Ana ekrandan açılınca takılı kalmış menü durumunu sıfırlar.
    close();
  });
}

function applyAuthState(){
  const loginScreen = document.getElementById("loginScreen");
  const layout = document.querySelector(".layout");
  const quickActions = document.querySelector(".quick-actions");
  const userText = document.getElementById("activeUserText");

  if(!activeUser){
    if(loginScreen){ loginScreen.classList.remove("hidden"); loginScreen.style.display = "grid"; }
    if(layout) layout.classList.add("locked");
    if(quickActions) quickActions.classList.add("hidden");
    return;
  }

  if(loginScreen){ loginScreen.classList.add("hidden"); loginScreen.style.display = "none"; }
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

  if(form && form.dataset.authReady !== "1"){
    form.dataset.authReady = "1";
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

  if(!window.__hickorkmazAuthListenerReady){
    window.__hickorkmazAuthListenerReady = true;
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
      startSharedDataSync();
      render();
    });
  }

  if(logoutBtn && logoutBtn.dataset.logoutReady !== "1"){
    logoutBtn.dataset.logoutReady = "1";
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
  render();
}

window.openPage = openPage;

window.openPage = openPage;

function stat(label,value,cls="",icon="fa-solid fa-chart-simple",trend="", page=""){
  const clickAttr = page ? ` onclick="openPage('${page}')" role="button" title="${label} bölümüne git"` : "";
  const clickableClass = page ? " clickable-stat" : "";
  return `<div class="card stat-card${clickableClass}"${clickAttr}>
    <div class="stat-icon"><i class="${icon}"></i></div>
    <div class="stat-meta"><div class="label">${label}</div><div class="value ${cls}">${value}</div>${trend ? `<div class="trend ${cls}">${trend}</div>` : ``}</div>
  </div>`;
}

function dashboardCustomerDebtList(){
  const list = db.customers.map(c => ({...c, debt:customerDebt(c.id), count:getVehiclesByCustomer(c.id).length}))
    .filter(c=>c.debt>0).sort((a,b)=>b.debt-a.debt).slice(0,5);
  return `<div class="debt-list">${list.map(c=>`<button class="debt-row" onclick="openCustomer('${c.id}')"><span class="avatar-mini">${safe(c.name).slice(0,2).toUpperCase() || 'HG'}</span><span><b>${c.name}</b><small>${c.count} araç / servis</small></span><strong>${money(c.debt)}</strong></button>`).join("") || `<div class="notice">Borçlu müşteri bulunmuyor.</div>`}</div>`;
}

function dashboardChart(totalRevenue){
  const paid = db.payments.reduce((t,p)=>t+Number(p.amount||0),0);
  const debt = Math.max(totalRevenue-paid,0);
  const max = Math.max(totalRevenue, paid, debt, 1);
  const h1 = Math.max(12, Math.round((totalRevenue/max)*120));
  const h2 = Math.max(12, Math.round((paid/max)*120));
  const h3 = Math.max(12, Math.round((debt/max)*120));
  return `<div class="chart-card">
    <div class="bar" style="height:${h1}px"><span>${money(totalRevenue)}</span></div>
    <div class="bar" style="height:${h2}px"><span>${money(paid)}</span></div>
    <div class="bar danger" style="height:${h3}px"><span>${money(debt)}</span></div>
  </div><div class="chart-labels"><span>Ciro</span><span>Tahsilat</span><span>Alacak</span></div>`;
}

function render(){
  renderDashboard(); renderCustomers(); renderVehicles(); renderServices(); renderPayments(); renderDebts(); renderReports(); renderSettings();
}

function dashboardQuickActions(){
  return `<div class="dashboard-top-actions">
    <button class="dash-action" onclick="openModal('customer')"><i class="fa-solid fa-plus"></i> Müşteri</button>
    <button class="dash-action" onclick="openModal('vehicle')"><i class="fa-solid fa-plus"></i> Araç</button>
    <button class="dash-action" onclick="openModal('service')"><i class="fa-solid fa-plus"></i> Servis</button>
    <button class="dash-action payment" onclick="openModal('payment')"><i class="fa-solid fa-plus"></i> Tahsilat</button>
  </div>`;
}

function dashboardRecentPaymentsList(){
  const list = db.payments.slice().sort((a,b)=>safe(b.date).localeCompare(safe(a.date))).slice(0,5);
  return `<div class="payment-list">${list.map(p=>{
    const c = getCustomer(p.customerId);
    return `<button class="payment-row" onclick="openPage('payments')"><span class="avatar-mini">${safe(c?.name || 'HG').slice(0,2).toUpperCase()}</span><span><b>${c?.name || '-'}</b><small>${p.date || '-'} ${p.createdAt ? new Date(p.createdAt).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}) : ''}</small></span><strong>${money(p.amount)}</strong></button>`;
  }).join('') || `<div class="notice">Tahsilat kaydı bulunmuyor.</div>`}</div>`;
}

function dashboardRecentPaymentsTable(){
  const list = db.payments.slice().sort((a,b)=>safe(b.date).localeCompare(safe(a.date))).slice(0,5);
  return `<div class="table-wrap compact-table"><table><thead><tr><th>Tarih</th><th>Müşteri / Firma</th><th>Açıklama</th><th>Tutar</th></tr></thead><tbody>
    ${list.map(p=>{
      const c = getCustomer(p.customerId);
      const v = getVehicle(p.vehicleId);
      const plate = v ? (v.noPlateName ? v.noPlateName + ' / ' + v.plate : v.plate) : (p.manualPlate || 'Cari');
      return `<tr><td>${p.date || '-'}</td><td>${c?.name || '-'}</td><td>${plate} tahsilatı</td><td class="amount good">${money(p.amount)}</td></tr>`;
    }).join('') || emptyRow(4)}
  </tbody></table></div>`;
}

function dashboardRecentVehiclesTable(){
  const list = db.vehicles.slice(-5).reverse();
  return `<div class="table-wrap compact-table"><table><thead><tr><th>Plaka</th><th>Müşteri</th><th>Araç</th></tr></thead><tbody>
    ${list.map(v=>{
      const c = getCustomer(v.customerId);
      return `<tr><td><button class="small-btn" onclick="openVehicle('${v.id}')">${v.noPlateName ? v.noPlateName + ' / ' + v.plate : v.plate}</button></td><td>${c?.name || '-'}</td><td>${[v.brand,v.model,v.year].filter(Boolean).join(' ') || '-'}</td></tr>`;
    }).join('') || emptyRow(3)}
  </tbody></table></div>`;
}

function dashboardRecentUnpaidServicesTable(list){
  return `<div class="table-wrap dashboard-service-table"><table><thead><tr><th>Tarih</th><th>Plaka</th><th>Müşteri / Firma</th><th>Yapılan İşlemler</th><th>Durum</th><th>Toplam</th><th>İşlem</th></tr></thead><tbody>
  ${list.map(s=>{
    const v = getVehicle(s.vehicleId);
    const c = getCustomer(v?.customerId);
    return `<tr>
      <td>${s.date || "-"}</td>
      <td>${v ? `<button class="small-btn plate-btn" onclick="openVehicle('${v.id}')">${v.noPlateName ? v.noPlateName + " / " + v.plate : v.plate}</button>` : "-"}</td>
      <td>${c?.name || "-"}</td>
      <td>${serviceItemsText(s)}${s.title ? " / " + s.title : ""}</td>
      <td>${servicePricingBadge(s)}</td>
      <td class="amount ${servicePricingPending(s)?"warn":"good"}">${serviceMoneyText(s,"amount")}</td>
      <td><div class="service-action-row">
        <button class="small-btn" onclick="openVehicle('${v?.id || ""}')">Görüntüle</button>
        <button class="small-btn" onclick="printSingleService('${s.id}')">Yazdır</button>
        <button class="small-btn" onclick="shareSingleServiceWhatsApp('${s.id}')">WP</button>
        ${(!servicePricingPending(s) && Number(s.amount||0)>0) ? `<button class="small-btn paid-btn" onclick="markServicePaid('${s.id}')">Ödendi</button>` : ``}
      </div></td>
    </tr>`;
  }).join("") || emptyRow(7)}
  </tbody></table></div><p class="dashboard-note">ⓘ Dashboard’da sadece ödenmemiş servisler gösterilir. Ödendi yaptığın kayıt buradan otomatik kaybolur.</p>`;
}

function renderDashboard(){
  const totalRevenue = db.services.reduce((t,s)=>t+Number(s.amount||0),0);
  const totalPaid = db.payments.reduce((t,p)=>t+Number(p.amount||0),0);
  const totalDebt = totalRevenue - totalPaid;
  const todayPaid = db.payments.filter(p=>p.date===today()).reduce((t,p)=>t+Number(p.amount||0),0);
  const month = today().slice(0,7);
  const monthRevenue = db.services.filter(s=>safe(s.date).slice(0,7)===month).reduce((t,s)=>t+Number(s.amount||0),0);
  const unpaidServices = db.services
    .filter(s => !serviceIsPaid(s.id))
    .sort((a,b)=>safe(b.date).localeCompare(safe(a.date)))
    .slice(0,8);
  const debtors = db.customers.filter(c=>customerDebt(c.id)>0).length;
  const pricingWaiting = db.services.filter(s=>servicePricingPending(s) && !serviceIsPaid(s.id)).length;

 document.getElementById("dashboard").innerHTML = `
    <div class="dash-hero v9-hero">
      <div><h2>Dashboard</h2><p>Günlük servis, tahsilat ve cari takip özeti.</p></div>
      <div class="date-pill"><i class="fa-regular fa-calendar"></i> ${new Date().toLocaleDateString('tr-TR',{day:'2-digit',month:'long',year:'numeric',weekday:'long'})}</div>
    </div>

    ${dashboardQuickActions()}

    <div class="grid stats pro-stats clean-stats">
      ${stat('Toplam Müşteri', db.customers.length, '', 'fa-solid fa-users', '▲ kayıt havuzu', 'customers')}
      ${stat('Toplam Araç', db.vehicles.length, '', 'fa-solid fa-car', '▲ araç kartı', 'vehicles')}
      ${isAdmin() ? stat('Toplam Alacak', money(totalDebt), totalDebt>0?'bad':'good', 'fa-solid fa-file-invoice-dollar', `${debtors} borçlu`, 'debts') : stat('Açık Servis', unpaidServices.length, '', 'fa-solid fa-screwdriver-wrench', 'fiyat gizli', 'services')}
      ${isAdmin() ? stat('Bu Ay Ciro', money(monthRevenue), 'good', 'fa-solid fa-chart-line', 'aylık', 'reports') : stat('Servis Kaydı', db.services.length, '', 'fa-solid fa-clipboard-list', 'operasyon', 'services')}
      ${isAdmin() ? stat('Bugünkü Tahsilat', money(todayPaid), 'good', 'fa-solid fa-money-bill-wave', 'bugün', 'payments') : stat('Araç İşlemleri', db.vehicles.length, '', 'fa-solid fa-gauge-high', 'aktif', 'vehicles')}
      ${stat('Ödenmemiş Servis', unpaidServices.length, unpaidServices.length?'warn':'good', 'fa-solid fa-wrench', unpaidServices.length?'ödeme bekliyor':'temiz', 'services')}
    </div>

    <div class="grid three comfort-alert-grid">
      <div class="mini-alert danger wide-alert"><i class="fa-solid fa-user-clock"></i><b>Borçlu Müşteriler</b><span><strong>${debtors}</strong> müşteri borçlu durumda.</span><em>Toplam Borç: ${money(totalDebt)}</em><button onclick="openPage('debts')">Listeyi Gör →</button></div>
      <div class="mini-alert wide-alert"><i class="fa-solid fa-screwdriver-wrench"></i><b>Açık Servisler</b><span><strong>${unpaidServices.length}</strong> ödenmemiş servis</span><em>Fiyatlandırma Bekleyen: ${pricingWaiting}</em><button onclick="openPage('services')">Servisleri Gör →</button></div>
      <div class="mini-alert ok wide-alert"><i class="fa-brands fa-whatsapp"></i><b>WhatsApp</b><span>Servis ve cari bilgilendirme hazır.</span><em>Tek tuşla müşteri bilgilendir.</em><button onclick="openPage('services')">Servise Git →</button></div>
    </div>

    <div class="grid dashboard-main-final">
      <div class="panel unpaid-service-panel"><div class="panel-head"><h3>Son Servis Kayıtları <span class="muted-title">(Ödenmemiş Servisler)</span></h3><button class="small-btn" onclick="openPage('services')">Tümünü Gör →</button></div>${dashboardRecentUnpaidServicesTable(unpaidServices)}</div>
      ${isAdmin() ? `<div class="panel"><div class="panel-head"><h3>En Son Tahsilatlar</h3><button class="small-btn" onclick="openPage('payments')">Tümünü Gör →</button></div>${dashboardRecentPaymentsList()}</div>` : ``}
    </div>

    <div class="grid bottom-comfort">
      <div class="panel"><div class="panel-head"><h3>Son Tahsilatlar</h3><button class="small-btn" onclick="openPage('payments')">Tümünü Gör →</button></div>${dashboardRecentPaymentsTable()}</div>
      <div class="panel"><div class="panel-head"><h3>Son Eklenen Araçlar</h3><button class="small-btn" onclick="openPage('vehicles')">Tümünü Gör →</button></div>${dashboardRecentVehiclesTable()}</div>
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

function monthKey(d){ return safe(d).slice(0,7) || today().slice(0,7); }
function monthLabel(key){
  const names = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
  const m = Number(safe(key).slice(5,7));
  return names[m-1] || key;
}
function lastSixMonths(){
  const out = [];
  const d = new Date();
  for(let i=5;i>=0;i--){
    const x = new Date(d.getFullYear(), d.getMonth()-i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}`);
  }
  return out;
}
function daysBetween(dateStr){
  const d = new Date(dateStr || today());
  if(isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((new Date() - d) / 86400000));
}
function unpaidServiceAmount(s){
  if(serviceIsPaid(s.id)) return 0;
  return Math.max(Number(s.amount||0) - servicePaidAmount(s.id), 0);
}
function simpleLineChart(points, valueKey, labelKey='label'){
  const max = Math.max(...points.map(p=>Number(p[valueKey]||0)), 1);
  const coords = points.map((p,i)=>{
    const x = points.length === 1 ? 50 : 8 + (i * 84/(points.length-1));
    const y = 88 - (Number(p[valueKey]||0) * 72 / max);
    return `${x},${y}`;
  }).join(' ');
  return `<div class="read-chart line-chart"><svg viewBox="0 0 100 100" preserveAspectRatio="none"><defs><linearGradient id="lineFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="rgba(47,107,255,.28)"/><stop offset="100%" stop-color="rgba(47,107,255,0)"/></linearGradient></defs><polyline points="8,88 ${coords} 92,88" fill="url(#lineFill)" stroke="none"></polyline><polyline points="${coords}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></polyline></svg><div class="chart-x">${points.map(p=>`<span>${p[labelKey]}</span>`).join('')}</div></div>`;
}
function simpleBarChart(points, valueKey, labelKey='label'){
  const max = Math.max(...points.map(p=>Number(p[valueKey]||0)), 1);
  return `<div class="read-chart bar-chart">${points.map(p=>`<div class="bar-col"><span class="bar-value">${money(p[valueKey]||0)}</span><i style="height:${Math.max(8, Math.round(Number(p[valueKey]||0)*100/max))}%"></i><small>${p[labelKey]}</small></div>`).join('')}</div>`;
}
function serviceCategoryData(){
  const map = {};
  db.services.forEach(s => {
    const items = Array.isArray(s.items) && s.items.length ? s.items : [s.title || 'Diğer'];
    items.forEach(item => { map[item] = (map[item] || 0) + Number(s.amount||0); });
  });
  return Object.entries(map).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value).slice(0,5);
}
function horizontalRanking(data){
  const max = Math.max(...data.map(x=>Number(x.value||0)), 1);
  return `<div class="rank-bars">${data.map(x=>`<div class="rank-row"><span>${x.label}</span><div><i style="width:${Math.max(4, Math.round(Number(x.value||0)*100/max))}%"></i></div><b>${money(x.value)}</b></div>`).join('') || `<div class="notice">Gösterilecek veri yok.</div>`}</div>`;
}
function donutChart(parts){
  const total = parts.reduce((t,p)=>t+Number(p.value||0),0) || 1;
  let offset = 25;
  const circles = parts.map((p,i)=>{
    const val = Math.max(0, Number(p.value||0));
    const dash = (val/total)*100;
    const cls = ['donut-a','donut-b','donut-c','donut-d'][i%4];
    const c = `<circle class="${cls}" cx="18" cy="18" r="15.915" fill="transparent" stroke-width="4" stroke-dasharray="${dash} ${100-dash}" stroke-dashoffset="${offset}"></circle>`;
    offset -= dash;
    return c;
  }).join('');
  return `<div class="donut-wrap"><svg viewBox="0 0 36 36" class="donut"><circle class="donut-bg" cx="18" cy="18" r="15.915" fill="transparent" stroke-width="4"></circle>${circles}</svg><div class="donut-legend">${parts.map(p=>`<span><i></i>${p.label}: <b>${money(p.value)}</b></span>`).join('')}</div></div>`;
}
function reportMonthlyData(){
  return lastSixMonths().map(m => ({
    label: monthLabel(m),
    ciro: db.services.filter(s=>monthKey(s.date)===m).reduce((t,s)=>t+Number(s.amount||0),0),
    tahsilat: db.payments.filter(p=>monthKey(p.date)===m).reduce((t,p)=>t+Number(p.amount||0),0)
  }));
}
function debtAgingData(){
  const buckets = [{label:'0-30 Gün',value:0},{label:'31-60 Gün',value:0},{label:'60+ Gün',value:0}];
  db.services.forEach(s=>{
    const val = unpaidServiceAmount(s);
    if(val <= 0) return;
    const d = daysBetween(s.date);
    if(d <= 30) buckets[0].value += val;
    else if(d <= 60) buckets[1].value += val;
    else buckets[2].value += val;
  });
  return buckets;
}
function debtCustomerRows(){
  return db.customers.map(c=>({
    customer:c,
    debt:customerDebt(c.id),
    vehicles:getVehiclesByCustomer(c.id).length
  })).filter(x=>x.debt>0).sort((a,b)=>b.debt-a.debt);
}
function reportSummaryCards(totalRevenue,totalPaid,totalDebt){
  return `<div class="grid stats report-stats">
    ${stat('Toplam Ciro', money(totalRevenue), 'good', 'fa-solid fa-chart-line')}
    ${stat('Toplam Tahsilat', money(totalPaid), 'good', 'fa-solid fa-money-bill-wave')}
    ${stat('Toplam Alacak', money(totalDebt), totalDebt>0?'bad':'good', 'fa-solid fa-file-invoice-dollar')}
    ${stat('Toplam Servis', db.services.length, '', 'fa-solid fa-screwdriver-wrench')}
  </div>`;
}
function renderDebts(){
  const totalRevenue = db.services.reduce((t,s)=>t+Number(s.amount||0),0);
  const totalPaid = db.payments.reduce((t,p)=>t+Number(p.amount||0),0);
  const totalDebt = Math.max(totalRevenue-totalPaid,0);
  const aging = debtAgingData();
  const rows = debtCustomerRows();
  const debtTrend = reportMonthlyData().map(x=>({label:x.label, debt:Math.max(x.ciro-x.tahsilat,0)}));
  document.getElementById("debts").innerHTML = `
    <div class="report-hero"><div><h2>Borç Takibi</h2><p>Müşteri borç durumlarını sadece okunur grafiklerle takip et.</p></div><span class="date-pill"><i class="fa-regular fa-calendar"></i> ${new Date().toLocaleDateString('tr-TR',{day:'2-digit',month:'long',year:'numeric'})}</span></div>
    <div class="grid stats report-stats debt-stats">
      ${stat('Toplam Alacak', money(totalDebt), totalDebt>0?'bad':'good', 'fa-solid fa-wallet')}
      ${stat('0-30 Gün', money(aging[0].value), 'warn', 'fa-solid fa-hourglass-start')}
      ${stat('31-60 Gün', money(aging[1].value), 'warn', 'fa-solid fa-hourglass-half')}
      ${stat('60+ Gün', money(aging[2].value), 'bad', 'fa-solid fa-triangle-exclamation')}
    </div>
    <div class="grid report-grid two">
      <div class="panel read-only-panel"><div class="panel-head"><h3>Borç Yaşlandırma Grafiği</h3><span class="readonly-badge">Sadece okunur</span></div>${donutChart(aging)}</div>
      <div class="panel read-only-panel"><div class="panel-head"><h3>Borç Trend Grafiği</h3><span class="readonly-badge">Sadece okunur</span></div>${simpleLineChart(debtTrend,'debt')}</div>
    </div>
    <div class="panel"><div class="panel-head"><h3>Borçlu Müşteriler</h3><span class="readonly-badge">${rows.length} kayıt</span></div>
      <div class="table-wrap"><table><thead><tr><th>Müşteri</th><th>Araç</th><th>Toplam Borç</th><th>Durum</th><th>İşlem</th></tr></thead><tbody>
        ${rows.map(x=>`<tr><td><b>${x.customer.name}</b></td><td>${x.vehicles}</td><td class="amount bad">${money(x.debt)}</td><td><span class="badge price-pending">Takipte</span></td><td><button class="small-btn" onclick="openCustomer('${x.customer.id}')">Detay</button></td></tr>`).join('') || emptyRow(5)}
      </tbody></table></div>
    </div>`;
}
function renderReports(){
  const totalRevenue = db.services.reduce((t,s)=>t+Number(s.amount||0),0);
  const totalPaid = db.payments.reduce((t,p)=>t+Number(p.amount||0),0);
  const totalDebt = Math.max(totalRevenue-totalPaid,0);
  const monthly = reportMonthlyData();
  const cats = serviceCategoryData();
  const paymentParts = [{label:'Tahsil Edilen',value:totalPaid},{label:'Kalan Alacak',value:totalDebt}];
  document.getElementById("reports").innerHTML = `
    <div class="report-hero"><div><h2>Raporlar</h2><p>Gelir, gider ve servis performansını okunur grafiklerle analiz et.</p></div><span class="date-pill"><i class="fa-regular fa-calendar"></i> Son 6 Ay</span></div>
    ${reportSummaryCards(totalRevenue,totalPaid,totalDebt)}
    <div class="grid report-grid two">
      <div class="panel read-only-panel"><div class="panel-head"><h3>Aylık Ciro Grafiği</h3><span class="readonly-badge">Sadece okunur</span></div>${simpleLineChart(monthly,'ciro')}</div>
      <div class="panel read-only-panel"><div class="panel-head"><h3>Aylık Tahsilat Grafiği</h3><span class="readonly-badge">Sadece okunur</span></div>${simpleBarChart(monthly,'tahsilat')}</div>
    </div>
    <div class="grid report-grid two">
      <div class="panel read-only-panel"><div class="panel-head"><h3>Servis Dağılımı</h3><span class="readonly-badge">Kategori</span></div>${donutChart(cats.length ? cats : [{label:'Veri Yok',value:1}])}</div>
      <div class="panel read-only-panel"><div class="panel-head"><h3>Ödeme Durumu</h3><span class="readonly-badge">Cari</span></div>${donutChart(paymentParts)}</div>
    </div>
    <div class="panel read-only-panel"><div class="panel-head"><h3>En Çok Ciro Getiren Hizmetler</h3><span class="readonly-badge">Top 5</span></div>${horizontalRanking(cats)}</div>
    <div class="panel"><div class="panel-head"><h3>Genel Plaka Raporu</h3><span class="readonly-badge">Liste</span></div>${vehiclesTable(db.vehicles)}</div>`;
}
function renderSettings(){
  document.getElementById("settings").innerHTML = `
    <div class="panel clean-settings">
      <h3>Ayarlar</h3>
      <p class="notice">Veri yedeği alabilir, daha önce alınan yedeği geri yükleyebilir veya sistemi sıfırlayabilirsin.</p>
      <div class="toolbar settings-actions">
        <button class="btn" onclick="exportData()">Veri Yedeği Al</button>
        <button class="btn" onclick="document.getElementById('importFile').click()">Yedekten Yükle</button>
        <input id="importFile" class="hidden" type="file" accept="application/json" onchange="importData(event)" />
        <button class="btn danger-btn" onclick="resetAllData()">Tüm Verileri Sıfırla</button>
      </div>
    </div>`;
}

function customersTable(list){
  return `<div class="table-wrap"><table><thead><tr><th>Ad Soyad / Firma</th><th>Telefon</th><th>Tür</th><th>Araç Sayısı</th>${isAdmin() ? `<th>Toplam Borç</th><th>Toplam Ödeme</th>` : ``}<th>İşlem</th></tr></thead><tbody>
  ${list.map(c=>`<tr><td><b>${c.name}</b></td><td>${c.phone || "-"}</td><td>${c.type || "-"}</td><td>${getVehiclesByCustomer(c.id).length}</td>${isAdmin() ? `<td class="amount ${customerDebt(c.id)>0?"bad":"good"}">${money(customerDebt(c.id))}</td><td class="amount good">${money(customerPaid(c.id))}</td>` : ``}<td><button class="small-btn" onclick="openCustomer('${c.id}')">Detay</button>${isAdmin() ? ` <button class="small-btn" onclick="printCustomerAccount('${c.id}')">Yazdır</button>` : ``}</td></tr>`).join("") || emptyRow(isAdmin()?7:5)}
  </tbody></table></div>`;
}
function vehiclesTable(list){
  return `<div class="table-wrap"><table><thead><tr><th>Plaka</th><th>Sahibi / Firma</th><th>Araç</th><th>Son Servis</th>${isAdmin() ? `<th>Plaka Borcu</th>` : ``}<th>Not</th><th>İşlem</th></tr></thead><tbody>
  ${list.map(v=>`<tr>
    <td><b>${v.noPlateName ? v.noPlateName + " / " + v.plate : v.plate}</b></td>
    <td>${getCustomer(v.customerId)?.name || "-"}</td>
    <td>${[v.brand,v.model,v.year].filter(Boolean).join(" ") || "-"}</td>
    <td>${lastServiceDate(v.id)}</td>
    ${isAdmin() ? `<td class="amount ${vehicleDebt(v.id)>0?"bad":"good"}">${money(vehicleDebt(v.id))}</td>` : ``}
    <td>${v.note || "-"}</td>
    <td>
      <button class="small-btn" onclick="openVehicle('${v.id}')">Geçmişi Gör</button>
      ${isAdmin() ? `
        <button class="small-btn" onclick="printServiceHistory('${v.id}')">Yazdır</button>
        <button class="small-btn" onclick="shareServiceHistoryWhatsApp('${v.id}')">WP</button>
        <button class="small-btn danger-btn" onclick="deleteVehicle('${v.id}')">Sil</button>
      ` : ``}
    </td>
  </tr>`).join("") || emptyRow(isAdmin()?7:6)}
  </tbody></table></div>`;
}
function servicesTable(list){
  return `<div class="table-wrap"><table><thead><tr><th>Tarih</th><th>Plaka</th><th>Müşteri/Firma</th><th>Geldiği KM</th><th>Sonraki Bakım KM</th><th>Seçilen İşlemler</th><th>Durum</th>${isAdmin() ? `<th>İşçilik</th><th>Parça</th><th>Toplam</th>` : ``}<th>Not</th><th>İşlemi Yapan</th><th>İşlem</th></tr></thead><tbody>
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
      <td>${servicePricingBadge(s)}</td>
      ${isAdmin() ? `<td class="amount ${servicePricingPending(s)?"warn":"good"}">${serviceMoneyText(s,"laborAmount")}</td><td class="amount ${servicePricingPending(s)?"warn":"good"}">${serviceMoneyText(s,"partsAmount")}</td><td class="amount ${servicePricingPending(s)?"warn":"good"}">${serviceMoneyText(s,"amount")}</td>` : ``}
      <td>${s.note || "-"}</td>
      <td>${s.createdBy || "-"}</td>
      <td>
        ${isAdmin() ? `<div class="service-action-stack">
        <button class="small-btn primary" onclick="openPricingModal('${s.id}')">${servicePricingPending(s) ? "Fiyatlandır" : "Fiyat Düzenle"}</button>
        ${(!servicePricingPending(s) && Number(s.amount||0)>0) ? (serviceIsPaid(s.id) ? `<span class="paid-badge">Ödendi</span>` : `<button class="small-btn paid-btn" onclick="markServicePaid('${s.id}')">Ödendi</button>`) : ``}
        <button class="small-btn" onclick="printSingleService('${s.id}')">Yazdır</button>
        <button class="small-btn" onclick="shareSingleServiceWhatsApp('${s.id}')">WP</button>
        </div>` : `<span class="badge">Personel</span>`}
      </td>
    </tr>`;
  }).join("") || emptyRow(isAdmin()?13:10)}
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
  ${list.map(c=>`<tr><td><b>${c.name}</b></td><td>${c.count}</td><td class="amount ${c.debt>0?"bad":"good"}">${money(c.debt)}</td><td><button class="small-btn" onclick="openCustomer('${c.id}')">Araçları Gör</button>${isAdmin() ? ` <button class="small-btn" onclick="printCustomerAccount('${c.id}')">Yazdır</button>` : ``}</td></tr>`).join("") || emptyRow(4)}
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
    <div class="detail-title"><div><span class="badge">Müşteri / Firma Kartı</span><h2>${c.name}</h2><p>${c.phone || "-"} ${c.note ? " • " + c.note : ""}</p></div><div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">${isAdmin() ? `<button class="btn" onclick="printCustomerAccount('${c.id}')">Müşteri Hesabı Yazdır</button>` : ``}<button class="btn" onclick="openPage('${lastPageBeforeDetail}')">Geri</button></div></div>
    <div class="customer-card">
      <div class="info-box"><span>Ad soyad / firma adı</span><b>${c.name}</b></div><div class="info-box"><span>Telefon</span><b>${c.phone || "-"}</b></div><div class="info-box"><span>Araç sayısı</span><b>${vehicles.length}</b></div>
      ${isAdmin() ? `<div class="info-box"><span>Toplam borç</span><b class="${customerDebt(c.id)>0?"bad":"good"}">${money(customerDebt(c.id))}</b></div><div class="info-box"><span>Toplam ödeme</span><b class="good">${money(customerPaid(c.id))}</b></div><div class="info-box"><span>Toplam işlem tutarı</span><b>${money(customerTotal(c.id))}</b></div>` : `<div class="info-box"><span>Finans Bilgileri</span><b class="muted">🔒 Sadece admin görür</b></div>`}
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

  const vehicleName =
    `${v?.noPlateName ? v.noPlateName + " / " : ""}${v?.plate || "-"}`;

  const vehicleModel =
    [v?.brand,v?.model,v?.year].filter(Boolean).join(" ") || "-";

  let text = `HİÇKORKMAZ GARAJ\n`;
  text += `------------------------------\n\n`;

  text += `[Müşteri/Firma]\n`;
  text += `${c?.name || "-"}\n\n`;

  text += `[Araç]\n`;
  text += `${vehicleName}\n`;
  text += `${vehicleModel}\n\n`;

  text += `[Servis Tarihi]\n`;
  text += `${s.date || "-"}\n\n`;

  text += `[KM Bilgileri]\n`;
  text += `Geldiği KM: ${kmFormat(s.currentKm)}\n`;
  text += `Sonraki Bakım: ${kmFormat(s.nextKm)}\n\n`;

  text += `[Yapılan İşlemler]\n`;
  text += `${serviceItemsText(s)}${s.title ? " / " + s.title : ""}\n\n`;

  text += `[Ücret Bilgileri]\n`;
  text += `İşçilik: ${money(s.laborAmount || 0)}\n`;
  text += `Parça: ${money(s.partsAmount || 0)}\n`;
  text += `Toplam: ${money(s.amount)}\n\n`;

  if(s.note){
    text += `[Not]\n`;
    text += `${s.note}\n\n`;
  }

  text += `[İşlemi Yapan]\n`;
  text += `${s.createdBy || "-"}\n\n`;

  text += `Teşekkür ederiz.\n`;
  text += `Hiçkorkmaz Garaj`;

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


function getPaymentsByCustomer(customerId){
  const vehicleIds = getVehiclesByCustomer(customerId).map(v => v.id);
  return db.payments
    .filter(p => p.customerId === customerId || vehicleIds.includes(p.vehicleId))
    .sort((a,b)=>safe(b.date).localeCompare(safe(a.date)));
}

function customerAccountHtml(customerId){
  const c = getCustomer(customerId);
  if(!c) return "<p>Müşteri/Firma bulunamadı.</p>";

  const vehicles = getVehiclesByCustomer(customerId);
  const payments = getPaymentsByCustomer(customerId);
  const total = customerTotal(customerId);
  const paid = customerPaid(customerId);
  const debt = customerDebt(customerId);

  const vehiclesHtml = vehicles.map(v => {
    const rows = getServicesByVehicle(v.id);
    const vehicleName = `${v.noPlateName ? v.noPlateName + " / " : ""}${v.plate || "-"}`;
    const serviceRows = rows.map(s => `
      <tr>
        <td>${s.date || "-"}</td>
        <td>${kmFormat(s.currentKm)}</td>
        <td>${kmFormat(s.nextKm)}</td>
        <td>${serviceItemsText(s)}${s.title ? " / " + s.title : ""}</td>
        <td>${servicePricingPending(s) ? "Fiyat bekliyor" : money(s.laborAmount || 0)}</td>
        <td>${servicePricingPending(s) ? "Fiyat bekliyor" : money(s.partsAmount || 0)}</td>
        <td><b>${servicePricingPending(s) ? "Fiyat bekliyor" : money(s.amount)}</b></td>
        <td>${s.note || "-"}</td>
        <td>${s.createdBy || "-"}</td>
      </tr>
    `).join("");

    return `
      <div class="section">
        <h3>Araç: ${vehicleName}</h3>
        <p><b>Marka/Model:</b> ${[v.brand,v.model,v.year].filter(Boolean).join(" ") || "-"}</p>
        <p><b>Son KM:</b> ${kmFormat(vehicleLastKm(v.id))} &nbsp; <b>Sonraki Bakım:</b> ${kmFormat(vehicleNextKm(v.id))} &nbsp; <b>Araç Borcu:</b> ${money(vehicleDebt(v.id))}</p>
        <table>
          <thead>
            <tr>
              <th>Tarih</th><th>Geldiği KM</th><th>Sonraki Bakım</th><th>Yapılan İşlemler</th><th>İşçilik</th><th>Parça</th><th>Toplam</th><th>Not</th><th>İşlemi Yapan</th>
            </tr>
          </thead>
          <tbody>${serviceRows || `<tr><td colspan="9">Servis kaydı bulunamadı.</td></tr>`}</tbody>
        </table>
      </div>
    `;
  }).join("");

  const paymentsHtml = payments.map(p => {
    const v = getVehicle(p.vehicleId);
    const plateText = v ? (v.noPlateName ? v.noPlateName + " / " + v.plate : v.plate) : (p.manualPlate || "-");
    return `<tr><td>${p.date || "-"}</td><td>${plateText}</td><td>${paymentTypeText(p)}</td><td><b>${money(p.amount)}</b></td><td>${p.note || "-"}</td><td>${p.createdBy || "-"}</td></tr>`;
  }).join("");

  return `
    <!doctype html>
    <html lang="tr">
    <head>
      <meta charset="utf-8">
      <title>Müşteri Hesap Dökümü - ${c.name}</title>
      <style>
        body{font-family:Arial,sans-serif;color:#111;margin:22px}
        .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}
        h1{margin:0;font-size:24px} h2{margin:4px 0 0;font-size:18px} h3{margin:18px 0 8px}
        p{margin:4px 0}.muted{color:#555}.section{page-break-inside:avoid;margin-top:18px}
        .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:16px 0}
        .box{border:1px solid #ccc;border-radius:8px;padding:10px}.box span{display:block;color:#666;font-size:12px}.box b{display:block;margin-top:5px;font-size:16px}
        table{width:100%;border-collapse:collapse;margin-top:10px;font-size:11px} th,td{border:1px solid #ccc;padding:7px;text-align:left;vertical-align:top} th{background:#f2f2f2}
        .footer{margin-top:24px;color:#666;font-size:12px}@media print{button{display:none} body{margin:10px}.section{page-break-inside:avoid}}
      </style>
    </head>
    <body>
      <button onclick="window.print()" style="padding:10px 14px;margin-bottom:14px">Yazdır / PDF Kaydet</button>
      <div class="head"><div><h1>Hiçkorkmaz Garaj</h1><h2>Müşteri/Firma Hesap Dökümü</h2><p class="muted">Servis, tahsilat ve cari borç raporu</p></div><div><p><b>Çıktı Tarihi:</b> ${today()}</p></div></div>
      <p><b>Müşteri/Firma:</b> ${c.name}</p><p><b>Telefon:</b> ${c.phone || "-"}</p><p><b>Tür:</b> ${c.type || "-"}</p>
      <div class="summary">
        <div class="box"><span>Araç Sayısı</span><b>${vehicles.length}</b></div><div class="box"><span>Toplam İşlem</span><b>${money(total)}</b></div><div class="box"><span>Toplam Tahsilat</span><b>${money(paid)}</b></div><div class="box"><span>Kalan Borç</span><b>${money(debt)}</b></div>
      </div>
      ${vehiclesHtml || `<div class="section"><h3>Araçlar</h3><p>Kayıtlı araç bulunamadı.</p></div>`}
      <div class="section"><h3>Tahsilatlar</h3><table><thead><tr><th>Tarih</th><th>Plaka</th><th>Tür</th><th>Tutar</th><th>Not</th><th>İşlemi Yapan</th></tr></thead><tbody>${paymentsHtml || `<tr><td colspan="6">Tahsilat kaydı bulunamadı.</td></tr>`}</tbody></table></div>
      <div class="footer">Bu çıktı Hiçkorkmaz Garaj V8 sistemi üzerinden oluşturulmuştur.</div>
    </body>
    </html>
  `;
}

window.printCustomerAccount = function(customerId){
  if(!canOutput()) return;
  const w = window.open("", "_blank");
  w.document.open();
  w.document.write(customerAccountHtml(customerId));
  w.document.close();
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
      ${isAdmin() ? `<div class="info-box"><span>Toplam borç</span><b class="${vehicleDebt(v.id)>0?"bad":"good"}">${money(vehicleDebt(v.id))}</b></div><div class="info-box"><span>Toplam işlem</span><b>${money(vehicleTotal(v.id))}</b></div><div class="info-box"><span>Toplam tahsilat</span><b class="good">${money(vehiclePaid(v.id))}</b></div>` : `<div class="info-box"><span>Finans Bilgileri</span><b class="muted">🔒 Sadece admin görür</b></div>`}
    </div>
    ${isAdmin() ? `<div class="grid two"><div class="panel"><h3>Servis Geçmişi</h3>${servicesTable(getServicesByVehicle(v.id))}</div><div class="panel"><h3>Tahsilat Geçmişi</h3>${paymentsTable(getPaymentsByVehicle(v.id))}</div></div>` : `<div class="panel"><h3>Servis Geçmişi</h3>${servicesTable(getServicesByVehicle(v.id))}</div>`}
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
      return `<div class="search-row" onclick="openCustomer('${c.id}')"><b>👤 ${c.name}</b><span>${count} kayıtlı plaka${isAdmin() ? ` • toplam borç: ${money(customerDebt(c.id))}` : ``}</span></div>`;
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

const btnCustomer = document.getElementById("btnCustomer");
const btnVehicle = document.getElementById("btnVehicle");
const btnService = document.getElementById("btnService");
const btnPayment = document.getElementById("btnPayment");
if(btnCustomer) btnCustomer.onclick = () => openModal("customer");
if(btnVehicle) btnVehicle.onclick = () => openModal("vehicle");
if(btnService) btnService.onclick = () => openModal("service");
if(btnPayment) btnPayment.onclick = () => openModal("payment");
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
    const priceFields = isAdmin()
      ? `${field("İşçilik Tutarı","laborAmount","number","0",false)}${field("Parça Tutarı","partsAmount","number","0",false)}<div class="field"><label>Toplam Tutar</label><input id="serviceTotalPreview" type="text" value="0 TL" readonly></div>`
      : `<p class="notice"><b>Personel fiyat giremez.</b> Servis kaydı admin ekranına “Fiyat bekliyor” olarak düşer. Admin daha sonra fiyatlandırma yapar.</p>`;

    document.getElementById("modalBody").innerHTML = `${field("Plaka / Araç Tanımı / Müşteri-Firma Adı","serviceTarget","text","")}${field("Servis Tarihi","date","date",today())}${field("Geldiği KM","currentKm","number")}${field("Bir Sonraki Bakım KM","nextKm","number","",false)}${serviceItemCheckboxes()}${field("Ek İşlem Başlığı / Açıklama","title","text","",false)}${priceFields}<div id="serviceTargetChoice" class="hidden">${selectField("Birden fazla araç bulunduysa seç","manualVehicleId",serviceTargetOptions())}</div>${textareaField("Not","note")}<p class="notice">Plaka, plakasız araç tanımı veya müşteri/firma adı yazabilirsin. Tek araç bulunursa otomatik kaydeder. Birden fazla araç varsa aşağıdan doğru aracı seçebilirsin.</p>`;
    setTimeout(() => { bindServiceTotalPreview(); bindServiceTargetFinder(); }, 0);
  }
  if(type === "payment"){
    document.getElementById("modalBody").innerHTML = `${field("Müşteri / Firma Adı","customerName","text","",false)}${field("Plaka","plate","text","",false)}${field("Ödeme Tarihi","date","date",today())}${field("Tutar","amount","number")}${textareaField("Not","note")}<p class="notice">Plaka kayıtlıysa ödeme araç borcundan düşer. Plaka boşsa ödeme Müşteri/Firma cari hesabından düşer.</p>`;
  }
  modal.showModal();
};

window.markServicePaid = function(serviceId){
  if(!requireAdmin()) return;
  const s = db.services.find(x => x.id === serviceId);
  if(!s){ alert("Servis kaydı bulunamadı."); return; }
  if(servicePricingPending(s) || Number(s.amount||0) <= 0){
    alert("Ödendi yapmadan önce servis fiyatını girmen gerekir.");
    return;
  }
  if(serviceIsPaid(serviceId)){
    alert("Bu servis zaten ödendi görünüyor.");
    return;
  }
  const v = getVehicle(s.vehicleId);
  const c = getCustomer(v?.customerId);
  const remaining = serviceRemainingAmount(serviceId) || Number(s.amount || 0);
  const ok = confirm(`${c?.name || "Müşteri"} için ${v ? (v.noPlateName ? v.noPlateName + " / " + v.plate : v.plate) : "araç"} servis kaydı ${money(remaining)} olarak ödendi işaretlensin mi?`);
  if(!ok) return;
  db.payments.push({
    id:newId("p"),
    customerId:c?.id || "",
    vehicleId:v?.id || "",
    serviceId:s.id,
    manualPlate:v ? "" : "",
    paymentType:"service_paid",
    date:today(),
    amount:remaining,
    note:`Servis ödendi: ${serviceItemsText(s)}`,
    createdBy:activeUser?.email || "-",
    createdAt:new Date().toISOString()
  });
  s.paymentStatus = "paid";
  s.paidAt = new Date().toISOString();
  s.paidBy = activeUser?.email || "-";
  persist();
  alert("Tahsilat kaydı oluşturuldu ve bakiye otomatik düşüldü.");
};

window.openPricingModal = function(serviceId){
  if(!requireAdmin()) return;
  const s = db.services.find(x => x.id === serviceId);
  if(!s){ alert("Servis kaydı bulunamadı."); return; }
  const v = getVehicle(s.vehicleId);
  const c = getCustomer(v?.customerId);
  modalType = "pricing";
  document.getElementById("modalTitle").textContent = "Servis Fiyatlandır";
  document.getElementById("modalBody").innerHTML = `
    <input type="hidden" name="serviceId" value="${s.id}">
    <p class="notice"><b>${c?.name || "-"}</b> / ${v ? (v.noPlateName ? v.noPlateName + " / " + v.plate : v.plate) : "-"}<br>${s.date || "-"} tarihli servis kaydı fiyatlandırılıyor.</p>
    ${field("İşçilik Tutarı","laborAmount","number",Number(s.laborAmount || 0),false)}
    ${field("Parça Tutarı","partsAmount","number",Number(s.partsAmount || 0),false)}
    <div class="field"><label>Toplam Tutar</label><input id="serviceTotalPreview" type="text" value="${money(s.amount || 0)}" readonly></div>
    ${textareaField("Fiyatlandırma Notu","pricingNote")}
  `;
  setTimeout(bindServiceTotalPreview, 0);
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
    const laborAmount = isAdmin() ? Number(obj.laborAmount || 0) : 0;
    const partsAmount = isAdmin() ? Number(obj.partsAmount || 0) : 0;
    const totalAmount = laborAmount + partsAmount;
    db.services.push({
      id:newId("s"),
      vehicleId:foundVehicle.id,
      date:obj.date,
      currentKm:currentKm,
      nextKm:Number(obj.nextKm || 0),
      items:selectedItems,
      title:obj.title,
      laborAmount:laborAmount,
      partsAmount:partsAmount,
      amount:totalAmount,
      pricingStatus:isAdmin() ? "priced" : "pending",
      pricedBy:isAdmin() ? (activeUser?.email || "-") : "",
      pricedAt:isAdmin() ? new Date().toISOString() : "",
      note:obj.note,
      createdBy:activeUser?.email || "-",
      createdByRole:activeUser?.role || "-",
      createdAt:new Date().toISOString()
    });
  }
  if(modalType === "pricing"){
    if(!requireAdmin()) return;
    const s = db.services.find(x => x.id === obj.serviceId);
    if(!s){ alert("Servis kaydı bulunamadı."); return; }
    const laborAmount = Number(obj.laborAmount || 0);
    const partsAmount = Number(obj.partsAmount || 0);
    s.laborAmount = laborAmount;
    s.partsAmount = partsAmount;
    s.amount = laborAmount + partsAmount;
    s.pricingStatus = "priced";
    s.pricedBy = activeUser?.email || "-";
    s.pricedAt = new Date().toISOString();
    if(obj.pricingNote){
      s.pricingNote = obj.pricingNote;
    }
  }
  if(modalType === "payment"){
    const typedCustomerName = safe(obj.customerName).trim();
    const typedPlate = safe(obj.plate).trim();
    const foundVehicle = typedPlate ? findVehicleByPlate(typedPlate) : null;

    let targetCustomer = null;
    let paymentType = "customer_only";

    if(foundVehicle){
      // Plaka kayıtlıysa: sadece araç tahsilatı
      targetCustomer = getCustomer(foundVehicle.customerId);
      paymentType = "vehicle_only";
    }else{
      // Plaka yoksa veya plaka kayıtlı değilse: müşteri/firma cari hesabı
      if(!typedCustomerName){
        alert("Plaka kayıtlı değilse veya plaka boşsa Müşteri/Firma Adı yazman gerekir.");
        return;
      }
      targetCustomer = findOrCreateCustomerByName(typedCustomerName, "");
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
  a.href = url; a.download = "hickorkmaz-garaj-v9-final-yedek.json"; a.click();
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

  const password = prompt("Silme şifresini giriniz:");

  if(password !== DELETE_PASSWORD){
    alert("Hatalı şifre!");
    return;
  }

  const ok = confirm(
    "DİKKAT!\n\nTüm müşteri, araç, servis ve tahsilat kayıtları silinecek.\n\nDevam etmek istiyor musun?"
  );

  if(!ok) return;

  db = {
    customers: [],
    vehicles: [],
    services: [],
    payments: []
  };

  persist();
  alert("Tüm veriler silindi.");
};

window.deleteVehicle = function(vehicleId){
  if(!requireAdmin()) return;

  const password = prompt("Silme şifresini giriniz:");

  if(password !== DELETE_PASSWORD){
    alert("Hatalı şifre!");
    return;
  }

  const v = getVehicle(vehicleId);
  const plateText = v ? (v.noPlateName ? v.noPlateName + " / " + v.plate : v.plate) : "Bu araç";

  const ok = confirm(`${plateText} silinecek.\n\nBu araca ait servis ve tahsilat kayıtları da silinir.\n\nEmin misin?`);
  if(!ok) return;

  db.services = db.services.filter(s => s.vehicleId !== vehicleId);
  db.payments = db.payments.filter(p => p.vehicleId !== vehicleId);
  db.vehicles = db.vehicles.filter(v => v.id !== vehicleId);

  persist();
  alert("Araç ve bağlı kayıtları silindi.");
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