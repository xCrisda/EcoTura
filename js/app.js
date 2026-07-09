/* ---------------------------
   App logic: maps, login, reports
--------------------------- */

// 1. DATA: Rutas de recolección (Ajuste fino para evitar edificios)
const routes = [
  {
    id: 1, name: 'Ruta 1: Av. Simón Bolívar (Eje Vial)', schedule: 'Lunes, Miércoles - 06:00 AM', coords: [
      [3.8960, -77.0670], [3.8950, -77.0680], [3.8940, -77.0690],
      [3.8930, -77.0700], [3.8920, -77.0710], [3.8910, -77.0720],
      [3.8900, -77.0730], [3.8890, -77.0740], [3.8880, -77.0750]
    ]
  },
  {
    id: 2, name: 'Ruta 2: La Independencia (Cuadras exactas)', schedule: 'Martes, Jueves - 08:00 AM', coords: [
      [3.8760, -77.0350], [3.8760, -77.0320], [3.8760, -77.0300],
      [3.8740, -77.0300], [3.8740, -77.0280], [3.8720, -77.0280]
    ]
  },
  {
    id: 3, name: 'Ruta 3: Malecón (Borde Costero)', schedule: 'Viernes, Sábado - 10:00 PM', coords: [
      [3.8890, -77.0800], [3.8880, -77.0802], [3.8870, -77.0805],
      [3.8860, -77.0808], [3.8850, -77.0810], [3.8840, -77.0810],
      [3.8830, -77.0808], [3.8820, -77.0805]
    ]
  }
];

// Simple helpers
const $ = id => document.getElementById(id);

// Show overlays
function showRegister() {
  $('loginOverlay').style.display = 'none';
  $('registerOverlay').style.display = 'flex';
}
function showLogin() {
  $('registerOverlay').style.display = 'none';
  $('loginOverlay').style.display = 'flex';
}

// Local auth (demo). Stores single user in localStorage.
function handleRegister() {
  const u = $('regUser').value.trim();
  const e = $('regEmail').value.trim();
  const p = $('regPass').value;

  if (!u || !e || !p) { alert('Complete todos los campos'); return; }

  // 1. Guardar en LocalStorage (ESENCIAL para poder iniciar sesión de inmediato)
  localStorage.setItem('eco_user', JSON.stringify({ usuario: u, email: e, pass: p }));

  alert('Registro exitoso. Ahora INICIA SESIÓN con esos datos.');
  showLogin();
}

function handleLogin() {
  const u = $('loginUser').value.trim();
  const p = $('loginPass').value;

  // 1. Basic validation
  if (!u || !p) {
    alert('Por favor ingrese usuario y contraseña');
    return;
  }

  // 2. Get registered details
  const data = JSON.parse(localStorage.getItem('eco_user'));

  // 3. Strict check: User MUST exist locally
  if (!data || !data.usuario) {
    alert('No hay usuarios registrados en este navegador. Por favor regístrate primero.');
    return;
  }

  // 4. Match credentials
  if ((u === data.usuario || u === data.email) && p === data.pass) {
    $('loginOverlay').style.display = 'none';
    initApp();
  } else {
    alert('Credenciales INVÁLIDAS. Verifique usuario y contraseña.');
  }
}


/* ---------------------------
   Leaflet maps & Route Logic
--------------------------- */
let mapRutas, mapReporte, reportMarker;
let simMarker = null, simInterval = null, currentRoute = null;
let simPolyline = null;

function initMaps() {
  // RUTAS MAP
  if (!mapRutas) {
    mapRutas = L.map('mapRutas', { zoomControl: true }).setView([3.885, -77.070], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapRutas);

    const puntos = [
      { name: 'Estación Central Reciclaje', coords: [3.880, -77.039] },
      { name: 'Punto Verde - Centro', coords: [3.873, -77.029] },
      { name: 'Recolecta Cascajal', coords: [3.886, -77.050] },
      { name: 'Punto Playa - Malecón', coords: [3.871, -77.034] }
    ];
    puntos.forEach(p => {
      L.marker(p.coords).addTo(mapRutas).bindPopup(`<b>${p.name}</b><br>Servicio de reciclaje.`);
    });
    // Force redraw to prevent gray tiles
    setTimeout(() => mapRutas.invalidateSize(), 100);
  }

  // REPORTE MAP
  if (!mapReporte) {
    mapReporte = L.map('mapReporte', { zoomControl: true, attributionControl: false }).setView([3.875, -77.076], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapReporte);
    mapReporte.on('click', (e) => {
      if (reportMarker) reportMarker.remove();
      reportMarker = L.marker(e.latlng).addTo(mapReporte).bindPopup('Ubicación del reporte').openPopup();
    });
    setTimeout(() => mapReporte.invalidateSize(), 100);
  }

  initRoutesList();
}

function initRoutesList() {
  const list = $('routesList');
  if (!list) return;
  list.innerHTML = '';
  routes.forEach(r => {
    const li = document.createElement('li');
    li.className = 'list-group-item';
    li.style.cssText = "background:white; padding:12px; border:1px solid #ddd; border-radius:8px; cursor:pointer; transition:0.2s;";
    li.innerHTML = `<strong>${r.name}</strong><br><span style='font-size:12px; color:#666'>${r.schedule}</span>`;
    li.onmouseover = () => li.style.background = '#e9fbf1';
    li.onmouseout = () => li.style.background = 'white';
    li.onclick = () => selectRoute(r);
    list.appendChild(li);
  });
}

function selectRoute(r) {
  currentRoute = r;
  if (simPolyline) mapRutas.removeLayer(simPolyline);
  simPolyline = L.polyline(r.coords, { color: '#0e7a3a', weight: 5, lineCap: 'round' }).addTo(mapRutas);
  mapRutas.fitBounds(simPolyline.getBounds(), { padding: [50, 50] });

  $('routeDetails').style.display = 'block';
  $('routeTitle').textContent = r.name;
  $('routeSchedule').textContent = r.schedule;

  if (simMarker) { mapRutas.removeLayer(simMarker); simMarker = null; }
  if (simInterval) clearInterval(simInterval);
  notify(`Ruta seleccionada: ${r.name}`);
}

function startSimulation() {
  if (!mapRutas) return;
  const routeToSim = currentRoute ? currentRoute.coords : routes[0].coords;

  if (simMarker) { mapRutas.removeLayer(simMarker); simMarker = null; }
  if (simInterval) clearInterval(simInterval);

  let simIndex = 0;
  const icon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/1995/1995574.png',
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  simMarker = L.marker(routeToSim[0], { icon: icon }).addTo(mapRutas).bindPopup('Camión de Recolección');
  notify('Simulación iniciada: camión en ruta.');

  simInterval = setInterval(() => {
    simIndex++;
    if (simIndex >= routeToSim.length) simIndex = 0;
    simMarker.setLatLng(routeToSim[simIndex]);
    mapRutas.panTo(routeToSim[simIndex]);

    // Proximity Alert
    const citizenHome = routeToSim[Math.floor(routeToSim.length / 2)];
    const dist = mapRutas.distance(routeToSim[simIndex], citizenHome);

    if (!window.homeMarker) {
      window.homeMarker = L.marker(citizenHome, { opacity: 0.6 }).addTo(mapRutas).bindPopup("Tu Casa (Simulada)");
    }

    if (dist < 150) {
      notify(`🔔 ¡ATENCIÓN! El camión está cerca (${Math.round(dist)}m). ¡Saca la basura!`);
    }
  }, 1000);
}

function stopSimulation() {
  if (simInterval) clearInterval(simInterval);
  simInterval = null;
  if (simMarker) { mapRutas.removeLayer(simMarker); simMarker = null; }
  if (window.homeMarker) { mapRutas.removeLayer(window.homeMarker); window.homeMarker = null; }
  notify('Simulación detenida manualmente.');
}

function centerMap() {
  if (mapRutas) mapRutas.setView([3.885, -77.070], 14);
}

function notify(text) {
  const area = document.getElementById('notifArea');
  if (area) area.innerHTML = `<div class="small" style="padding:4px 0; border-bottom:1px solid #eee;"><strong>${new Date().toLocaleTimeString()}</strong> — ${text}</div>` + area.innerHTML;
}

/* ---------------------------
   Reports management
--------------------------- */
function sendReport() {
  const desc = document.getElementById('descReporte').value.trim();
  const foto = document.getElementById('fotoReporte');
  const pos = reportMarker ? reportMarker.getLatLng() : null;
  if (!desc && !pos && (!foto || !foto.files.length)) {
    alert('Adjunte descripción, foto o seleccione ubicación en el mapa');
    return;
  }
  const list = JSON.parse(localStorage.getItem('eco_reports') || '[]');
  list.unshift({
    id: Date.now(),
    desc,
    lat: pos ? pos.lat : null,
    lng: pos ? pos.lng : null,
    fotoName: foto && foto.files.length ? foto.files[0].name : null,
    date: new Date().toLocaleString()
  });
  localStorage.setItem('eco_reports', JSON.stringify(list));
  renderReports();
  document.getElementById('descReporte').value = '';
  if (reportMarker) { reportMarker.remove(); reportMarker = null; }
  if (foto) foto.value = '';
  notify('Reporte enviado.');
}
function renderReports() {
  const cont = document.getElementById('listaReportes');
  if (!cont) return;
  const list = JSON.parse(localStorage.getItem('eco_reports') || '[]');
  if (!list.length) { cont.innerHTML = 'No hay reportes aún.'; return; }
  cont.innerHTML = list.map(r => `
    <div class="report-item">
      <strong>${r.desc}</strong><br/>
      <span class="small">${r.date}</span>
    </div>
  `).join('');
}

/* ---------------------------
   Init app after login
--------------------------- */
function initApp() {
  document.querySelectorAll('.overlay').forEach(o => o.style.display = 'none');
  setTimeout(() => { initMaps(); renderReports(); }, 200);
}

document.addEventListener('DOMContentLoaded', () => {
  // Listeners
  $('simBtn').addEventListener('click', startSimulation);
  $('stopBtn').addEventListener('click', stopSimulation);
  $('centerBtn').addEventListener('click', centerMap);
  $('enviarReporteBtn').addEventListener('click', sendReport);
  $('limpiarReporteBtn').addEventListener('click', () => {
    document.getElementById('descReporte').value = '';
    document.getElementById('fotoReporte').value = '';
    if (reportMarker) { reportMarker.remove(); reportMarker = null; }
  });

  document.getElementById('loginOverlay').style.display = 'flex';
});

function logout() {
  // 1. Stop simulation if running
  if (simInterval) clearInterval(simInterval);
  if (simMarker) { mapRutas.removeLayer(simMarker); simMarker = null; }

  // 2. Clear sensitive inputs
  document.getElementById('loginPass').value = '';

  // 3. Show Login Overlay
  document.getElementById('loginOverlay').style.display = 'flex';
  alert('Sesión cerrada.');
}

// Expose helpers
window.initMaps = initMaps;
window.startSimulation = startSimulation;
window.handleRegister = handleRegister;
window.handleLogin = handleLogin;
window.showRegister = showRegister;
window.showLogin = showLogin;
window.logout = logout;