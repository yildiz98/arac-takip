const STORE_KEY = "hickorkmaz_garaj_v7_data";

const demoData = {
  customers: [
    {id:"c1", name:"Ahmet Yılmaz", phone:"0533 000 00 00", type:"Şahıs"},
    {id:"c2", name:"ABC Lojistik Ltd.", phone:"0542 111 11 11", type:"Firma"}
  ],
  vehicles: [
    {id:"v1", customerId:"c1", plate:"33 ABC 123", brand:"Ford", model:"Transit", year:"2018"},
    {id:"v2", customerId:"c1", plate:"33 DEF 456", brand:"Fiat", model:"Doblo", year:"2020"},
    {id:"v3", customerId:"c2", plate:"33 FİL 001", brand:"Mercedes", model:"Sprinter", year:"2021"}
  ],
  services: [
    {id:"s1", vehicleId:"v1", date:"2026-06-09", title:"Yağ bakımı", amount:5000, note:"Yağ + filtre değişimi"},
    {id:"s2", vehicleId:"v2", date:"2026-06-01", title:"Fren bakımı", amount:2500, note:"Balata değişimi"},
    {id:"s3", vehicleId:"v3", date:"2026-05-28", title:"Genel bakım", amount:12000, note:"Filo bakım"}
  ],
  payments: [
    {id:"p1", customerId:"c1", vehicleId:"v1", date:"2026-06-09", amount:2000, note:"Nakit tahsilat"},
    {id:"p2", customerId:"c2", vehicleId:"v3", date:"2026-06-09", amount:5000, note:"Kısmi ödeme"}
  ]
};

let data = load();
let currentPage = "dashboard";

function load(){
  const raw = localStorage.getItem(STORE_KEY);
  if(!raw){
    localStorage.setItem(STORE_KEY, JSON.stringify(demoData));
    return structuredClone(demoData);
  }
  try { return JSON.parse(raw); } catch { return structuredClone(demoData); }
}
function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(data)); render(); }
function money(n){ return (Number(n)||0).toLocaleString("tr-TR") + " TL"; }
function today(){ return new Date().toISOString().slice(0,10); }
function id(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function customer(id){ return data.customers.find(x=>x.id===id); }
function vehicle(id){ return data.vehicles.find(x=>x.id===id); }
function servicesOfVehicle(vehicleId){ return data.services.filter(s=>s.vehicleId===vehicleId); }
function paymentsOfVehicle(vehicleId){ return data.payments.filter(p=>p.vehicleId===vehicleId); }
function vehicleTotal(vehicleId){ return servicesOfVehicle(vehicleId).reduce((t,s)=>t+Number(s.amount||0),0); }
function vehiclePaid(vehicleId){ return paymentsOfVehicle(vehicleId).reduce((t,p)=>t+Number(p.amount||0),0); }
function vehicleDebt(vehicleId){ return vehicleTotal(vehicleId)-vehiclePaid(vehicleId); }
function vehiclesOfCustomer(customerId){ return data.vehicles.filter(v=>v.customerId===customerId); }
function customerTotal(customerId){ return vehiclesOfCustomer(customerId).reduce((t,v)=>t+vehicleTotal(v.id),0); }
function customerPaid(customerId){ return vehiclesOfCustomer(customerId).reduce((t,v)=>t+vehiclePaid(v.id),0); }
function customerDebt(customerId){ return customerTotal(customerId)-customerPaid(customerId); }
function lastService(vehicleId){
  const list = servicesOfVehicle(vehicleId).sort((a,b)=>b.date.localeCompare(a.date));
  return list[0]?.date || "-";
}

document.querySelectorAll(".nav-btn").forEach(btn=>{
  btn.addEventListener("click",()=>showPage(btn.dataset.page));
});
function showPage(page){
  currentPage = page;
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.getElementById(page).classList.add("active");
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active", b.dataset.page===page));
  document.getElementById("pageTitle").textContent = ({
    dashboard:"Dashboard", customers:"Müşteriler / Firmalar", vehicles:"Araçlar",
    services:"Servis Kayıtları", payments:"Tahsilatlar", debts:"Borç Takibi", reports:"Raporlar", detail:"Detay"
  })[page] || "Dashboard";
  render();
}

function render(){
  renderDashboard();
  renderCustomers();
  renderVehicles();
  renderServices();
  renderPayments();
  renderDebts();
  renderReports();
}

function renderDashboard(){
  const totalVehicles = data.vehicles.length;
  const totalCustomers = data.customers.length;
  const totalRevenue = data.services.reduce((t,s)=>t+Number(s.amount||0),0);
  const totalPaid = data.payments.reduce((t,p)=>t+Number(p.amount||0),0);
  const todayPaid = data.payments.filter(p=>p.date===today()).reduce((t,p)=>t+Number(p.amount||0),0);
  const totalDebt = totalRevenue-totalPaid;
  document.getElementById("dashboard").innerHTML = `
    <div class="grid cards">
      ${card("Toplam Araç", totalVehicles)}
      ${card("Toplam Müşteri/Firma", totalCustomers)}
      ${card("Toplam Alacak", money(totalDebt), "bad")}
      ${card("Toplam Ciro", money(totalRevenue))}
      ${card("Bugünkü Tahsilat", money(todayPaid), "good")}
    </div>
    <div class="grid two-col">
      <div class="panel"><h3>Son Servis Kayıtları</h3>${serviceTable(data.services.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8))}</div>
      <div class="panel"><h3>Alacaklı Müşteriler / Firmalar</h3>${debtCustomerTable(true)}</div>
    </div>`;
}
function card(label,value,cls=""){ return `<div class="card"><small>${label}</small><strong class="${cls}">${value}</strong></div>`; }

function renderCustomers(){
  document.getElementById("customers").innerHTML = `<div class="panel"><h3>Müşteriler / Firmalar</h3>${customerTable(data.customers)}</div>`;
}
function customerTable(list){
  return `<div class="table-wrap"><table><thead><tr><th>Ad / Firma</th><th>Tür</th><th>Telefon</th><th>Araç</th><th>Toplam Borç</th><th>İşlem</th></tr></thead><tbody>
  ${list.map(c=>`<tr>
    <td>${c.name}</td><td>${c.type||"-"}</td><td>${c.phone||"-"}</td>
    <td>${vehiclesOfCustomer(c.id).length}</td>
    <td class="amount ${customerDebt(c.id)>0?'bad':'good'}">${money(customerDebt(c.id))}</td>
    <td><button class="btn" onclick="openCustomer('${c.id}')">Detay</button></td>
  </tr>`).join("") || emptyRow(6)}
  </tbody></table></div>`;
}
function renderVehicles(){
  document.getElementById("vehicles").innerHTML = `<div class="panel"><h3>Araçlar</h3>${vehicleTable(data.vehicles)}</div>`;
}
function vehicleTable(list){
  return `<div class="table-wrap"><table><thead><tr><th>Plaka</th><th>Sahibi/Firma</th><th>Araç</th><th>Son Servis</th><th>Borç</th><th>İşlem</th></tr></thead><tbody>
  ${list.map(v=>`<tr>
    <td><strong>${v.plate}</strong></td><td>${customer(v.customerId)?.name||"-"}</td>
    <td>${v.brand||""} ${v.model||""} ${v.year||""}</td><td>${lastService(v.id)}</td>
    <td class="amount ${vehicleDebt(v.id)>0?'bad':'good'}">${money(vehicleDebt(v.id))}</td>
    <td><button class="btn" onclick="openVehicle('${v.id}')">Geçmişi Gör</button></td>
  </tr>`).join("") || emptyRow(6)}
  </tbody></table></div>`;
}
function renderServices(){
  document.getElementById("services").innerHTML = `<div class="panel"><h3>Servis Kayıtları</h3>${serviceTable(data.services)}</div>`;
}
function serviceTable(list){
  return `<div class="table-wrap"><table><thead><tr><th>Tarih</th><th>Plaka</th><th>Müşteri/Firma</th><th>İşlem</th><th>Tutar</th><th>Not</th></tr></thead><tbody>
  ${list.map(s=>{ const v=vehicle(s.vehicleId); const c=customer(v?.customerId); return `<tr>
    <td>${s.date}</td><td>${v?.plate||"-"}</td><td>${c?.name||"-"}</td><td>${s.title||"-"}</td>
    <td class="amount">${money(s.amount)}</td><td>${s.note||"-"}</td>
  </tr>`}).join("") || emptyRow(6)}
  </tbody></table></div>`;
}
function renderPayments(){
  document.getElementById("payments").innerHTML = `<div class="panel"><h3>Tahsilatlar</h3>${paymentTable(data.payments)}</div>`;
}
function paymentTable(list){
  return `<div class="table-wrap"><table><thead><tr><th>Tarih</th><th>Müşteri/Firma</th><th>Plaka</th><th>Tutar</th><th>Not</th></tr></thead><tbody>
  ${list.map(p=>{ const v=vehicle(p.vehicleId); const c=customer(p.customerId); return `<tr>
    <td>${p.date}</td><td>${c?.name||"-"}</td><td>${v?.plate||"-"}</td><td class="amount good">${money(p.amount)}</td><td>${p.note||"-"}</td>
  </tr>`}).join("") || emptyRow(5)}
  </tbody></table></div>`;
}
function renderDebts(){
  document.getElementById("debts").innerHTML = `<div class="panel"><h3>Müşteri/Firma Bazlı Toplam Borç</h3>${debtCustomerTable(false)}</div>`;
}
function debtCustomerTable(onlyDebt){
  let list = data.customers.map(c=>({...c, debt:customerDebt(c.id), count:vehiclesOfCustomer(c.id).length}));
  if(onlyDebt) list = list.filter(c=>c.debt>0).slice(0,8);
  return `<div class="table-wrap"><table><thead><tr><th>Müşteri/Firma</th><th>Araç Sayısı</th><th>Toplam Borç</th><th>İşlem</th></tr></thead><tbody>
  ${list.map(c=>`<tr><td>${c.name}</td><td>${c.count}</td><td class="amount ${c.debt>0?'bad':'good'}">${money(c.debt)}</td><td><button class="btn" onclick="openCustomer('${c.id}')">Araçları Gör</button></td></tr>`).join("") || emptyRow(4)}
  </tbody></table></div>`;
}
function renderReports(){
  const debtors = data.customers.filter(c=>customerDebt(c.id)>0).length;
  document.getElementById("reports").innerHTML = `
    <div class="grid cards">
      ${card("Borçlu Müşteri/Firma", debtors)}
      ${card("Toplam Servis Kaydı", data.services.length)}
      ${card("Toplam Tahsilat Kaydı", data.payments.length)}
      ${card("Ortalama Araç Borcu", money(data.vehicles.length ? data.vehicles.reduce((t,v)=>t+vehicleDebt(v.id),0)/data.vehicles.length : 0))}
      ${card("Bugün Servis", data.services.filter(s=>s.date===today()).length)}
    </div>
    <div class="panel"><h3>Plaka Bazlı Borç Raporu</h3>${vehicleTable(data.vehicles.filter(v=>vehicleDebt(v.id)>0))}</div>`;
}
function emptyRow(cols){ return `<tr><td colspan="${cols}" style="color:var(--muted)">Kayıt bulunamadı.</td></tr>`; }

window.openCustomer = function(customerId){
  const c = customer(customerId);
  const vehicles = vehiclesOfCustomer(customerId);
  document.getElementById("detail").innerHTML = `
    <div class="detail-head">
      <div><span class="badge">${c.type||"Müşteri"}</span><h2>${c.name}</h2><p>${c.phone||"-"}</p></div>
      <button class="btn" onclick="showPage('customers')">Geri</button>
    </div>
    <div class="grid cards">
      ${card("Araç Sayısı", vehicles.length)}
      ${card("Toplam İşlem", money(customerTotal(c.id)))}
      ${card("Toplam Ödeme", money(customerPaid(c.id)), "good")}
      ${card("Toplam Borç", money(customerDebt(c.id)), customerDebt(c.id)>0?"bad":"good")}
      ${card("Son İşlem", vehicles.map(v=>lastService(v.id)).sort().pop() || "-")}
    </div>
    <div class="panel"><h3>Kayıtlı Plakalar</h3>${vehicleTable(vehicles)}</div>`;
  showPage("detail");
}
window.openVehicle = function(vehicleId){
  const v = vehicle(vehicleId);
  const c = customer(v.customerId);
  document.getElementById("detail").innerHTML = `
    <div class="detail-head">
      <div><span class="badge">Plaka Detayı</span><h2>${v.plate}</h2><p>${c?.name||"-"} • ${v.brand||""} ${v.model||""} ${v.year||""}</p></div>
      <button class="btn" onclick="showPage('vehicles')">Geri</button>
    </div>
    <div class="grid cards">
      ${card("Toplam İşlem", money(vehicleTotal(v.id)))}
      ${card("Toplam Ödeme", money(vehiclePaid(v.id)), "good")}
      ${card("Plaka Borcu", money(vehicleDebt(v.id)), vehicleDebt(v.id)>0?"bad":"good")}
      ${card("Servis Sayısı", servicesOfVehicle(v.id).length)}
      ${card("Son Servis", lastService(v.id))}
    </div>
    <div class="grid two-col">
      <div class="panel"><h3>Servis Geçmişi</h3>${serviceTable(servicesOfVehicle(v.id))}</div>
      <div class="panel"><h3>Tahsilat Geçmişi</h3>${paymentTable(paymentsOfVehicle(v.id))}</div>
    </div>`;
  showPage("detail");
}

const searchInput = document.getElementById("globalSearch");
const searchBox = document.getElementById("searchResults");
searchInput.addEventListener("input", ()=>{
  const q = searchInput.value.trim().toLowerCase();
  if(q.length<2){ searchBox.classList.add("hidden"); return; }
  const customerMatches = data.customers.filter(c=>c.name.toLowerCase().includes(q));
  const vehicleMatches = data.vehicles.filter(v=>v.plate.toLowerCase().includes(q));
  const html = [
    ...customerMatches.map(c=>`<div class="search-item" onclick="openCustomer('${c.id}'); clearSearch()">👤 ${c.name} <small>• ${vehiclesOfCustomer(c.id).length} araç • ${money(customerDebt(c.id))} borç</small></div>`),
    ...vehicleMatches.map(v=>`<div class="search-item" onclick="openVehicle('${v.id}'); clearSearch()">🚗 ${v.plate} <small>• ${customer(v.customerId)?.name||"-"}</small></div>`)
  ].join("");
  searchBox.innerHTML = html || `<div class="search-item">Sonuç yok</div>`;
  searchBox.classList.remove("hidden");
});
window.clearSearch = function(){ searchInput.value=""; searchBox.classList.add("hidden"); }

document.getElementById("addCustomerBtn").onclick = ()=>openModal("customer");
document.getElementById("addVehicleBtn").onclick = ()=>openModal("vehicle");
document.getElementById("addServiceBtn").onclick = ()=>openModal("service");
document.getElementById("addPaymentBtn").onclick = ()=>openModal("payment");

function openModal(type){
  const modal = document.getElementById("modal");
  const title = document.getElementById("modalTitle");
  const fields = document.getElementById("modalFields");
  const saveBtn = document.getElementById("saveModal");
  title.textContent = ({customer:"Müşteri/Firma Ekle", vehicle:"Araç Ekle", service:"Servis Kaydı Ekle", payment:"Tahsilat Ekle"})[type];

  const customerOptions = data.customers.map(c=>`<option value="${c.id}">${c.name}</option>`).join("");
  const vehicleOptions = data.vehicles.map(v=>`<option value="${v.id}">${v.plate} - ${customer(v.customerId)?.name||""}</option>`).join("");

  fields.innerHTML = ({
    customer: `
      ${field("Ad Soyad / Firma Adı","name")}
      ${field("Telefon","phone")}
      <div class="field"><label>Tür</label><select name="type"><option>Şahıs</option><option>Firma</option></select></div>`,
    vehicle: `
      <div class="field"><label>Müşteri / Firma</label><select name="customerId" required>${customerOptions}</select></div>
      ${field("Plaka","plate")}
      ${field("Marka","brand")}
      ${field("Model","model")}
      ${field("Yıl","year","number")}`,
    service: `
      <div class="field"><label>Plaka</label><select name="vehicleId" required>${vehicleOptions}</select></div>
      ${field("Tarih","date","date",today())}
      ${field("İşlem Başlığı","title")}
      ${field("Tutar","amount","number")}
      <div class="field"><label>Not</label><textarea name="note"></textarea></div>`,
    payment: `
      <div class="field"><label>Plaka</label><select name="vehicleId" required>${vehicleOptions}</select></div>
      ${field("Tarih","date","date",today())}
      ${field("Tutar","amount","number")}
      <div class="field"><label>Not</label><textarea name="note"></textarea></div>`
  })[type];

  saveBtn.onclick = (e)=>{
    e.preventDefault();
    const fd = new FormData(document.getElementById("modalForm"));
    const obj = Object.fromEntries(fd.entries());

    if(type==="customer"){
      data.customers.push({id:id("c"), name:obj.name, phone:obj.phone, type:obj.type});
    }
    if(type==="vehicle"){
      data.vehicles.push({id:id("v"), customerId:obj.customerId, plate:(obj.plate||"").toUpperCase(), brand:obj.brand, model:obj.model, year:obj.year});
    }
    if(type==="service"){
      data.services.push({id:id("s"), vehicleId:obj.vehicleId, date:obj.date, title:obj.title, amount:Number(obj.amount||0), note:obj.note});
    }
    if(type==="payment"){
      const v = vehicle(obj.vehicleId);
      data.payments.push({id:id("p"), customerId:v.customerId, vehicleId:obj.vehicleId, date:obj.date, amount:Number(obj.amount||0), note:obj.note});
    }
    modal.close();
    save();
  };
  modal.showModal();
}
function field(label,name,type="text",value=""){
  return `<div class="field"><label>${label}</label><input name="${name}" type="${type}" value="${value}" required></div>`;
}

render();
