// Delta Chi Convention Guide — interactive map + filters
const HOTEL = { lat: 39.7664025, lng: -86.1611178 };
const CATEGORY_STYLE = {
  hotel:    { color: '#C41E3A', emoji: '🏨', label: 'Hotel' },
  food:     { color: '#22c55e', emoji: '🍴', label: 'Food'  },
  brewery:  { color: '#f59e0b', emoji: '🍺', label: 'Brewery' },
  beertour: { color: '#7c3aed', emoji: '🚌', label: 'Beer Tour' }
};

let map, allMarkers = [], placesData = [], tourData = null, rosterData = null, currentFilter = 'all';

async function init() {
  const [places, tour, roster] = await Promise.all([
    fetch('data/places.json').then(r => r.json()),
    fetch('data/tour.json').then(r => r.json()),
    fetch('data/roster.json?_=' + Date.now()).then(r => r.json()).catch(() => ({attendees:[], rooms:[]}))
  ]);
  placesData = places;
  tourData = tour;
  rosterData = roster;

  initMap();
  renderMarkers();
  renderFoodGrid();
  renderBreweryGrid();
  renderTour();
  renderCounts();
  renderCountdown();
  bindFilters();
  bindRosterTabs();
  renderRoster();
}

function initMap() {
  map = L.map('map').setView([HOTEL.lat, HOTEL.lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(map);
}

function mapsUrl(p) {
  // Prefer a custom non-Google link (e.g. hotel's Hyatt page); otherwise
  // resolve to the actual business by querying its name + address rather than coordinates.
  if (p.url && !p.url.includes('google.com/maps')) return p.url;
  return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${p.name}, ${p.address}`);
}

function makeIcon(category, label) {
  const s = CATEGORY_STYLE[category];
  const glyph = label != null ? `<span style="transform:rotate(45deg);font-size:15px;font-weight:700;color:white;">${label}</span>`
                              : `<span style="transform:rotate(45deg);font-size:14px;">${s.emoji}</span>`;
  return L.divIcon({
    className: 'custom-pin',
    html: `<div style="background:${s.color};width:32px;height:32px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">${glyph}</div>`,
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
    const label = p.category === 'beertour' && p.stop != null ? p.stop : null;
    const m = L.marker([p.lat, p.lng], { icon: makeIcon(p.category, label) }).addTo(map);
    const ratingLine = p.rating ? `⭐ ${p.rating} (${p.reviews?.toLocaleString() ?? '?'} reviews)` : '';
    const priceLine = p.price ? ` · ${p.price}` : '';
    m.bindPopup(`
      <div style="min-width:200px;">
        <strong>${p.name}</strong><br>
        <span style="color:#666;font-size:12px;">${p.address.split(',').slice(0,2).join(',')}</span><br>
        ${ratingLine ? `<span style="font-size:12px;">${ratingLine}${priceLine}</span><br>` : ''}
        <span style="font-size:11px;color:#888;">${p.tag}</span><br>
        <a href="${mapsUrl(p)}" target="_blank" style="color:#C41E3A;font-size:12px;">Open in Google Maps →</a>
      </div>
    `);
    allMarkers.push(m);
  });

  // Fit the view to the visible pins so far-out stops (e.g. the beer tour) stay on screen.
  if (allMarkers.length > 1) {
    const group = L.featureGroup(allMarkers);
    map.fitBounds(group.getBounds().pad(0.15));
  } else if (allMarkers.length === 1) {
    map.setView(allMarkers[0].getLatLng(), 14);
  }
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
  const beertour = document.getElementById('count-beertour');
  if (beertour) beertour.textContent = placesData.filter(p => p.category === 'beertour').length;
}

function placeCard(p, accentColor = '#C41E3A') {
  const ratingLine = p.rating ? `<span class="text-sm">⭐ ${p.rating} <span class="text-stone-500">(${p.reviews?.toLocaleString() ?? '?'})</span></span>` : '';
  const priceBadge = p.price ? `<span class="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-700">${p.price}</span>` : '';
  const tagBadge = `<span class="text-xs px-2 py-0.5 rounded text-white" style="background:${accentColor}">${p.tag}</span>`;
  return `
    <a href="${mapsUrl(p)}" target="_blank" class="block bg-white border border-stone-200 rounded-lg p-4 hover:shadow-md hover:border-stone-300 transition">
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
  stops.innerHTML = tourData.stops.map((s, i) => {
    const mapsQuery = encodeURIComponent(`${s.name}, ${s.address}`);
    const roleBadge = s.role
      ? `<span class="inline-block bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full">${s.role}</span>`
      : '';
    const googleLine = s.google_rating
      ? `<span title="Google rating">⭐ ${s.google_rating} <span class="text-stone-400">(${s.google_reviews?.toLocaleString() ?? '?'})</span></span>`
      : '';
    const untappdLine = s.untappd_rating
      ? `<a href="${s.untappd_url}" target="_blank" rel="noopener" class="text-amber-300 hover:underline"${s.untappd_note ? ` title="${s.untappd_note}"` : ''}>🍺 Untappd ${s.untappd_rating}</a>`
      : '';
    return `
    <div class="bg-white/10 backdrop-blur rounded-lg p-5 border border-white/20 flex flex-col">
      <div class="flex items-start gap-3 mb-2">
        <span class="text-3xl font-bold text-amber-300 leading-none">${i+1}</span>
        <div>
          <h3 class="text-xl font-bold leading-tight">${s.name} ${s.emoji ?? ''}</h3>
          ${roleBadge}
        </div>
      </div>
      <p class="text-stone-400 text-xs mb-3">${s.address}</p>
      <div class="flex items-center gap-3 flex-wrap text-sm mb-3">
        ${googleLine}
        ${untappdLine}
      </div>
      <p class="text-stone-400 text-xs mb-2"><span class="font-semibold text-stone-300">Friday:</span> ${s.friday_hours}</p>
      <p class="text-stone-300 text-sm flex-1">${s.description}</p>
      <a href="https://www.google.com/maps/search/?api=1&query=${mapsQuery}" target="_blank" rel="noopener" class="text-amber-300 text-xs mt-3 inline-block hover:underline">Open in Maps →</a>
    </div>
  `;
  }).join('');

  const summary = document.getElementById('tour-summary');
  if (summary) {
    const bits = [];
    if (tourData.route) bits.push(tourData.route);
    if (tourData.pickup_time) bits.push(`Pickup ${tourData.pickup_time}`);
    if (tourData.total_drive_time) bits.push(tourData.total_drive_time);
    if (tourData.transport?.vehicle) {
      const coach = tourData.transport.name ? `${tourData.transport.vehicle} (${tourData.transport.name})` : tourData.transport.vehicle;
      bits.push(coach);
    }
    if (tourData.guests) bits.push(`~${tourData.guests} guests`);
    summary.innerHTML = `
      <div class="bg-white/5 border border-white/10 rounded-lg p-5">
        <p class="text-xs font-bold uppercase tracking-widest text-amber-300 mb-2">Tour Route</p>
        <p class="text-stone-200 text-sm md:text-base">${bits.join(' · ')}</p>
        ${tourData.food_note ? `<p class="text-stone-400 text-sm mt-3">🍕 ${tourData.food_note}</p>` : ''}
      </div>`;
  }

  const details = document.getElementById('tour-details');
  if (details && tourData.transport) {
    const transport = tourData.transport;
    details.innerHTML = `
      <div class="bg-amber-400 text-stone-950 rounded-lg p-5 md:p-6 shadow-lg">
        <div class="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-5 items-center">
          <div>
            <p class="text-xs font-bold uppercase tracking-widest text-stone-800 mb-2">Beer Bus Confirmed</p>
            <h3 class="text-2xl font-bold mb-2">$${tourData.cost_per_person}/person · ${transport.vehicle}</h3>
            <p class="text-sm text-stone-800">Transport by <a href="${transport.url}" target="_blank" rel="noopener" class="font-semibold underline hover:text-stone-950">${transport.name}</a>. Capacity is ${transport.capacity} passengers.</p>
            <p class="text-sm text-stone-800 mt-2">We will have a cooler with ice and some waters on board as well.</p>
          </div>
          <div class="flex flex-col sm:flex-row md:flex-col gap-3 md:min-w-[190px]">
            <a href="${tourData.payment_url}" target="_blank" rel="noopener" class="bg-stone-950 text-white text-center px-5 py-3 rounded-lg font-bold hover:bg-stone-800 transition">Pay with PayPal →</a>
            <a href="${transport.url}" target="_blank" rel="noopener" class="bg-white/50 text-stone-950 text-center px-5 py-3 rounded-lg font-semibold hover:bg-white/70 transition">View Coach →</a>
          </div>
        </div>
      </div>
    `;
  }

  const list = document.getElementById('charter-list');
  if (list) {
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

// ---------- Roster (auto-published from private Google Sheet via Apps Script) ----------

function bindRosterTabs() { /* no-op: tabs removed in favor of single attendee list */ }

function renderRoster() {
  const attendees = rosterData.attendees || [];
  document.getElementById('count-attending').textContent = attendees.length;

  if (attendees.length === 0) {
    document.getElementById('attending-empty').classList.remove('hidden');
  } else {
    renderAttending(attendees);
    renderRoommateFinder(attendees);
  }

  if (rosterData.updated_at) {
    const stamp = document.getElementById('roster-updated');
    if (stamp) {
      const d = new Date(rosterData.updated_at);
      stamp.textContent = `Last updated ${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
    }
  }

  // Wire submit form button
  const btn = document.getElementById('submit-form-btn');
  const fallback = document.getElementById('submit-form-fallback');
  if (rosterData.submit_form_url) {
    btn.href = rosterData.submit_form_url;
  } else {
    btn.classList.add('opacity-50', 'cursor-not-allowed');
    btn.addEventListener('click', e => e.preventDefault());
    if (fallback) fallback.classList.remove('hidden');
  }
}

function renderAttending(rows) {
  const cols = Object.keys(rows[0]);
  const html = `
    <table class="roster">
      <thead><tr>${cols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map(r => `<tr>${cols.map(c => `<td>${escapeHtml(r[c] || '')}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>`;
  document.getElementById('attending-table').innerHTML = html;
}

function renderRooms() { /* no-op: rooms section removed */ }

function renderRoommateFinder(attendees) {
  const cols = Object.keys(attendees[0]);
  const flagCol = cols.find(c => /roommate|partner|bunk|share/i.test(c));
  if (!flagCol) return;
  const seekers = attendees.filter(a => {
    const v = String(a[flagCol] || '').trim().toUpperCase();
    return v === 'Y' || v === 'YES' || v === 'TRUE' || v === '1' || v === '✓';
  });
  if (seekers.length === 0) return;
  const finder = document.getElementById('roommate-finder');
  const list = document.getElementById('roommate-list');
  const nameCol = cols.find(c => /name/i.test(c)) || cols[0];
  const chapterCol = cols.find(c => /chapter/i.test(c));
  list.innerHTML = seekers.map(s => {
    const name = escapeHtml(s[nameCol] || '');
    const chapter = chapterCol ? ` <span class="text-stone-500 text-xs">(${escapeHtml(s[chapterCol] || '')})</span>` : '';
    return `<span class="bg-white border border-amber-300 text-stone-800 px-3 py-1.5 rounded-full text-sm">${name}${chapter}</span>`;
  }).join('');
  finder.classList.remove('hidden');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
