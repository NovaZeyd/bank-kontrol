const API_URL = 'http://localhost:8000';

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

export const api = {
  // Hesaplar
  getHesaplar: () => fetchAPI('/hesaplar'),
  getHesap: (id) => fetchAPI(`/hesaplar/${id}`),
  createHesap: (data) => fetchAPI('/hesaplar', { method: 'POST', body: JSON.stringify(data) }),
  deleteHesap: (id) => fetchAPI(`/hesaplar/${id}`, { method: 'DELETE' }),
  getHesapBakiye: (id) => fetchAPI(`/hesaplar/${id}/bakiye`),

  // Özet
  getOzet: () => fetchAPI('/ozet'),

  // Hareketler
  getHareketler: (hesapId, params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/hesaplar/${hesapId}/hareketler${qs ? '?' + qs : ''}`);
  },
  getTumHareketler: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/tum-hareketler${qs ? '?' + qs : ''}`);
  },
  addHareket: (hesapId, data) => fetchAPI(`/hesaplar/${hesapId}/hareketler`, {
    method: 'POST', body: JSON.stringify(data)
  }),
  deleteHareket: (id) => fetchAPI(`/hareketler/${id}`, { method: 'DELETE' }),

  // Raporlar
  createRapor: (data) => fetchAPI('/raporlar/olustur', { method: 'POST', body: JSON.stringify(data) }),
  getDetayliRapor: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchAPI(`/raporlar/detayli${qs ? '?' + qs : ''}`);
  },

  // Upload
  uploadPDF: (hesapId, file) => {
    const form = new FormData();
    form.append('dosya', file);
    return fetch(`${API_URL}/pdf-yukle?hesap_id=${hesapId}`, {
      method: 'POST',
      body: form,
    }).then(r => r.json());
  },
  uploadExcel: (hesapId, file) => {
    const form = new FormData();
    form.append('dosya', file);
    return fetch(`${API_URL}/excel-yukle?hesap_id=${hesapId}`, {
      method: 'POST',
      body: form,
    }).then(r => r.json());
  },

  // Rehber
  getRehber: () => fetchAPI('/rehber'),
  addRehber: (data) => fetchAPI('/rehber', { method: 'POST', body: JSON.stringify(data) }),
  sendRapor: (raporId, data) => fetchAPI(`/raporlar/${raporId}/gonder`, { method: 'POST', body: JSON.stringify(data) }),

  // Health
  health: () => fetchAPI('/health'),
};

export default api;
