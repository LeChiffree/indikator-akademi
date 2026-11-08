// ==========================================================================
// Kategoriler — sıralama, isim, renk ve ikon eşleşmeleri
// ==========================================================================

export const CATEGORIES = [
  {
    id: 'trend',
    name: 'Trend',
    tagline: 'Yön ve Güç',
    desc: 'Fiyatın yönünü ve trendin gücünü gösterenler',
    accent: '#d9b45b',
    icon: 'trend',
  },
  {
    id: 'momentum',
    name: 'Hız (Momentum)',
    tagline: 'İvme',
    desc: 'Alıcı-satıcı ivmesini ve hızını ölçenler',
    accent: '#e8a33d',
    icon: 'bolt',
  },
  {
    id: 'hacim',
    name: 'Hacim',
    tagline: 'Para Akışı',
    desc: 'Paranın nereye aktığını gösterenler',
    accent: '#e6c87a',
    icon: 'bars',
  },
  {
    id: 'volatilite',
    name: 'Volatilite',
    tagline: 'Oynaklık',
    desc: 'Risk ve oynaklığı ölçenler',
    accent: '#c77b4a',
    icon: 'waves',
  },
  {
    id: 'yapi',
    name: 'Piyasa Yapısı',
    tagline: 'Formasyon',
    desc: 'Destek, formasyon ve fiyat yapısı araçları',
    accent: '#b8c0cc',
    icon: 'grid',
  },
];

export const getCategory = (id) => CATEGORIES.find((c) => c.id === id) || null;
