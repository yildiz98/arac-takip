const KEY = 'aracTakipPWA_v1';
let db = JSON.parse(localStorage.getItem(KEY) || '{"vehicles":[],"services":[]}');
const $ = id => document.getElementById(id);
const money = n => (Number(n || 0)).toLocaleString('tr-TR',{style:'currency',currency:'TRY'});
const today = () => new Date().toISOString().slice(0,10);
const save = () => { localStorage.setItem(KEY, JSON.stringify(db)); render(); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const plateClean = v => (v || '').trim().toLocaleUpperCase('tr-TR');

function init(){
  $('serviceDate').value = today();
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
  $('vehicleForm').onsubmit = saveVehicle;
  $('serviceForm').onsubmit = saveService;
  $('clearVehicle').onclick = clearVehicleForm;
  $('clearService').onclick = clearServiceForm;
  $('vehicleSearch').oninput = renderVehicles;
  $('historySearch').oninput = renderHistory;
  $('exportBtn').onclick = exportData;
  $('importFile').onchange = importData;
  $('wipeBtn').onclick = wipeData;
  registerSW(); setupInstall(); render();
}
function switchTab(id){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('active',p.id===id));}

function saveVehicle(e){
  e.preventDefault();
  const id = $('vehicleId').value || uid();
  const v = { id, plate: plateClean($('plate').value), model:$('model').value.trim(), owner:$('owner').value.trim(), phone:$('phone').value.trim(), firstKm:+$('firstKm').value||0, lastServiceKm:+$('lastServiceKm').value||0, nextServiceKm:+$('nextServiceKm').value||0, note:$('vehicleNote').value.trim(), createdAt:new Date().toISOString() };
  if(!v.plate) return alert('Plaka zorunlu.');
  const duplicate = db.vehicles.find(x=>x.plate===v.plate && x.id!==id);
  if(duplicate) return alert('Bu plaka zaten kayıtlı.');
  const i = db.vehicles.findIndex(x=>x.id===id);
  if(i>=0) db.vehicles[i] = {...db.vehicles[i],...v}; else db.vehicles.push(v);
  clearVehicleForm(); save();
}
function clearVehicleForm(){['vehicleId','plate','model','owner','phone','firstKm','lastServiceKm','nextServiceKm','vehicleNote'].forEach(id=>$(id).value='');}
function editVehicle(id){const v=db.vehicles.find(x=>x.id===id); if(!v)return; $('vehicleId').value=v.id;$('plate').value=v.plate;$('model').value=v.model;$('owner').value=v.owner;$('phone').value=v.phone;$('firstKm').value=v.firstKm;$('lastServiceKm').value=v.lastServiceKm;$('nextServiceKm').value=v.nextServiceKm;$('vehicleNote').value=v.note; switchTab('vehicles'); window.scrollTo({top:0,behavior:'smooth'});}
function deleteVehicle(id){if(!confirm('Araç ve servis geçmişi silinsin mi?'))return; db.vehicles=db.vehicles.filter(v=>v.id!==id); db.services=db.services.filter(s=>s.vehicleId!==id); save();}

function saveService(e){
  e.preventDefault();
  const vehicleId = $('serviceVehicle').value;
  const vehicle = db.vehicles.find(v=>v.id===vehicleId);
  if(!vehicle) return alert('Önce araç kaydı ekle.');
  const id = $('serviceId').value || uid();
  const s = {id, vehicleId, plate:vehicle.plate, km:+$('serviceKm').value||0, date:$('serviceDate').value||today(), item:$('serviceItem').value.trim(), status:$('serviceStatus').value, price:+$('servicePrice').value||0, note:$('serviceNote').value.trim()};
  if(!s.item) return alert('İşlem/parça adı zorunlu.');
  const i=db.services.findIndex(x=>x.id===id); if(i>=0) db.services[i]=s; else db.services.push(s);
  if(s.km >= (vehicle.lastServiceKm || 0)) vehicle.lastServiceKm = s.km;
  clearServiceForm(); save();
}
function clearServiceForm(){['serviceId','serviceKm','serviceItem','servicePrice','serviceNote'].forEach(id=>$(id).value=''); $('serviceDate').value=today();}
function editService(id){const s=db.services.find(x=>x.id===id); if(!s)return; $('serviceId').value=s.id;$('serviceVehicle').value=s.vehicleId;$('serviceKm').value=s.km;$('serviceDate').value=s.date;$('serviceItem').value=s.item;$('serviceStatus').value=s.status;$('servicePrice').value=s.price;$('serviceNote').value=s.note; switchTab('service'); window.scrollTo({top:0,behavior:'smooth'});}
function deleteService(id){if(confirm('Servis kaydı silinsin mi?')){db.services=db.services.filter(s=>s.id!==id); save();}}

function render(){renderSelect(); renderDashboard(); renderVehicles(); renderHistory(); renderAccounts();}
function renderDashboard(){
  $('totalVehicles').textContent=db.vehicles.length;
  $('totalServices').textContent=db.services.length;
  $('totalCost').textContent=money(db.services.reduce((a,s)=>a+(+s.price||0),0));
  $('dueCount').textContent=db.vehicles.filter(v=>v.nextServiceKm && v.lastServiceKm && v.nextServiceKm-v.lastServiceKm<=1000).length;
}
function renderSelect(){
  $('serviceVehicle').innerHTML = db.vehicles.length ? db.vehicles.map(v=>`<option value="${v.id}">${v.plate} - ${v.model||'Araç'}</option>`).join('') : '<option value="">Önce araç ekle</option>';
}
function renderVehicles(){
  const q=($('vehicleSearch').value||'').toLocaleLowerCase('tr-TR');
  const data=db.vehicles.filter(v=>[v.plate,v.model,v.owner].join(' ').toLocaleLowerCase('tr-TR').includes(q)).sort((a,b)=>a.plate.localeCompare(b.plate,'tr'));
  $('vehicleList').innerHTML=data.length?data.map(v=>{
    const total=db.services.filter(s=>s.vehicleId===v.id).reduce((a,s)=>a+(+s.price||0),0);
    const diff=(v.nextServiceKm||0)-(v.lastServiceKm||0); const warn=v.nextServiceKm && v.lastServiceKm && diff<=1000;
    return `<article class="item"><div class="item-top"><div><h3>${v.plate}</h3><div class="meta">${v.model||'-'} • ${v.owner||'-'}<br>Son servis: ${v.lastServiceKm||0} km • Sonraki: ${v.nextServiceKm||0} km<br>Toplam masraf: ${money(total)}</div></div><span class="badge ${warn?'warn':'ok'}">${warn?'Bakım Yakın':'Normal'}</span></div><div class="actions"><button onclick="showVehicleHistory('${v.id}')">Geçmiş</button><button onclick="editVehicle('${v.id}')">Düzenle</button><button onclick="deleteVehicle('${v.id}')">Sil</button></div></article>`;
  }).join(''):'<div class="item meta">Kayıt bulunamadı.</div>';
}
function showVehicleHistory(id){const v=db.vehicles.find(x=>x.id===id); if(!v)return; switchTab('history'); $('historySearch').value=v.plate; renderHistory();}
function renderHistory(){
  const q=($('historySearch').value||'').toLocaleLowerCase('tr-TR');
  const data=db.services.filter(s=>[s.plate,s.item,s.status,s.note].join(' ').toLocaleLowerCase('tr-TR').includes(q)).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  $('historyList').innerHTML=data.length?data.map(s=>`<article class="item"><div class="item-top"><div><h3>${s.plate} - ${s.item}</h3><div class="meta">${s.date} • ${s.km} km • ${s.status}<br>${s.note||''}</div></div><span class="badge">${money(s.price)}</span></div><div class="actions"><button onclick="editService('${s.id}')">Düzenle</button><button onclick="deleteService('${s.id}')">Sil</button></div></article>`).join(''):'<div class="item meta">Servis kaydı bulunamadı.</div>';
}
function renderAccounts(){
  const rows=db.vehicles.map(v=>{const ss=db.services.filter(s=>s.vehicleId===v.id); return {v,count:ss.length,total:ss.reduce((a,s)=>a+(+s.price||0),0)};}).sort((a,b)=>b.total-a.total);
  $('accountList').innerHTML=rows.length?rows.map(r=>`<article class="item"><div class="item-top"><div><h3>${r.v.plate}</h3><div class="meta">${r.v.owner||'-'} • ${r.count} servis kaydı<br>${r.v.phone||''}</div></div><span class="badge">${money(r.total)}</span></div></article>`).join(''):'<div class="item meta">Cari kayıt yok.</div>';
}
function exportData(){const blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='arac-takip-yedek.json'; a.click(); URL.revokeObjectURL(a.href);}
function importData(e){const f=e.target.files[0]; if(!f)return; const r=new FileReader(); r.onload=()=>{try{const imported=JSON.parse(r.result); if(!imported.vehicles||!imported.services) throw Error(); db=imported; save(); alert('Yedek yüklendi.');}catch{alert('Yedek dosyası okunamadı.');}}; r.readAsText(f);}
function wipeData(){if(confirm('Tüm araç ve servis kayıtları silinecek. Emin misin?')){db={vehicles:[],services:[]}; save();}}
function registerSW(){if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js').catch(()=>{});}
function setupInstall(){let promptEvent; window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();promptEvent=e;$('installBtn').classList.remove('hidden');}); $('installBtn').onclick=async()=>{if(promptEvent){promptEvent.prompt();promptEvent=null;$('installBtn').classList.add('hidden');}};}
init();
