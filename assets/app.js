// Delta Chi Convention Guide — interactive map + filters
const HOTEL = { lat: 39.7664025, lng: -86.1611178 };
const CATEGORY_STYLE = {
  hotel:   { color: '#C41E3A', emoji: '🏨', label: 'Hotel' },
  food:    { color: '#22c55e', emoji: '🍴', label: 'Food'  },
  brewery: { color: '#f59e0b', emoji: '🍺', label: 'Brewery' }
};

let map, allMarkers = [], placesData = [], tourData = null, currentFilter = 'all';

async function init() {
  const [places, tour] = await Promise.all([
    fetch('data/places.json').then(r => r.json()),
    fetch('data/tour.json').then(r => r.json())
  ]);
  placesData = places;
  tourData = tour;

  initMap();
  renderMarkers();
  renderFoodGrid();
  renderBreweryGrid();
  renderTour();
  renderCounts();
  renderCountdown();
  bindFilters();
}

function initMap() {
  map = L.map('map').setView([HOTEL.lat, HOTEL.lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);
}

function makeIcon(category) {
  const s = CATEGORY_STYLE[category];
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="background:${s.color};width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:14px;">${s.emoji}</span></div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
}

function renderMarkers() {
  allMarkers.forEach(m => map.removeLayer(m));
  allMarkers = [];
  placesData.forEach(p => {
    if (currentFilter !== 'all' && p.category !== currentFilter) return;
    const m = L.marker([p.lat, p.lng], { icon: makeIcon(p.category) }).addTo(map);
    const ratingLine = p.rating ? `⭐ ${p.rating} (${p.reviews?.toLocaleString() ?? '?'} reviews)` : '';
    const priceLine = p.price ? ` · ${p.price}` : '';
    m.bindPopup(`
      <div style="min-width:200px;">
        <strong>${p.name}</strong><br>
        <span style="color:#666;font-size:12px;">${p.address.split(',').slice(0,2).join(',')}</span><br>
        ${ratingLine ? `<span style="font-size:12px;">${ratingLine}${priceLine}</span><br>` : ''}
        <span style="font-size:11px;color:#888;">${p.tag}</span><br>
        <a href="${p.url}" target="_blank" style="color:#C41E3A;font-size:12px;">Open in Google Maps →</a>
      </div>
    `);
    allMarkers.push(m);
  });
}

function bindFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderMarkers();
    });
  });
}

function renderCounts() {
  document.getElementById('count-all').textContent = placesData.length;
  document.getElementById('count-food').textContent = placesData.filter(p => p.category === 'food').length;
  document.getElementById('count-brewery').textContent = placesData.filter(p => p.category === 'brewery').length;
}

function placeCard(p, accentColor = '#C41E3A') {
  const ratingLine = p.rating ? `<span class="text-sm">⭐ ${p.rating} <span class="text-stone-500">(${p.reviews?.toLocaleString() ?? '?'})</span></span>` : '';
  const priceBadge = p.price ? `<span class="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-700">${p.price}</span>` : '';
  const tagBadge = `<span class="text-xs px-2 py-0.5 rounded text-white" style="background:${accentColor}">${p.tag}</span>`;
  return `
    <a href="${p.url}" target="_blank" class="block bg-white border border-stone-200 rounded-lg p-4 hover:shadow-md hover:border-stone-300 transition">
      <div class="flex justify-between items-start gap-2 mb-2">
        <h3 class="font-bold text-stone-900">${p.name}</h3>
      </div>
      <p class="text-stone-600 text-sm mb-3">${p.address.split(',').slice(0,2).join(',')}</p>
      <div class="flex items-center gap-2 flex-wrap">
        ${ratingLine}
        ${priceBadge}
        ${tagBadge}
      </div>
    </a>`;
}

function renderFoodGrid() {
  const grid = document.getElementById('food-grid');
  grid.innerHTML = placesData
    .filter(p => p.category === 'food')
    .map(p => placeCard(p, '#16a34a'))
    .join('');
}

function renderBreweryGrid() {
  const grid = document.getElementById('brewery-grid');
  grid.innerHTML = placesData
    .filter(p => p.category === 'brewery')
    .map(p => placeCard(p, '#d97706'))
    .join('');
}

function renderTour() {
  const stops = document.getElementById('tour-stops');
  stops.innerHTML = tourData.stops.map((s, i) => `
    <div class="bg-white/10 backdrop-blur rounded-lg p-5 border border-white/20">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-3xl font-bold text-amber-300">${i+1}</span>
        <span class="text-amber-300 text-sm font-semibold">${s.time}</span>
      </div>
      <h3 class="text-xl font-bold mb-1">${s.name}</h3>
      <p class="text-stone-300 text-sm">${s.reason}</p>
      <a href="https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}" target="_blank" class="text-amber-300 text-xs mt-3 inline-block hover:underline">Open in Maps →</a>
    </div>
  `).join('');

  const list = document.getElementById('charter-list');
  list.innerHTML = tourData.charters.map((c, i) => `
    <div class="bg-white/5 rounded-lg p-4 border border-white/10">
      <div class="flex items-center gap-2 mb-1">
        ${i === 0 ? '<span class="text-xs bg-amber-300 text-stone-900 px-2 py-0.5 rounded font-bold">CALL FIRST</span>' : `<span class="text-xs text-stone-400">#${i+1}</span>`}
      </div>
      <h4 class="font-bold text-lg">${c.name}</h4>
      <p class="text-stone-300 text-sm mb-2">${c.note}</p>
      <div class="flex gap-3 text-sm">
        <a href="tel:${c.phone.replace(/[^0-9+]/g,'')}" class="text-amber-300 hover:underline">📞 ${c.phone}</a>
        <a href="${c.url}" target="_blank" class="text-amber-300 hover:underline">🌐 Site</a>
      </div>
    </div>
  `).join('');
}

function renderCountdown() {
  const target = new Date('2026-07-22T08:00:00-04:00');
  const days = Math.ceil((target - Date.now()) / (1000 * 60 * 60 * 24));
  if (days > 0) {
    document.getElementById('countdown').textContent = `${days} days until convention.`;
  } else if (days >= -5) {
    document.getElementById('countdown').textContent = `Live from Indy!`;
  }
}

document.addEventListener('DOMContentLoaded', init);
