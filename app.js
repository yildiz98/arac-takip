import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const fs = getFirestore(app);

let vehicles = [];
let services = [];
let currentUser = null;
let role = "personel";
let unsubVehicles = null;
let unsubServices = null;

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
  $('clearVehicle').onclick = clearVehicleForm;
  $('clearService').onclick = clearServiceForm;
  $('vehicleSearch').oninput = renderVehicles;
  $('historySearch').oninput = renderHistory;
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
      if(unsubVehicles) unsubVehicles(); if(unsubServices) unsubServices();
      return;
    }
    role = user.email && user.email.startsWith('admin') ? 'admin' : 'personel';
    $('loginView').classList.add('hidden'); $('appView').classList.remove('hidden'); $('logoutBtn').classList.remove('hidden'); $('userInfo').textContent = `${user.email} • ${role}`;
    listenData();
  });
}

function listenData(){
  if(unsubVehicles) unsubVehicles(); if(unsubServices) unsubServices();
  unsubVehicles = onSnapshot(query(collection(fs,'vehicles'), orderBy('plate')), snap=>{ vehicles=snap.docs.map(d=>({id:d.id,...d.data()})); render(); });
  unsubServices = onSnapshot(query(collection(fs,'services'), orderBy('date','desc')), snap=>{ services=snap.docs.map(d=>({id:d.id,...d.data()})); render(); });
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
  const vehicleId = $('serviceVehicle').value;
  const vehicle = vehicles.find(v=>v.id===vehicleId);
  if(!vehicle) return alert('Önce araç kaydı ekle.');
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
  if(!vehicle.nextServiceKm || km >= (vehicle.nextServiceKm - 1000)) updateVehicle.nextServiceKm = km + 10000;
  await setDoc(doc(fs,'vehicles',vehicleId), updateVehicle, {merge:true});
  clearServiceForm();
}
function clearServiceForm(){['serviceId','serviceKm','serviceNote','laborCost','partsCost'].forEach(id=>$(id).value=''); ['oil','oilFilter','airFilter','pollenFilter','brakePad','battery','tire'].forEach(id=>$(id).value='değişmedi'); $('serviceDate').value=today();}
function editService(id){const s=services.find(x=>x.id===id); if(!s)return; $('serviceId').value=s.id;$('serviceVehicle').value=s.vehicleId;$('serviceKm').value=s.km||'';$('serviceDate').value=s.date||today();$('oil').value=s.oil||'değişmedi';$('oilFilter').value=s.oilFilter||'değişmedi';$('airFilter').value=s.airFilter||'değişmedi';$('pollenFilter').value=s.pollenFilter||'değişmedi';$('brakePad').value=s.brakePad||'değişmedi';$('battery').value=s.battery||'değişmedi';$('tire').value=s.tire||'değişmedi';$('serviceNote').value=s.note||'';$('laborCost').value=s.laborCost||'';$('partsCost').value=s.partsCost||''; switchTab('service'); window.scrollTo({top:0,behavior:'smooth'});}
async function deleteService(id){ if(!canDelete()) return alert('Silme yetkisi sadece adminde.'); if(confirm('Servis kaydı silinsin mi?')) await deleteDoc(doc(fs,'services',id)); }

function render(){renderSelect(); renderDashboard(); renderVehicles(); renderHistory();}
function renderDashboard(){
  $('totalVehicles').textContent=vehicles.length; $('totalServices').textContent=services.length; $('totalCost').textContent=money(services.reduce((a,s)=>a+serviceTotal(s),0));
  const due=vehicles.filter(isDue); $('dueCount').textContent=due.length;
  $('dueList').innerHTML=due.length?due.map(v=>vehicleCard(v, true)).join(''):'<div class="empty">Yaklaşan bakım yok.</div>';
}
function isDue(v){ return v.nextServiceKm && v.currentKm && (v.nextServiceKm - v.currentKm <= 3000); }
function dueClass(v){
  if(!v.nextServiceKm || !v.currentKm) return 'ok';
  const kalan = v.nextServiceKm - v.currentKm;
  if(kalan <= 1000) return 'warn';
  if(kalan <= 3000) return 'near';
  return 'ok';
}
function dueText(v){
  if(!v.nextServiceKm || !v.currentKm) return 'Normal';
  const kalan = v.nextServiceKm - v.currentKm;
  if(kalan <= 1000) return 'Acil Bakım';
  if(kalan <= 3000) return 'Bakım Yakın';
  return 'Normal';
}
function renderSelect(){ $('serviceVehicle').innerHTML = vehicles.length ? vehicles.map(v=>`<option value="${v.id}">${esc(v.plate)} - ${esc(v.model||'Araç')}</option>`).join('') : '<option value="">Önce araç ekle</option>'; }
function renderVehicles(){ const q=($('vehicleSearch').value||'').toLocaleLowerCase('tr-TR'); const data=vehicles.filter(v=>[v.plate,v.model,v.owner,v.phone].join(' ').toLocaleLowerCase('tr-TR').includes(q)); $('vehicleList').innerHTML=data.length?data.map(v=>vehicleCard(v)).join(''):'<div class="empty">Kayıt bulunamadı.</div>'; }
function vehicleCard(v, compact=false){ const ss=services.filter(s=>s.vehicleId===v.id); const total=ss.reduce((a,s)=>a+serviceTotal(s),0); const remaining = (v.nextServiceKm||0) - (v.currentKm||0); return `<article class="item"><div class="item-top"><div><h3>${esc(v.plate)}</h3><div class="meta">${esc(v.model||'-')} • ${esc(v.owner||'-')}<br>Mevcut KM: ${v.currentKm||0} • Sonraki bakım: ${v.nextServiceKm||0}<br>Kalan KM: ${remaining > 0 ? remaining : 0}<br>Son servis: ${v.lastServiceDate||'-'} • Toplam: ${money(total)}</div></div><span class="badge ${dueClass(v)}">${dueText(v)}</span></div>${compact?'':`<div class="actions"><button onclick="showVehicleHistory('${v.id}')">Geçmiş</button><button onclick="editVehicle('${v.id}')">Düzenle</button>${canDelete()?`<button class="dangerBtn" onclick="deleteVehicle('${v.id}')">Sil</button>`:''}</div>`}</article>`; }
function showVehicleHistory(id){const v=vehicles.find(x=>x.id===id); if(!v)return; switchTab('history'); $('historySearch').value=v.plate; renderHistory();}
function renderHistory(){ const q=($('historySearch').value||'').toLocaleLowerCase('tr-TR'); const data=services.filter(s=>[s.plate,s.note,s.oil,s.oilFilter,s.airFilter,s.pollenFilter,s.brakePad,s.battery,s.tire].join(' ').toLocaleLowerCase('tr-TR').includes(q)); $('historyList').innerHTML=data.length?data.map(serviceCard).join(''):'<div class="empty">Servis kaydı bulunamadı.</div>'; }
function serviceCard(s){ const parts=[['Yağ',s.oil],['Yağ filtresi',s.oilFilter],['Hava filtresi',s.airFilter],['Polen filtresi',s.pollenFilter],['Fren balatası',s.brakePad],['Akü',s.battery],['Lastik',s.tire]].map(([k,v])=>`${k}: ${v||'değişmedi'}`).join(' • '); return `<article class="item"><div class="item-top"><div><h3>${esc(s.plate)} - ${s.date||''}</h3><div class="meta">${s.km||0} km<br>${esc(parts)}<br>${esc(s.note||'')}</div></div><span class="badge">${money(serviceTotal(s))}</span></div><div class="actions"><button onclick="sendWhatsApp('${s.id}')">WhatsApp</button><button onclick="generatePDF('${s.id}')">PDF</button><button onclick="editService('${s.id}')">Düzenle</button>${canDelete()?`<button class="dangerBtn" onclick="deleteService('${s.id}')">Sil</button>`:''}</div></article>`; }

function buildServiceText(s){
  const vehicle = vehicles.find(v => v.id === s.vehicleId) || {};
  return `Araç Servis Bilgilendirmesi\n\nPlaka: ${s.plate}\nRuhsat Sahibi: ${vehicle.owner || '-'}\nTelefon: ${vehicle.phone || '-'}\nTarih: ${s.date || '-'}\nKM: ${s.km || 0}\n\nYağ: ${s.oil || 'değişmedi'}\nYağ Filtresi: ${s.oilFilter || 'değişmedi'}\nHava Filtresi: ${s.airFilter || 'değişmedi'}\nPolen Filtresi: ${s.pollenFilter || 'değişmedi'}\nFren Balatası: ${s.brakePad || 'değişmedi'}\nAkü: ${s.battery || 'değişmedi'}\nLastik: ${s.tire || 'değişmedi'}\n\nAçıklama: ${s.note || '-'}\nİşçilik: ${money(s.laborCost)}\nParça: ${money(s.partsCost)}\nToplam: ${money(serviceTotal(s))}\n\nİyi günlerde kullanmanız dileğiyle.`;
}

function sendWhatsApp(id){
  const s = services.find(x=>x.id===id);
  if(!s) return alert('Servis kaydı bulunamadı.');
  const vehicle = vehicles.find(v => v.id === s.vehicleId) || {};
  const phone = String(vehicle.phone || '').replace(/\D/g, '');
  const msg = buildServiceText(s);
  const url = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

function generatePDF(id){
  const s = services.find(x=>x.id===id);
  if(!s) return alert('Servis kaydı bulunamadı.');
  const vehicle = vehicles.find(v => v.id === s.vehicleId) || {};
  const w = window.open('', '_blank');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Servis Fişi - ${esc(s.plate)}</title><style>body{font-family:Arial,sans-serif;padding:28px;color:#111}.box{border:1px solid #ddd;border-radius:12px;padding:18px;margin-bottom:16px}h1{margin:0 0 6px}table{width:100%;border-collapse:collapse;margin-top:10px}td,th{border:1px solid #ddd;padding:9px;text-align:left}.total{font-size:20px;font-weight:bold;text-align:right}.muted{color:#666}.print{margin-bottom:16px;padding:10px 14px}@media print{.print{display:none}}</style></head><body><button class="print" onclick="window.print()">PDF / Yazdır</button><h1>Araç Servis Fişi</h1><p class="muted">Tarih: ${esc(s.date||'-')}</p><div class="box"><strong>Plaka:</strong> ${esc(s.plate)}<br><strong>Marka / Model:</strong> ${esc(vehicle.model||'-')}<br><strong>Ruhsat Sahibi:</strong> ${esc(vehicle.owner||'-')}<br><strong>Telefon:</strong> ${esc(vehicle.phone||'-')}<br><strong>Servis KM:</strong> ${s.km||0}</div><table><tr><th>İşlem</th><th>Durum</th></tr><tr><td>Yağ</td><td>${esc(s.oil||'değişmedi')}</td></tr><tr><td>Yağ filtresi</td><td>${esc(s.oilFilter||'değişmedi')}</td></tr><tr><td>Hava filtresi</td><td>${esc(s.airFilter||'değişmedi')}</td></tr><tr><td>Polen filtresi</td><td>${esc(s.pollenFilter||'değişmedi')}</td></tr><tr><td>Fren balatası</td><td>${esc(s.brakePad||'değişmedi')}</td></tr><tr><td>Akü</td><td>${esc(s.battery||'değişmedi')}</td></tr><tr><td>Lastik</td><td>${esc(s.tire||'değişmedi')}</td></tr></table><div class="box"><strong>Açıklama:</strong><br>${esc(s.note||'-')}</div><table><tr><td>İşçilik Ücreti</td><td>${money(s.laborCost)}</td></tr><tr><td>Parça Ücreti</td><td>${money(s.partsCost)}</td></tr><tr><th>Toplam</th><th>${money(serviceTotal(s))}</th></tr></table><p class="total">Toplam: ${money(serviceTotal(s))}</p></body></html>`;
  w.document.write(html);
  w.document.close();
}

async function exportData(){ const data={vehicles,services,exportedAt:new Date().toISOString()}; const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='arac-servis-yedek.json'; a.click(); URL.revokeObjectURL(a.href); }
async function importData(e){ const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=async()=>{try{const imported=JSON.parse(r.result); if(!Array.isArray(imported.vehicles)||!Array.isArray(imported.services)) throw Error(); const batch=writeBatch(fs); imported.vehicles.forEach(v=>{const id=v.id||doc(collection(fs,'vehicles')).id; delete v.id; batch.set(doc(fs,'vehicles',id), {...v, updatedAt:serverTimestamp(), updatedBy:currentUser.email});}); imported.services.forEach(s=>{const id=s.id||doc(collection(fs,'services')).id; delete s.id; batch.set(doc(fs,'services',id), {...s, updatedAt:serverTimestamp(), updatedBy:currentUser.email});}); await batch.commit(); alert('Yedek Firebase içine yüklendi.');}catch{alert('Yedek dosyası okunamadı.');}}; r.readAsText(f); }
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function registerSW(){if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(()=>{});}
function setupInstall(){let promptEvent; window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;$('installBtn').classList.remove('hidden');}); $('installBtn').onclick=async()=>{if(promptEvent){promptEvent.prompt();promptEvent=null;$('installBtn').classList.add('hidden');}};}
window.editVehicle=editVehicle; window.deleteVehicle=deleteVehicle; window.showVehicleHistory=showVehicleHistory; window.editService=editService; window.deleteService=deleteService; window.sendWhatsApp=sendWhatsApp; window.generatePDF=generatePDF;
init();
