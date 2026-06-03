import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const fs = getFirestore(app);

let vehicles = [];
let services = [];
let payments = [];
let currentUser = null;
let role = "personel";
let unsubVehicles = null;
let unsubServices = null;
let unsubPayments = null;

const $ = id => document.getElementById(id);
const money = n => (Number(n || 0)).toLocaleString('tr-TR',{style:'currency',currency:'TRY'});
const today = () => new Date().toISOString().slice(0,10);
const plateClean = v => (v || '').trim().toLocaleUpperCase('tr-TR');
const serviceTotal = s => (+s.laborCost || 0) + (+s.partsCost || 0);
const canDelete = () => role === 'admin';

function init(){
  $('serviceDate').value = today();
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  $('loginForm').onsubmit = login;
  $('logoutBtn').onclick = () => signOut(auth);
  $('vehicleForm').onsubmit = saveVehicle;
  $('serviceForm').onsubmit = saveService;
  $('servicePlateSearch').oninput = handleServicePlateSearch;
  $('serviceVehicle').onchange = renderSelectedVehicleInfo;
  $('clearVehicle').onclick = clearVehicleForm;
  $('clearService').onclick = clearServiceForm;
  $('vehicleSearch').oninput = renderVehicles;
  $('historySearch').oninput = renderHistory;
  $('accountSearch').oninput = renderAccounts;
  $('paymentForm').onsubmit = savePayment;
  $('clearPayment').onclick = clearPaymentForm;
  $('paymentDate').value = today();
  $('exportBtn').onclick = exportData;
  $('importFile').onchange = importData;
  setupInstall(); registerSW(); watchAuth();
}

function switchTab(id){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
  document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===id));
}
async function login(e){
  e.preventDefault();
  try { await signInWithEmailAndPassword(auth, $('email').value.trim(), $('password').value); }
  catch(err){ alert('Giriş başarısız: ' + err.message); }
}
function watchAuth(){
  onAuthStateChanged(auth, async user => {
    currentUser = user;
    if(!user){
      $('loginView').classList.remove('hidden'); $('appView').classList.add('hidden'); $('logoutBtn').classList.add('hidden'); $('userInfo').textContent='Giriş bekleniyor';
      if(unsubVehicles) unsubVehicles(); if(unsubServices) unsubServices(); if(unsubPayments) unsubPayments(); if(unsubPayments) unsubPayments();
      return;
    }
    role = user.email && user.email.startsWith('admin') ? 'admin' : 'personel';
    $('loginView').classList.add('hidden'); $('appView').classList.remove('hidden'); $('logoutBtn').classList.remove('hidden'); $('userInfo').textContent = `${user.email} • ${role}`;
    listenData();
  });
}
function listenData(){
  if(unsubVehicles) unsubVehicles(); if(unsubServices) unsubServices(); if(unsubPayments) unsubPayments();
  unsubVehicles = onSnapshot(query(collection(fs,'vehicles'), orderBy('plate')), snap=>{ vehicles=snap.docs.map(d=>({id:d.id,...d.data()})); render(); });
  unsubServices = onSnapshot(query(collection(fs,'services'), orderBy('date','desc')), snap=>{ services=snap.docs.map(d=>({id:d.id,...d.data()})); render(); });
  unsubPayments = onSnapshot(query(collection(fs,'payments'), orderBy('date','desc')), snap=>{ payments=snap.docs.map(d=>({id:d.id,...d.data()})); render(); });
}

async function saveVehicle(e){
  e.preventDefault();
  const id = $('vehicleId').value;
  const plate = plateClean($('plate').value);
  if(!plate) return alert('Plaka zorunlu.');
  const duplicate = vehicles.find(x=>x.plate===plate && x.id!==id);
  if(duplicate) return alert('Bu plaka zaten kayıtlı.');
  const data = {
    plate, model:$('model').value.trim(), owner:$('owner').value.trim(), phone:$('phone').value.trim(),
    currentKm:+$('currentKm').value||0, lastServiceDate:$('lastServiceDate').value||'', nextServiceKm:+$('nextServiceKm').value||0,
    note:$('vehicleNote').value.trim(), updatedAt:serverTimestamp(), updatedBy:currentUser.email
  };
  if(id) await setDoc(doc(fs,'vehicles',id), data, {merge:true}); else await addDoc(collection(fs,'vehicles'), {...data, createdAt:serverTimestamp()});
  clearVehicleForm();
}
function clearVehicleForm(){['vehicleId','plate','model','owner','phone','currentKm','lastServiceDate','nextServiceKm','vehicleNote'].forEach(id=>$(id).value='');}
function editVehicle(id){const v=vehicles.find(x=>x.id===id); if(!v)return; $('vehicleId').value=v.id;$('plate').value=v.plate;$('model').value=v.model||'';$('owner').value=v.owner||'';$('phone').value=v.phone||'';$('currentKm').value=v.currentKm||'';$('lastServiceDate').value=v.lastServiceDate||'';$('nextServiceKm').value=v.nextServiceKm||'';$('vehicleNote').value=v.note||''; switchTab('vehicles'); window.scrollTo({top:0,behavior:'smooth'});}
async function deleteVehicle(id){ if(!canDelete()) return alert('Silme yetkisi sadece adminde.'); if(!confirm('Araç ve servis geçmişi silinsin mi?')) return; await deleteDoc(doc(fs,'vehicles',id)); const ss=services.filter(s=>s.vehicleId===id); for(const s of ss) await deleteDoc(doc(fs,'services',s.id)); }

async function saveService(e){
  e.preventDefault();
  const typedPlate = plateClean($('servicePlateSearch').value);
  let vehicleId = $('serviceVehicle').value;
  let vehicle = vehicles.find(v=>v.id===vehicleId);
  if(typedPlate){
    const found = vehicles.find(v=>plateClean(v.plate)===typedPlate);
    if(found){ vehicle = found; vehicleId = found.id; $('serviceVehicle').value = found.id; }
  }
  if(!vehicle) return alert('Plaka bulunamadı. Önce araç kartını oluştur veya kayıtlı plakayı seç.');
  const id = $('serviceId').value;
  const km = +$('serviceKm').value || 0;
  const date = $('serviceDate').value || today();
  const data = {
    vehicleId, plate:vehicle.plate, km, date,
    oil:$('oil').value, oilFilter:$('oilFilter').value, airFilter:$('airFilter').value, pollenFilter:$('pollenFilter').value,
    brakePad:$('brakePad').value, battery:$('battery').value, tire:$('tire').value,
    note:$('serviceNote').value.trim(), laborCost:+$('laborCost').value||0, partsCost:+$('partsCost').value||0,
    updatedAt:serverTimestamp(), updatedBy:currentUser.email
  };
  if(id) await setDoc(doc(fs,'services',id), data, {merge:true}); else await addDoc(collection(fs,'services'), {...data, createdAt:serverTimestamp()});
  const updateVehicle = { currentKm: Math.max(vehicle.currentKm||0, km), lastServiceDate: date, updatedAt:serverTimestamp() };
  await setDoc(doc(fs,'vehicles',vehicleId), updateVehicle, {merge:true});
  clearServiceForm();
}
function clearServiceForm(){['serviceId','serviceKm','serviceNote','laborCost','partsCost','servicePlateSearch'].forEach(id=>$(id).value=''); ['oil','oilFilter','airFilter','pollenFilter','brakePad','battery','tire'].forEach(id=>$(id).value='değişmedi'); $('serviceDate').value=today(); renderSelectedVehicleInfo();}
function editService(id){const s=services.find(x=>x.id===id); if(!s)return; $('serviceId').value=s.id;$('serviceVehicle').value=s.vehicleId;$('serviceKm').value=s.km||'';$('serviceDate').value=s.date||today();$('oil').value=s.oil||'değişmedi';$('oilFilter').value=s.oilFilter||'değişmedi';$('airFilter').value=s.airFilter||'değişmedi';$('pollenFilter').value=s.pollenFilter||'değişmedi';$('brakePad').value=s.brakePad||'değişmedi';$('battery').value=s.battery||'değişmedi';$('tire').value=s.tire||'değişmedi';$('serviceNote').value=s.note||'';$('laborCost').value=s.laborCost||'';$('partsCost').value=s.partsCost||''; const v=vehicles.find(x=>x.id===s.vehicleId); if(v){$('servicePlateSearch').value=v.plate;} renderSelectedVehicleInfo(); switchTab('service'); window.scrollTo({top:0,behavior:'smooth'});}
async function deleteService(id){ if(!canDelete()) return alert('Silme yetkisi sadece adminde.'); if(confirm('Servis kaydı silinsin mi?')) await deleteDoc(doc(fs,'services',id)); }

function render(){renderSelect(); renderDashboard(); renderVehicles(); renderHistory(); renderAccounts(); renderPaymentHistory();}
function renderDashboard(){
  const nowMonth = today().slice(0,7);
  const monthItems = services.filter(s => String(s.date || '').slice(0,7) === nowMonth);
  const totalRevenue = services.reduce((a,s)=>a+serviceTotal(s),0);
  const monthLabor = monthItems.reduce((a,s)=>a+(+s.laborCost||0),0);
  const monthParts = monthItems.reduce((a,s)=>a+(+s.partsCost||0),0);
  const monthRevenue = monthLabor + monthParts;
  const listed = vehicles.filter(v=>v.nextServiceKm).sort((a,b)=>(+a.nextServiceKm||0)-(+b.nextServiceKm||0));

  $('totalVehicles').textContent=vehicles.length;
  $('totalServices').textContent=services.length;
  $('totalCost').textContent=money(totalRevenue);
  $('monthServices').textContent=monthItems.length;
  $('monthLabor').textContent=money(monthLabor);
  $('monthParts').textContent=money(monthParts);
  $('monthRevenue').textContent=money(monthRevenue);
  $('nextServiceCount').textContent=listed.length;
  $('dueList').innerHTML=listed.length?listed.map(v=>vehicleCard(v, true)).join(''):'<div class="empty">Gelecek servis KM kaydı yok.</div>';
}
function isDue(v){ return false; }
function renderSelect(){
  const selected = $('serviceVehicle').value;
  $('serviceVehicle').innerHTML = vehicles.length ? vehicles.map(v=>`<option value="${v.id}">${esc(v.plate)} - ${esc(v.model||'Araç')}</option>`).join('') : '<option value="">Önce araç ekle</option>';
  $('plateOptions').innerHTML = vehicles.map(v=>`<option value="${esc(v.plate)}">${esc(v.model||'Araç')} - ${esc(v.owner||'-')}</option>`).join('');
  if(selected && vehicles.some(v=>v.id===selected)) $('serviceVehicle').value = selected;
  renderSelectedVehicleInfo();
}
function renderVehicles(){ const q=($('vehicleSearch').value||'').toLocaleLowerCase('tr-TR'); const data=vehicles.filter(v=>[v.plate,v.model,v.owner,v.phone].join(' ').toLocaleLowerCase('tr-TR').includes(q)); $('vehicleList').innerHTML=data.length?data.map(v=>vehicleCard(v)).join(''):'<div class="empty">Kayıt bulunamadı.</div>'; }
function vehicleCard(v, compact=false){
  const ss=services.filter(s=>s.vehicleId===v.id);
  const total=ss.reduce((a,s)=>a+serviceTotal(s),0);
  const balance = customerBalance(customerKey(v));
  return `<article class="item"><div class="item-top"><div><h3>${esc(v.plate)}</h3><div class="meta">${esc(v.model||'-')} • ${esc(v.owner||'-')}<br>Mevcut KM: ${v.currentKm||0} • Gelecek servis KM: ${v.nextServiceKm||0}<br>Son servis: ${v.lastServiceDate||'-'} • Toplam: ${money(total)}<br>Cari bakiye: ${money(balance)}</div></div><span class="badge ok">${ss.length} servis</span></div>${compact?'':`<div class="actions"><button onclick="openService('${v.id}')">Servis Aç</button><button onclick="openPayment('${v.id}')">Ödeme</button><button onclick="showVehicleDetail('${v.id}')">Detay</button><button onclick="showVehicleHistory('${v.id}')">Geçmiş</button><button onclick="editVehicle('${v.id}')">Düzenle</button>${canDelete()?`<button class="dangerBtn" onclick="deleteVehicle('${v.id}')">Sil</button>`:''}</div>`}</article>`;
}
function showVehicleHistory(id){const v=vehicles.find(x=>x.id===id); if(!v)return; switchTab('history'); $('historySearch').value=v.plate; renderVehicleDetail(v.id); renderHistory();}
function showVehicleDetail(id){
  switchTab('history');
  renderVehicleDetail(id);
  const v = vehicles.find(x=>x.id===id);
  if(v) $('historySearch').value = v.plate;
  renderHistory();
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderVehicleDetail(id){
  const box = $('vehicleDetail');
  if(!box) return;
  const v = vehicles.find(x=>x.id===id);
  if(!v){ box.classList.add('hidden'); box.innerHTML=''; return; }
  const ss = services.filter(s=>s.vehicleId===id).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  const total = ss.reduce((a,s)=>a+serviceTotal(s),0);
  const balance = customerBalance(customerKey(v));
  const last = ss[0];
  box.classList.remove('hidden');
  box.innerHTML = `<div class="section-title"><h2>${esc(v.plate)} Araç Detayı</h2><button onclick="openService('${v.id}')">Servis Aç</button></div>
    <div class="stats">
      <article><b>${ss.length}</b><span>Servis Sayısı</span></article>
      <article><b>${money(total)}</b><span>Toplam Harcama</span></article>
      <article><b>${esc(v.lastServiceDate || last?.date || '-')}</b><span>Son Servis</span></article>
      <article><b>${v.nextServiceKm || '-'}</b><span>Gelecek Servis KM</span></article>
      <article><b>${money(balance)}</b><span>Cari Bakiye</span></article>
    </div>
    <div class="meta">${esc(v.model||'-')} • ${esc(v.owner||'-')} • ${esc(v.phone||'-')}<br>Mevcut KM: ${v.currentKm||0}${v.note?`<br>Not: ${esc(v.note)}`:''}</div>`;
}

function renderHistory(){
  const q=($('historySearch').value||'').toLocaleLowerCase('tr-TR');
  const data=services.filter(s=>[s.plate,s.note,s.oil,s.oilFilter,s.airFilter,s.pollenFilter,s.brakePad,s.battery,s.tire].join(' ').toLocaleLowerCase('tr-TR').includes(q));
  $('historyList').innerHTML=data.length?data.map(serviceCard).join(''):'<div class="empty">Servis kaydı bulunamadı.</div>';
}
function serviceCard(s){ const parts=[['Yağ',s.oil],['Yağ filtresi',s.oilFilter],['Hava filtresi',s.airFilter],['Polen filtresi',s.pollenFilter],['Fren balatası',s.brakePad],['Akü',s.battery],['Lastik',s.tire]].map(([k,v])=>`${k}: ${v||'değişmedi'}`).join(' • '); return `<article class="item"><div class="item-top"><div><h3>${esc(s.plate)} - ${s.date||''}</h3><div class="meta">${s.km||0} km<br>${esc(parts)}<br>${esc(s.note||'')}</div></div><span class="badge">${money(serviceTotal(s))}</span></div><div class="actions"><button onclick="sendWhatsApp('${s.id}')">WhatsApp</button><button onclick="generatePDF('${s.id}')">PDF</button><button onclick="editService('${s.id}')">Düzenle</button>${canDelete()?`<button class="dangerBtn" onclick="deleteService('${s.id}')">Sil</button>`:''}</div></article>`; }


function handleServicePlateSearch(){
  const q = plateClean($('servicePlateSearch').value);
  if(!q){ renderSelectedVehicleInfo(); return; }
  const exact = vehicles.find(v=>plateClean(v.plate)===q);
  const matches = vehicles.filter(v=>plateClean(v.plate).includes(q));
  const found = exact || (matches.length===1 ? matches[0] : null);
  if(found){
    $('serviceVehicle').value = found.id;
  }
  renderSelectedVehicleInfo(matches);
}

function renderSelectedVehicleInfo(matches=null){
  const box = $('selectedVehicleInfo');
  if(!box) return;
  const v = vehicles.find(x=>x.id===$('serviceVehicle').value);
  if(!v){ box.className='row-span empty'; box.innerHTML='Servis kaydı için plaka yaz veya araç kartından Servis Aç butonuna bas.'; return; }
  const total = services.filter(s=>s.vehicleId===v.id).reduce((a,s)=>a+serviceTotal(s),0);
  box.className='row-span item';
  box.innerHTML = `<b>${esc(v.plate)}</b> seçildi<br><span class="meta">${esc(v.model||'-')} • ${esc(v.owner||'-')} • ${esc(v.phone||'')}<br>Mevcut KM: ${v.currentKm||0} • Gelecek servis KM: ${v.nextServiceKm||0}<br>Son servis: ${v.lastServiceDate||'-'} • Toplam maliyet: ${money(total)}</span>`;
}

function openService(id){
  const v = vehicles.find(x=>x.id===id);
  if(!v) return;
  clearServiceForm();
  $('serviceVehicle').value = v.id;
  $('servicePlateSearch').value = v.plate;
  renderSelectedVehicleInfo();
  switchTab('service');
  setTimeout(()=>{ $('serviceKm').focus(); }, 100);
  window.scrollTo({top:0,behavior:'smooth'});
}

function serviceMessage(s){
  const v = vehicles.find(x=>x.id===s.vehicleId) || {};
  return `Araç Servis Bilgilendirmesi\n\nPlaka: ${s.plate}\nMüşteri: ${v.owner||'-'}\nTelefon: ${v.phone||'-'}\nTarih: ${s.date||'-'}\nKM: ${s.km||0}\n\nYağ: ${s.oil||'değişmedi'}\nYağ Filtresi: ${s.oilFilter||'değişmedi'}\nHava Filtresi: ${s.airFilter||'değişmedi'}\nPolen Filtresi: ${s.pollenFilter||'değişmedi'}\nFren Balatası: ${s.brakePad||'değişmedi'}\nAkü: ${s.battery||'değişmedi'}\nLastik: ${s.tire||'değişmedi'}\n\nAçıklama: ${s.note||'-'}\nİşçilik: ${money(s.laborCost)}\nParça: ${money(s.partsCost)}\nToplam: ${money(serviceTotal(s))}`;
}

function normalizePhone(phone){
  let p = String(phone || '').replace(/\D/g,'');
  if(p.startsWith('00')) p = p.substring(2);
  if(p.startsWith('0')) p = '90' + p.substring(1);
  return p;
}

function sendWhatsApp(id){
  const s = services.find(x=>x.id===id);
  if(!s) return;
  const v = vehicles.find(x=>x.id===s.vehicleId) || {};
  const phone = normalizePhone(v.phone);
  const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(serviceMessage(s))}` : `https://wa.me/?text=${encodeURIComponent(serviceMessage(s))}`;
  window.open(url, '_blank');
}

function generatePDF(id){
  const s = services.find(x=>x.id===id);
  if(!s) return;
  const v = vehicles.find(x=>x.id===s.vehicleId) || {};
  const slipNo = `SF-${String(s.date || today()).replaceAll('-','')}-${String(s.id || '').slice(0,5).toUpperCase()}`;
  const rows = [
    ['Yağ', s.oil], ['Yağ Filtresi', s.oilFilter], ['Hava Filtresi', s.airFilter], ['Polen Filtresi', s.pollenFilter],
    ['Fren Balatası', s.brakePad], ['Akü', s.battery], ['Lastik', s.tire]
  ];
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Servis Fişi ${esc(s.plate)}</title>
  <style>
    body{font-family:Arial,sans-serif;padding:28px;color:#111} .top{display:flex;justify-content:space-between;gap:18px;border-bottom:3px solid #111;padding-bottom:14px;margin-bottom:18px}.brand{display:flex;gap:12px;align-items:center}.logo{width:58px;height:58px;border:2px solid #111;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800}.brand h1{margin:0;font-size:24px}.brand p,.small{margin:4px 0;color:#555;font-size:12px}.slip{text-align:right}h2{font-size:18px;margin:20px 0 8px}table{width:100%;border-collapse:collapse;margin-top:8px}td,th{border:1px solid #d1d5db;padding:9px;text-align:left;font-size:13px}th{background:#f3f4f6}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.total{font-size:18px;font-weight:bold}.sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:42px}.line{border-top:1px solid #111;padding-top:8px;text-align:center}.note{min-height:48px}.printBtn{position:fixed;right:20px;top:20px;padding:10px 16px;border:0;border-radius:8px;background:#111;color:#fff}@media print{.printBtn{display:none}body{padding:0}.top{margin-top:0}}
  </style></head><body>
  <button class="printBtn" onclick="window.print()">Yazdır / PDF Kaydet</button>
  <div class="top"><div class="brand"><div class="logo">LOGO</div><div><h1>Araç Servis Fişi</h1><p>Firma adı / servis bilgileri buraya eklenebilir</p></div></div><div class="slip"><b>Fiş No:</b> ${esc(slipNo)}<br><b>Tarih:</b> ${esc(s.date||'-')}<br><b>Düzenleyen:</b> ${esc(s.updatedBy||'-')}</div></div>
  <div class="grid"><div><h2>Araç Bilgileri</h2><table><tr><th>Plaka</th><td>${esc(s.plate)}</td></tr><tr><th>Marka / Model</th><td>${esc(v.model||'-')}</td></tr><tr><th>Ruhsat Sahibi</th><td>${esc(v.owner||'-')}</td></tr><tr><th>Telefon</th><td>${esc(v.phone||'-')}</td></tr></table></div>
  <div><h2>Servis Bilgileri</h2><table><tr><th>Servis KM</th><td>${s.km||0}</td></tr><tr><th>Mevcut KM</th><td>${v.currentKm||0}</td></tr><tr><th>Gelecek Servis KM</th><td>${v.nextServiceKm||'-'}</td></tr><tr><th>Son Servis Tarihi</th><td>${esc(v.lastServiceDate||'-')}</td></tr></table></div></div>
  <h2>Parça / İşlem Durumu</h2><table><tr><th>İşlem</th><th>Durum</th></tr>${rows.map(([k,val])=>`<tr><td>${esc(k)}</td><td>${esc(val||'değişmedi')}</td></tr>`).join('')}</table>
  <h2>Açıklama</h2><table><tr><td class="note">${esc(s.note||'-')}</td></tr></table>
  <h2>Ücret Bilgileri</h2><table><tr><th>İşçilik</th><td>${money(s.laborCost)}</td></tr><tr><th>Parça</th><td>${money(s.partsCost)}</td></tr><tr class="total"><th>Toplam</th><td>${money(serviceTotal(s))}</td></tr></table>
  <div class="sign"><div class="line">Servis Yetkilisi</div><div class="line">Müşteri İmza</div></div>
  <p class="small">Bu fiş bilgilendirme amaçlıdır. Aracınızın bir sonraki servis kilometresi araç kartında gösterilen değerdir.</p>
  </body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html); w.document.close();
}


function baseCustomerName(v){ return String(v?.owner || 'İsimsiz Müşteri').trim() || 'İsimsiz Müşteri'; }
function customerKey(v){ return (baseCustomerName(v) + '|' + String(v?.phone || '').replace(/\D/g,'')).toLocaleLowerCase('tr-TR'); }
function paymentSign(type){ return type === 'debt' ? 1 : -1; }
function paymentLabel(type){ return type === 'debt' ? 'Borç Ekle' : (type === 'discount' ? 'İndirim / Düşüm' : 'Ödeme Alındı'); }
function customers(){
  const map = new Map();
  for(const v of vehicles){
    const key = customerKey(v);
    if(!map.has(key)) map.set(key, {key, owner:baseCustomerName(v), phone:v.phone||'', vehicles:[], serviceTotal:0, payments:[], paymentNet:0, balance:0});
    const c = map.get(key); c.vehicles.push(v);
    if(!c.phone && v.phone) c.phone = v.phone;
  }
  for(const s of services){
    const v = vehicles.find(x=>x.id===s.vehicleId) || vehicles.find(x=>x.plate===s.plate);
    const key = v ? customerKey(v) : String(s.plate || 'bilinmeyen').toLocaleLowerCase('tr-TR');
    if(!map.has(key)) map.set(key, {key, owner:v?baseCustomerName(v):'Bilinmeyen', phone:v?.phone||'', vehicles:v?[v]:[], serviceTotal:0, payments:[], paymentNet:0, balance:0});
    map.get(key).serviceTotal += serviceTotal(s);
  }
  for(const p of payments){
    const key = p.customerKey || (String(p.owner||'') + '|' + String(p.phone||'').replace(/\D/g,'')).toLocaleLowerCase('tr-TR');
    if(!map.has(key)) map.set(key, {key, owner:p.owner||'İsimsiz Müşteri', phone:p.phone||'', vehicles:[], serviceTotal:0, payments:[], paymentNet:0, balance:0});
    const c = map.get(key); c.payments.push(p); c.paymentNet += paymentSign(p.type) * (+p.amount || 0);
  }
  for(const c of map.values()) c.balance = c.serviceTotal + c.paymentNet;
  return [...map.values()].sort((a,b)=>b.balance-a.balance);
}
function customerBalance(key){ const c = customers().find(x=>x.key===key); return c ? c.balance : 0; }
function renderAccounts(){
  const el = $('accountList'); if(!el) return;
  const q = ($('accountSearch')?.value || '').toLocaleLowerCase('tr-TR');
  const data = customers().filter(c => [c.owner,c.phone,...c.vehicles.map(v=>v.plate)].join(' ').toLocaleLowerCase('tr-TR').includes(q));
  el.innerHTML = data.length ? data.map(c=>`<article class="item"><div class="item-top"><div><h3>${esc(c.owner)}</h3><div class="meta">${esc(c.phone||'-')}<br>Araçlar: ${esc(c.vehicles.map(v=>v.plate).join(', ') || '-')}<br>Servis borcu: ${money(c.serviceTotal)} • Ödeme/düşüm: ${money(-c.paymentNet)}<br><b>Kalan bakiye: ${money(c.balance)}</b></div></div><span class="badge ${c.balance>0?'warn':'ok'}">${c.balance>0?'Borç Var':'Kapalı'}</span></div><div class="actions"><button onclick="openPaymentByKey('${escAttr(c.key)}')">Ödeme Al</button><button onclick="openDebtByKey('${escAttr(c.key)}')">Borç Ekle</button><button onclick="filterCustomerHistory('${escAttr(c.key)}')">Geçmiş</button></div></article>`).join('') : '<div class="empty">Cari kayıt bulunamadı.</div>';
}
function renderPaymentHistory(){
  const el = $('paymentHistory'); if(!el) return;
  el.innerHTML = payments.length ? payments.map(p=>`<article class="item"><div class="item-top"><div><h3>${esc(p.owner||'-')} - ${paymentLabel(p.type)}</h3><div class="meta">${esc(p.date||'-')} • ${esc(p.phone||'-')}<br>${esc(p.note||'')}</div></div><span class="badge ${p.type==='debt'?'warn':'ok'}">${p.type==='debt'?'+':'-'} ${money(p.amount)}</span></div>${canDelete()?`<div class="actions"><button class="dangerBtn" onclick="deletePayment('${p.id}')">Sil</button></div>`:''}</article>`).join('') : '<div class="empty">Ödeme hareketi yok.</div>';
}
function fillPaymentForm(c, type='payment'){
  $('paymentCustomerKey').value = c.key;
  $('paymentOwner').value = c.owner || '';
  $('paymentPhone').value = c.phone || '';
  $('paymentType').value = type;
  $('paymentAmount').value = '';
  $('paymentDate').value = today();
  $('paymentNote').value = type==='payment' ? 'Ödeme alındı' : 'Manuel borç eklendi';
  switchTab('accounts');
  setTimeout(()=>$('paymentAmount').focus(),100);
}
function openPayment(id){ const v = vehicles.find(x=>x.id===id); if(!v) return; fillPaymentForm({key:customerKey(v), owner:baseCustomerName(v), phone:v.phone||''}, 'payment'); }
function openPaymentByKey(key){ const c = customers().find(x=>x.key===key); if(c) fillPaymentForm(c, 'payment'); }
function openDebtByKey(key){ const c = customers().find(x=>x.key===key); if(c) fillPaymentForm(c, 'debt'); }
function filterCustomerHistory(key){
  const c = customers().find(x=>x.key===key); if(!c) return;
  switchTab('history');
  $('historySearch').value = c.vehicles[0]?.plate || c.owner;
  renderHistory();
}
async function savePayment(e){
  e.preventDefault();
  const amount = +$('paymentAmount').value || 0;
  if(amount <= 0) return alert('Tutar girmen gerekiyor.');
  const owner = $('paymentOwner').value.trim();
  if(!owner) return alert('Müşteri adı zorunlu.');
  const phone = $('paymentPhone').value.trim();
  const key = $('paymentCustomerKey').value || (owner + '|' + phone.replace(/\D/g,'')).toLocaleLowerCase('tr-TR');
  await addDoc(collection(fs,'payments'), {customerKey:key, owner, phone, type:$('paymentType').value, amount, date:$('paymentDate').value||today(), note:$('paymentNote').value.trim(), createdAt:serverTimestamp(), updatedBy:currentUser.email});
  clearPaymentForm();
}
function clearPaymentForm(){ ['paymentCustomerKey','paymentOwner','paymentPhone','paymentAmount','paymentNote'].forEach(id=>$(id).value=''); $('paymentType').value='payment'; $('paymentDate').value=today(); }
async function deletePayment(id){ if(!canDelete()) return alert('Silme yetkisi sadece adminde.'); if(confirm('Cari hareket silinsin mi?')) await deleteDoc(doc(fs,'payments',id)); }
function escAttr(v){ return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

async function exportData(){ const data={vehicles,services,payments,exportedAt:new Date().toISOString()}; const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='arac-servis-yedek.json'; a.click(); URL.revokeObjectURL(a.href); }
async function importData(e){ const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=async()=>{try{const imported=JSON.parse(r.result); if(!Array.isArray(imported.vehicles)||!Array.isArray(imported.services)) throw Error(); const batch=writeBatch(fs); imported.vehicles.forEach(v=>{const id=v.id||doc(collection(fs,'vehicles')).id; delete v.id; batch.set(doc(fs,'vehicles',id), {...v, updatedAt:serverTimestamp(), updatedBy:currentUser.email});}); imported.services.forEach(s=>{const id=s.id||doc(collection(fs,'services')).id; delete s.id; batch.set(doc(fs,'services',id), {...s, updatedAt:serverTimestamp(), updatedBy:currentUser.email});}); (imported.payments||[]).forEach(p=>{const id=p.id||doc(collection(fs,'payments')).id; delete p.id; batch.set(doc(fs,'payments',id), {...p, updatedAt:serverTimestamp(), updatedBy:currentUser.email});}); await batch.commit(); alert('Yedek Firebase içine yüklendi.');}catch{alert('Yedek dosyası okunamadı.');}}; r.readAsText(f); }
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function registerSW(){if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(()=>{});}
function setupInstall(){let promptEvent; window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;$('installBtn').classList.remove('hidden');}); $('installBtn').onclick=async()=>{if(promptEvent){promptEvent.prompt();promptEvent=null;$('installBtn').classList.add('hidden');}};}
window.openPayment=openPayment; window.openPaymentByKey=openPaymentByKey; window.openDebtByKey=openDebtByKey; window.filterCustomerHistory=filterCustomerHistory; window.deletePayment=deletePayment; window.showVehicleDetail=showVehicleDetail; window.editVehicle=editVehicle; window.deleteVehicle=deleteVehicle; window.showVehicleHistory=showVehicleHistory; window.editService=editService; window.deleteService=deleteService; window.openService=openService; window.sendWhatsApp=sendWhatsApp; window.generatePDF=generatePDF;
init();