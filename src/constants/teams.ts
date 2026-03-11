export const TEAM_COLORS: Record<string, string> = {
  'Red Bull Racing': '#3671C6',
  'Red Bull':        '#3671C6',
  'Mercedes':        '#27F4D2',
  'Ferrari':         '#E8002D',
  'McLaren':         '#FF8000',
  'Aston Martin':    '#358C75',
  'Alpine F1 Team':  '#B6BABD',
  'Alpine':          '#B6BABD',
  'Williams':        '#64C4FF',
  'RB F1 Team':      '#356CAC',
  'RB':              '#356CAC',
  'Haas F1 Team':    '#B6BABD',
  'Haas':            '#B6BABD',
  'Kick Sauber':     '#C92D4B',
  'Sauber':          '#C92D4B',
}

export const TEAM_COLORS_FALLBACK = '#888888'

export function getTeamColor(teamName: string): string {
  if (!teamName) return TEAM_COLORS_FALLBACK
  // Exact match
  if (TEAM_COLORS[teamName]) return TEAM_COLORS[teamName]
  // Partial match
  const lower = teamName.toLowerCase()
  for (const [key, color] of Object.entries(TEAM_COLORS)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return color
    }
  }
  return TEAM_COLORS_FALLBACK
}

export const TYRE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  SOFT:       { bg: '#E8002D', text: '#fff', label: 'S' },
  MEDIUM:     { bg: '#FFC906', text: '#000', label: 'M' },
  HARD:       { bg: '#ffffff', text: '#000', label: 'H' },
  INTERMEDIATE: { bg: '#39B54A', text: '#fff', label: 'I' },
  WET:        { bg: '#0067FF', text: '#fff', label: 'W' },
}

export function getTyreColor(compound: string) {
  return TYRE_COLORS[compound?.toUpperCase()] || { bg: '#555', text: '#fff', label: '?' }
}

export const CIRCUIT_FLAGS: Record<string, string> = {
  'Australia': '🇦🇺',
  'China': '🇨🇳',
  'Japan': '🇯🇵',
  'Bahrain': '🇧🇭',
  'Saudi Arabia': '🇸🇦',
  'USA': '🇺🇸',
  'United States': '🇺🇸',
  'Mexico': '🇲🇽',
  'Brazil': '🇧🇷',
  'Italy': '🇮🇹',
  'Monaco': '🇲🇨',
  'Spain': '🇪🇸',
  'Canada': '🇨🇦',
  'Austria': '🇦🇹',
  'Britain': '🇬🇧',
  'Hungary': '🇭🇺',
  'Belgium': '🇧🇪',
  'Netherlands': '🇳🇱',
  'Singapore': '🇸🇬',
  'Azerbaijan': '🇦🇿',
  'Qatar': '🇶🇦',
  'UAE': '🇦🇪',
  'Abu Dhabi': '🇦🇪',
}

export function getCircuitFlag(country: string): string {
  for (const [key, flag] of Object.entries(CIRCUIT_FLAGS)) {
    if (country?.toLowerCase().includes(key.toLowerCase())) return flag
  }
  return '🏁'
}
