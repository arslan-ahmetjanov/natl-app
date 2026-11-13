/**
 * Пять миров NATL IDE.
 *
 * Каждый бренд — это не только палитра, но и характер: шрифт, радиус,
 * плотность, эффекты поверхностей. Переключение мгновенное, выбор хранится
 * в localStorage.
 */

export const BRANDS = [
  {
    id: 'range',
    name: 'Полигон',
    tagline: 'испытательный стенд',
    hint: 'графит и сигнальный оранжевый, трафаретные подписи',
    swatch: ['#1C1F24', '#FF6B1A'],
  },
  {
    id: 'preflight',
    name: 'Предполётный',
    tagline: 'чек-лист перед вылетом',
    hint: 'тёмно-синий и янтарь, GO / NO-GO',
    swatch: ['#0B1D2A', '#FFB020'],
  },
  {
    id: 'phosphor',
    name: 'Фосфор',
    tagline: 'терминал восьмидесятых',
    hint: 'зелёный фосфор, моноширинный, сканлайны',
    swatch: ['#060807', '#39FF88'],
  },
  {
    id: 'glitch',
    name: 'Глитч',
    tagline: 'сбой как артефакт',
    hint: 'магента и циан, острые углы',
    swatch: ['#0A0A0F', '#FF2E88'],
  },
  {
    id: 'lab',
    name: 'Лаборатория',
    tagline: 'протокол испытаний',
    hint: 'бумага и чернила, штампы, печатный вид',
    swatch: ['#F4F1EA', '#B3392E'],
  },
];

const FONTS = {
  sans: '"IBM Plex Sans", "Segoe UI", system-ui, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace',
  serif: 'Georgia, "Times New Roman", serif',
};

export const PALETTES = {
  range: {
    dark: {
      primary: '#FF6B1A', primaryDark: '#D9530A', secondary: '#FFB020',
      bg: '#16181C', paper: '#1C1F24', text: '#F2F3F5', muted: '#9AA1AC',
      divider: '#2C3037', success: '#5BD68A', warning: '#FFB020', error: '#FF4D4D',
      radius: 6, body: FONTS.sans, heading: FONTS.sans, mono: FONTS.mono, uppercaseLabels: true,
    },
    light: {
      primary: '#E2580A', primaryDark: '#B94708', secondary: '#B77A00',
      bg: '#F2F3F5', paper: '#FFFFFF', text: '#16181C', muted: '#5A626E',
      divider: '#E1E3E7', success: '#1F8A4C', warning: '#B77A00', error: '#C62828',
      radius: 6, body: FONTS.sans, heading: FONTS.sans, mono: FONTS.mono, uppercaseLabels: true,
    },
  },
  preflight: {
    dark: {
      primary: '#FFB020', primaryDark: '#D18C0A', secondary: '#7FD1E8',
      bg: '#0B1D2A', paper: '#102A3A', text: '#E8F1F5', muted: '#8FB0C0',
      divider: '#1D4155', success: '#4FD1A5', warning: '#FFB020', error: '#FF6B6B',
      radius: 8, body: FONTS.sans, heading: FONTS.sans, mono: FONTS.mono, uppercaseLabels: true,
    },
    light: {
      primary: '#B77A00', primaryDark: '#8F5F00', secondary: '#1C6B85',
      bg: '#EEF4F7', paper: '#FFFFFF', text: '#0B1D2A', muted: '#4E6B7A',
      divider: '#D3E1E8', success: '#157F5B', warning: '#B77A00', error: '#C0392B',
      radius: 8, body: FONTS.sans, heading: FONTS.sans, mono: FONTS.mono, uppercaseLabels: true,
    },
  },
  phosphor: {
    dark: {
      primary: '#39FF88', primaryDark: '#1FCC66', secondary: '#7CFFB2',
      bg: '#060807', paper: '#0B0F0C', text: '#CFFADD', muted: '#6F9E80',
      divider: '#14301F', success: '#39FF88', warning: '#E8FF6B', error: '#FF5C7A',
      radius: 2, body: FONTS.mono, heading: FONTS.mono, mono: FONTS.mono, uppercaseLabels: true,
    },
    light: {
      primary: '#12703C', primaryDark: '#0C5229', secondary: '#2F7F52',
      bg: '#DDEBE0', paper: '#E9F5EC', text: '#0B1F12', muted: '#41664F',
      divider: '#C3D8C9', success: '#12703C', warning: '#7A6A00', error: '#A8233C',
      radius: 2, body: FONTS.mono, heading: FONTS.mono, mono: FONTS.mono, uppercaseLabels: true,
    },
  },
  glitch: {
    dark: {
      primary: '#FF2E88', primaryDark: '#C81D6B', secondary: '#22D3EE',
      bg: '#0A0A0F', paper: '#121218', text: '#F4F4F8', muted: '#9C9CB0',
      divider: '#24242E', success: '#22D3EE', warning: '#FFB020', error: '#FF2E88',
      radius: 0, body: FONTS.sans, heading: FONTS.sans, mono: FONTS.mono, uppercaseLabels: true,
    },
    light: {
      primary: '#C81D6B', primaryDark: '#9C1552', secondary: '#0E8FA8',
      bg: '#F6F4F8', paper: '#FFFFFF', text: '#14121A', muted: '#5B5868',
      divider: '#E4E0EA', success: '#0E8FA8', warning: '#A86A00', error: '#C81D6B',
      radius: 0, body: FONTS.sans, heading: FONTS.sans, mono: FONTS.mono, uppercaseLabels: true,
    },
  },
  lab: {
    light: {
      primary: '#B3392E', primaryDark: '#8E2A21', secondary: '#1B2A41',
      bg: '#F4F1EA', paper: '#FFFFFF', text: '#1B2A41', muted: '#5D6B80',
      divider: '#DDD6C8', success: '#2F6B4F', warning: '#8A6A00', error: '#B3392E',
      radius: 4, body: FONTS.sans, heading: FONTS.serif, mono: FONTS.mono, uppercaseLabels: false,
    },
    dark: {
      primary: '#E0574A', primaryDark: '#B3392E', secondary: '#C7D0DE',
      bg: '#14171D', paper: '#1C2027', text: '#EDEAE2', muted: '#A19C90',
      divider: '#2C313A', success: '#5FBF8F', warning: '#D8B24A', error: '#E0574A',
      radius: 4, body: FONTS.sans, heading: FONTS.serif, mono: FONTS.mono, uppercaseLabels: false,
    },
  },
};

/** Бренд по умолчанию — Полигон. */
export const DEFAULT_BRAND = 'range';

export function brandById(id) {
  return BRANDS.find((brand) => brand.id === id) || BRANDS[0];
}

export function paletteFor(brandId, mode) {
  const brand = PALETTES[brandId] || PALETTES[DEFAULT_BRAND];
  return brand[mode] || brand.dark;
}
