# Pitwall

Interactive Formula 1 racing analytics dashboard. Explore race results, qualifying times, driver telemetry, team strategies, and predictions.

## Tech Stack

- **Framework:** Vue 3 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **State Management:** Pinia
- **Routing:** Vue Router
- **Charts:** Chart.js (via vue-chartjs)
- **Backend:** Supabase (for caching and insights)
- **External APIs:** OpenF1, Ergast

## Features

- **Race Results** - View finishing positions, gaps, fastest laps, and stint strategies
- **Qualifying Times** - Compare driver lap times across Q1, Q2, and Q3
- **Telemetry Analysis** - Compare speed and lap times between two drivers
- **Team Standings** - Constructor championship positions and points
- **Driver Profiles** - Driver numbers, nationalities, and team affiliations
- **Race Predictions** - AI-powered race outcome predictions

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Project Structure

```
src/
├── api/           # API clients (OpenF1, Ergast, Supabase)
├── components/     # Reusable Vue components
│   ├── charts/     # Chart components (LapTime, Position, Strategy, etc.)
│   ├── telemetry/  # Telemetry-specific components
│   └── ui/         # Generic UI components
├── composables/    # Vue composables for shared logic
├── stores/        # Pinia stores (race, season)
├── views/          # Page components
└── lib/           # Utility functions
```

## Data Sources

- **OpenF1** - Live F1 data including sessions, laps, and telemetry
- **Ergast** - Historical race and qualifying results
- **Supabase** - Cached data and AI-generated race insights

## License

MIT
