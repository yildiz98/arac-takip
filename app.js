import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, setDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, getDocs, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
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
  $('servicePlateSearch').oninput = handleServicePlateSearch;
  $('serviceVehicle').onchange = renderSelectedVehicleInfo;
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

function render(){renderSelect(); renderDashboard(); renderVehicles(); renderHistory();}
function renderDashboard(){
  $('totalVehicles').textContent=vehicles.length; $('totalServices').textContent=services.length; $('totalCost').textContent=money(services.reduce((a,s)=>a+serviceTotal(s),0));
  const listed=vehicles.filter(v=>v.nextServiceKm); $('dueCount').textContent=listed.length;
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
function vehicleCard(v, compact=false){ const ss=services.filter(s=>s.vehicleId===v.id); const total=ss.reduce((a,s)=>a+serviceTotal(s),0); return `<article class="item"><div class="item-top"><div><h3>${esc(v.plate)}</h3><div class="meta">${esc(v.model||'-')} • ${esc(v.owner||'-')}<br>Mevcut KM: ${v.currentKm||0} • Gelecek servis KM: ${v.nextServiceKm||0}<br>Son servis: ${v.lastServiceDate||'-'} • Toplam: ${money(total)}</div></div><span class="badge ok">${ss.length} servis</span></div>${compact?'':`<div class="actions"><button onclick="openService('${v.id}')">Servis Aç</button><button onclick="showVehicleHistory('${v.id}')">Geçmiş</button><button onclick="editVehicle('${v.id}')">Düzenle</button>${canDelete()?`<button class="dangerBtn" onclick="deleteVehicle('${v.id}')">Sil</button>`:''}</div>`}</article>`; }
function showVehicleHistory(id){const v=vehicles.find(x=>x.id===id); if(!v)return; switchTab('history'); $('historySearch').value=v.plate; renderHistory();}
function renderHistory(){ const q=($('historySearch').value||'').toLocaleLowerCase('tr-TR'); const data=services.filter(s=>[s.plate,s.note,s.oil,s.oilFilter,s.airFilter,s.pollenFilter,s.brakePad,s.battery,s.tire].join(' ').toLocaleLowerCase('tr-TR').includes(q)); $('historyList').innerHTML=data.length?data.map(serviceCard).join(''):'<div class="empty">Servis kaydı bulunamadı.</div>'; }
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

function sendWhatsApp(id){
  const s = services.find(x=>x.id===id);
  if(!s) return;
  window.open(`https://wa.me/?text=${encodeURIComponent(serviceMessage(s))}`, '_blank');
}

function generatePDF(id){
  const s = services.find(x=>x.id===id);
  if(!s) return;
  const v = vehicles.find(x=>x.id===s.vehicleId) || {};
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Servis Fişi ${esc(s.plate)}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin-top:14px}td,th{border:1px solid #ddd;padding:8px;text-align:left}.total{font-size:18px;font-weight:bold}.muted{color:#555}</style></head><body><h1>Araç Servis Fişi</h1><p class="muted">Tarih: ${esc(s.date||'-')}</p><table><tr><th>Plaka</th><td>${esc(s.plate)}</td></tr><tr><th>Marka / Model</th><td>${esc(v.model||'-')}</td></tr><tr><th>Ruhsat Sahibi</th><td>${esc(v.owner||'-')}</td></tr><tr><th>Telefon</th><td>${esc(v.phone||'-')}</td></tr><tr><th>Servis KM</th><td>${s.km||0}</td></tr><tr><th>Gelecek Servis KM</th><td>${v.nextServiceKm||0}</td></tr></table><table><tr><th>İşlem</th><th>Durum</th></tr><tr><td>Yağ</td><td>${esc(s.oil||'değişmedi')}</td></tr><tr><td>Yağ Filtresi</td><td>${esc(s.oilFilter||'değişmedi')}</td></tr><tr><td>Hava Filtresi</td><td>${esc(s.airFilter||'değişmedi')}</td></tr><tr><td>Polen Filtresi</td><td>${esc(s.pollenFilter||'değişmedi')}</td></tr><tr><td>Fren Balatası</td><td>${esc(s.brakePad||'değişmedi')}</td></tr><tr><td>Akü</td><td>${esc(s.battery||'değişmedi')}</td></tr><tr><td>Lastik</td><td>${esc(s.tire||'değişmedi')}</td></tr></table><p><b>Açıklama:</b> ${esc(s.note||'-')}</p><table><tr><th>İşçilik</th><td>${money(s.laborCost)}</td></tr><tr><th>Parça</th><td>${money(s.partsCost)}</td></tr><tr class="total"><th>Toplam</th><td>${money(serviceTotal(s))}</td></tr></table><script>window.print()<\/script></body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html); w.document.close();
}

async function exportData(){ const data={vehicles,services,exportedAt:new Date().toISOString()}; const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='arac-servis-yedek.json'; a.click(); URL.revokeObjectURL(a.href); }
async function importData(e){ const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=async()=>{try{const imported=JSON.parse(r.result); if(!Array.isArray(imported.vehicles)||!Array.isArray(imported.services)) throw Error(); const batch=writeBatch(fs); imported.vehicles.forEach(v=>{const id=v.id||doc(collection(fs,'vehicles')).id; delete v.id; batch.set(doc(fs,'vehicles',id), {...v, updatedAt:serverTimestamp(), updatedBy:currentUser.email});}); imported.services.forEach(s=>{const id=s.id||doc(collection(fs,'services')).id; delete s.id; batch.set(doc(fs,'services',id), {...s, updatedAt:serverTimestamp(), updatedBy:currentUser.email});}); await batch.commit(); alert('Yedek Firebase içine yüklendi.');}catch{alert('Yedek dosyası okunamadı.');}}; r.readAsText(f); }
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function registerSW(){if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(()=>{});}
function setupInstall(){let promptEvent; window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;$('installBtn').classList.remove('hidden');}); $('installBtn').onclick=async()=>{if(promptEvent){promptEvent.prompt();promptEvent=null;$('installBtn').classList.add('hidden');}};}
window.editVehicle=editVehicle; window.deleteVehicle=deleteVehicle; window.showVehicleHistory=showVehicleHistory; window.editService=editService; window.deleteService=deleteService; window.openService=openService; window.sendWhatsApp=sendWhatsApp; window.generatePDF=generatePDF;
init();