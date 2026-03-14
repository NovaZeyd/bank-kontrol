import { mockApi } from './mockData'

const API_URL = 'http://localhost:8000';

let useDemo = false;

// Check if backend is available, fallback to demo mode
async function checkBackend() {
  try {
    const res = await fetch(`${API_URL}/health`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) { useDemo = false; return; }
  } catch {}
  useDemo = true;
  console.log('Backend unavailable - demo mode active');
}
checkBackend();

async function fetchAPI(endpoint, options = {}) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function withFallback(apiFn, mockFn) {
  return async (...args) => {
    if (useDemo) return mockFn(...args);
    try {
      return await apiFn(...args);
    } catch {
      useDemo = true;
      return mockFn(...args);
    }
  };
}

export const api = {
  // Hesaplar
  getHesaplar: withFallback(() => fetchAPI('/hesaplar'), mockApi.getHesaplar),
  getHesap: withFallback((id) => fetchAPI(`/hesaplar/${id}`), mockApi.getHesap),
  createHesap: withFallback((data) => fetchAPI('/hesaplar', { method: 'POST', body: JSON.stringify(data) }), mockApi.createHesap),
  deleteHesap: withFallback((id) => fetchAPI(`/hesaplar/${id}`, { method: 'DELETE' }), mockApi.deleteHesap),
  getHesapBakiye: withFallback((id) => fetchAPI(`/hesaplar/${id}/bakiye`), mockApi.getHesapBakiye),

  // Özet
  getOzet: withFallback(() => fetchAPI('/ozet'), mockApi.getOzet),

  // Hareketler
  getHareketler: withFallback((hesapId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/hesaplar/${hesapId}/hareketler${qs ? '?' + qs : ''}`);
  }, mockApi.getHareketler),
  getTumHareketler: withFallback((params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/tum-hareketler${qs ? '?' + qs : ''}`);
  }, mockApi.getTumHareketler),
  addHareket: withFallback((hesapId, data) => fetchAPI(`/hesaplar/${hesapId}/hareketler`, {
    method: 'POST', body: JSON.stringify(data)
  }), mockApi.addHareket),
  deleteHareket: withFallback((id) => fetchAPI(`/hareketler/${id}`, { method: 'DELETE' }), mockApi.deleteHareket),

  // Raporlar
  createRapor: withFallback((data) => fetchAPI('/raporlar/olustur', { method: 'POST', body: JSON.stringify(data) }), mockApi.createRapor),
  getDetayliRapor: withFallback((params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/raporlar/detayli${qs ? '?' + qs : ''}`);
  }, mockApi.getDetayliRapor),

  // Upload
  uploadPDF: withFallback((hesapId, file) => {
    const form = new FormData();
    form.append('dosya', file);
    return fetch(`${API_URL}/pdf-yukle?hesap_id=${hesapId}`, {
      method: 'POST', body: form,
    }).then(r => r.json());
  }, mockApi.uploadPDF),
  uploadExcel: withFallback((hesapId, file) => {
    const form = new FormData();
    form.append('dosya', file);
    return fetch(`${API_URL}/excel-yukle?hesap_id=${hesapId}`, {
      method: 'POST', body: form,
    }).then(r => r.json());
  }, mockApi.uploadExcel),

  // Rehber
  getRehber: withFallback(() => fetchAPI('/rehber'), mockApi.getRehber),
  addRehber: withFallback((data) => fetchAPI('/rehber', { method: 'POST', body: JSON.stringify(data) }), mockApi.addRehber),
  sendRapor: withFallback((raporId, data) => fetchAPI(`/raporlar/${raporId}/gonder`, { method: 'POST', body: JSON.stringify(data) }), mockApi.sendRapor),

  // Health
  health: withFallback(() => fetchAPI('/health'), mockApi.health),
};

export default api;
