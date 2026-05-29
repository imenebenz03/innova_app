// INNOVA — Thème couleurs (rouge INNOVIM + blanc)

export const Colors = {
  // Rouge principal (extrait du logo)
  primary:        '#C41E1E',
  primaryDark:    '#A01515',
  primaryDeep:    '#7A0F0F',
  primaryLight:   '#E53E3E',
  primaryFaint:   '#FFF0F0',
  primarySoft:    '#FFE0E0',

  // Blanc & neutres
  white:          '#FFFFFF',
  background:     '#F7F7F7',
  surface:        '#FFFFFF',
  surfaceGray:    '#F2F2F2',
  border:         '#E8E8E8',
  borderLight:    '#F0F0F0',

  // Texte
  textPrimary:    '#1A1A1A',
  textSecondary:  '#666666',
  textTertiary:   '#999999',
  textOnRed:      '#FFFFFF',

  // Sémantiques
  success:        '#1D9E75',
  successLight:   '#E8F8F2',
  warning:        '#D4860F',
  warningLight:   '#FFF4E0',
  danger:         '#C41E1E',
  dangerLight:    '#FFF0F0',
  info:           '#1A6BB5',
  infoLight:      '#E8F0FA',

  // Ombre
  shadow:         'rgba(0,0,0,0.10)',
  shadowStrong:   'rgba(196,30,30,0.20)',
}

export const Fonts = {
  light:    '300',
  regular:  '400',
  medium:   '500',
  semibold: '600',
  bold:     '700',
}

export const Radius = {
  sm:   8,
  md:   12,
  lg:   18,
  xl:   24,
  full: 999,
}

export const Shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  strong: {
    shadowColor: '#C41E1E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
}
