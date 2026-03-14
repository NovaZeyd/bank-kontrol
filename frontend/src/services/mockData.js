// Demo data for GitHub Pages static deployment (no backend needed)

const DEMO_HESAPLAR = [
  { id: 1, sirket_adi: 'Ruzi HP MMC', banka_adi: 'TuranBank', iban: 'AZ84TURA00000000000012345', valyuta: 'AZN', voen: '3102780631', acilis_bakiye: 15420.50, kapanis_bakiye: 28750.30 },
  { id: 2, sirket_adi: 'Ruzi HP MMC', banka_adi: 'AIIB', iban: 'AZ31AIIB00000000000067890', valyuta: 'AZN', voen: '3102780631', acilis_bakiye: 8200.00, kapanis_bakiye: 12340.75 },
  { id: 3, sirket_adi: 'Nova Trade LLC', banka_adi: 'Kapital Bank', iban: 'AZ59KAPI00000000000099887', valyuta: 'USD', voen: '1405890234', acilis_bakiye: 5000.00, kapanis_bakiye: 7820.50 },
]

const today = new Date()
const fmt = (d) => d.toISOString()

function randomDate(daysBack) {
  const d = new Date(today)
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack))
  d.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60))
  return d
}

const TEYINATLAR = [
  'İcarə haqqı ödənişi', 'Maaş ödənişi - Mart', 'ƏDV ödənişi', 'Ofis ləvazimatları',
  'Müqavilə üzrə ödəniş №1247', 'Kommunal xidmət haqqı', 'İnternet Banking köçürmə',
  'AniPay transfer', 'Xidmət haqqı', 'Konvertasiya komissiyası',
  'Mal alışı - Faktura #892', 'Nəqliyyat xərci', 'Sığorta ödənişi',
  'Müştəri ödənişi - Faktura #1105', 'Layihə üçün avans', 'Məsləhət xidməti haqqı',
  'Təmir-tikinti işləri', 'Reklam xərci', 'Bank komissiyası', 'Dividend ödənişi',
]

const ACS_HESABLAR = [
  'Kapital Bank ASC', 'SOCAR Trading', 'Azərenerji ASC', 'Bakı Metropoliteni',
  'AzərSu ASC', 'Bakcell MMC', 'Azercell Telekom', 'NAFA İnvest',
  'Cater Group MMC', 'Unitel MMC', 'Delta Logistik', 'Mega Təchizat',
  'Smart Solutions LLC', 'Green Energy Co', 'Atlas Group MMC',
]

// 120 demo transaction generate et
const DEMO_HAREKETLER = Array.from({ length: 120 }, (_, i) => {
  const isMedaxil = Math.random() > 0.45
  const mebleg = isMedaxil
    ? +(Math.random() * 8000 + 200).toFixed(2)
    : -(Math.random() * 5000 + 100).toFixed(2)
  const tarixi = randomDate(180)
  return {
    id: i + 1,
    hesap_id: DEMO_HESAPLAR[Math.floor(Math.random() * DEMO_HESAPLAR.length)].id,
    tarixi: fmt(tarixi),
    islem_turu: isMedaxil ? 'medaxil' : 'mexaric',
    mebleg: Math.abs(mebleg),
    valyuta: 'AZN',
    bakiye: +(Math.random() * 30000 + 5000).toFixed(2),
    teyinat: TEYINATLAR[Math.floor(Math.random() * TEYINATLAR.length)],
    acs_hesap: ACS_HESABLAR[Math.floor(Math.random() * ACS_HESABLAR.length)],
    sened_no: `SN-${String(1000 + i).padStart(5, '0')}`,
    kategori: null,
    kaynak_dosya: Math.random() > 0.5 ? 'ekstre_mart_2026.xlsx' : null,
  }
}).sort((a, b) => new Date(b.tarixi) - new Date(a.tarixi))

// Bugünkü hərəkətlər
const bugun = today.toISOString().slice(0, 10)
const BUGUNKI = DEMO_HAREKETLER.filter(h => h.tarixi.slice(0, 10) === bugun)
// Əgər bugünkü yoxdursa, son 5-i bugün kimi göstər
const gunlukHareketler = BUGUNKI.length > 0 ? BUGUNKI : DEMO_HAREKETLER.slice(0, 8).map(h => ({
  ...h, tarixi: fmt(today)
}))

const DEMO_REHBER = [
  { id: 1, ad_soyad: 'Əli Həsənov', email: 'ali.hasanov@ruzi.az', telefon: '+994501234567', pozisya: 'Maliyyə Meneceri', aktif: true, varsayilan: true },
  { id: 2, ad_soyad: 'Leyla Məmmədova', email: 'leyla.m@ruzi.az', telefon: '+994557654321', pozisya: 'Baş Mühasib', aktif: true, varsayilan: true },
  { id: 3, ad_soyad: 'Rəşad Quliyev', email: 'rashad@novatrade.az', telefon: '+994709876543', pozisya: 'Direktor', aktif: true, varsayilan: false },
]

function groupBy(hareketler, raporTuru) {
  const gruplar = {}
  for (const h of hareketler) {
    let key
    const d = new Date(h.tarixi)
    if (raporTuru === 'gunluk') key = d.toISOString().slice(0, 10)
    else if (raporTuru === 'aylik') key = d.toISOString().slice(0, 7)
    else key = String(d.getFullYear())

    if (!gruplar[key]) gruplar[key] = { donem: key, medaxil: 0, mexaric: 0, sayi: 0, hareketler: [] }
    if (h.islem_turu === 'medaxil') gruplar[key].medaxil += h.mebleg
    else gruplar[key].mexaric += h.mebleg
    gruplar[key].sayi++
    gruplar[key].hareketler.push(h)
  }
  return Object.values(gruplar).sort((a, b) => b.donem.localeCompare(a.donem))
}

function kategoriler(hareketler) {
  const map = {}
  for (const h of hareketler) {
    const k = h.acs_hesap || 'Digər'
    if (!map[k]) map[k] = { ad: k, medaxil: 0, mexaric: 0, sayi: 0 }
    if (h.islem_turu === 'medaxil') map[k].medaxil += h.mebleg
    else map[k].mexaric += h.mebleg
    map[k].sayi++
  }
  return Object.values(map).sort((a, b) => b.mexaric - a.mexaric)
}

export const mockApi = {
  getHesaplar: async () => [...DEMO_HESAPLAR],
  getHesap: async (id) => DEMO_HESAPLAR.find(h => h.id === Number(id)),
  createHesap: async (data) => ({ ...data, id: DEMO_HESAPLAR.length + 1 }),
  deleteHesap: async () => ({ message: 'Hesab deaktiv edildi' }),
  getHesapBakiye: async (id) => {
    const h = DEMO_HESAPLAR.find(x => x.id === Number(id))
    return { hesap_id: id, ...h, toplam_medaxil: 45200, toplam_mexaric: 31870, net_qaliq: 13330, son_bakiye: h?.kapanis_bakiye || 0, toplam_emeliyyat: 42 }
  },

  getOzet: async () => {
    const medaxil = gunlukHareketler.filter(h => h.islem_turu === 'medaxil').reduce((s, h) => s + h.mebleg, 0)
    const mexaric = gunlukHareketler.filter(h => h.islem_turu === 'mexaric').reduce((s, h) => s + h.mebleg, 0)
    return {
      toplam_medaxil: medaxil,
      toplam_mexaric: mexaric,
      cari_qaliq: 28750.30,
      gunluk_hareketler: gunlukHareketler,
    }
  },

  getHareketler: async (hesapId) => DEMO_HAREKETLER.filter(h => h.hesap_id === Number(hesapId)),
  getTumHareketler: async (params = {}) => {
    let filtered = [...DEMO_HAREKETLER]
    if (params.baslangic) filtered = filtered.filter(h => h.tarixi >= params.baslangic)
    if (params.bitis) filtered = filtered.filter(h => h.tarixi <= params.bitis + 'T23:59:59')
    if (params.islem_turu) filtered = filtered.filter(h => h.islem_turu === params.islem_turu)
    if (params.arama) {
      const q = params.arama.toLowerCase()
      filtered = filtered.filter(h => (h.teyinat || '').toLowerCase().includes(q) || (h.acs_hesap || '').toLowerCase().includes(q))
    }
    const offset = Number(params.offset) || 0
    const limit = Number(params.limit) || 25
    return { toplam: filtered.length, hareketler: filtered.slice(offset, offset + limit) }
  },
  addHareket: async () => ({ id: 999 }),
  deleteHareket: async () => ({ message: 'Silindi' }),

  createRapor: async () => ({ rapor_id: 1, dosya: 'rapor.xlsx', medaxil: 45200, mexaric: 31870, qaliq: 13330 }),
  getDetayliRapor: async (params = {}) => {
    const turu = params.rapor_turu || 'aylik'
    let filtered = [...DEMO_HAREKETLER]
    if (params.hesap_id) filtered = filtered.filter(h => h.hesap_id === Number(params.hesap_id))
    if (params.baslangic) filtered = filtered.filter(h => h.tarixi >= params.baslangic)
    if (params.bitis) filtered = filtered.filter(h => h.tarixi <= params.bitis + 'T23:59:59')
    const donemler = groupBy(filtered, turu)
    const kats = kategoriler(filtered)
    const tm = donemler.reduce((s, d) => s + d.medaxil, 0)
    const tx = donemler.reduce((s, d) => s + d.mexaric, 0)
    return {
      rapor_turu: turu, toplam_medaxil: tm, toplam_mexaric: tx, fark: tm - tx,
      toplam_emeliyyat: filtered.length, donemler, kategoriler: kats,
    }
  },

  uploadPDF: async () => ({ message: '12 hərəkət əlavə edildi (demo)', bank_type: 'turanbank', toplam_medaxil: 15000, toplam_mexaric: 8500 }),
  uploadExcel: async () => ({ message: '18 hərəkət əlavə edildi (demo)', toplam_setir: 20, eklenen: 18, fayl_adi: 'demo.xlsx' }),

  getRehber: async () => [...DEMO_REHBER],
  addRehber: async (data) => ({ ...data, id: DEMO_REHBER.length + 1 }),
  sendRapor: async () => ({ message: '2 şəxsə göndərildi', kanal: 'email' }),

  health: async () => ({ status: 'ok', service: 'bank-kontrol-demo', version: '1.0.0' }),
}
