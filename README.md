<div align="center">

# 🚄 Maglev Validator

**A specialized developer toolkit for OneBusAway API parity testing and GTFS-Realtime debugging**

[![SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)](https://kit.svelte.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

[Features](#features) • [Getting Started](#getting-started) • [Usage](#usage) • [Tech Stack](#tech-stack)

</div>

---

## Overview

**Maglev Validator** is a clean, modern web application designed to streamline OneBusAway API development and testing workflows. Whether you're migrating servers, debugging discrepancies, or monitoring real-time transit feeds, this tool makes the process effortless.

### Two Powerful Tools in One

| **API Comparator**                                                | **GTFS-Realtime Reader**                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------ |
| Compare API responses between two OneBusAway servers side-by-side | Decode and inspect GTFS-Realtime Protocol Buffer feeds       |
| Visual diff highlighting with color-coded changes                 | Support for Trip Updates, Vehicle Positions & Service Alerts |
| Auto-refresh for continuous monitoring                            | Human-readable JSON visualization                            |
| Configurable key ignoring for flexible comparisons                | Custom header support for authenticated feeds                |

---

## Features

### API Comparator

- **Real-time Comparison**: Fetch and compare API responses from two different OneBusAway servers simultaneously
- **Visual Diff Highlighting**: Instantly spot differences with intuitive color-coding
  - 🟡 **Yellow** — Different values
  - 🔴 **Red** — Missing in Server 2
  - 🟢 **Green** — Added in Server 2
- **Auto-refresh**: Configurable intervals (1-60 seconds) for continuous monitoring
- **Smart Key Ignoring**: Exclude dynamic fields (like timestamps) from comparisons
- **All Endpoints Supported**: Pre-configured support for all major OneBusAway REST API endpoints
- **Path Focus**: Zoom into specific JSON paths for detailed analysis

### GTFS-Realtime Protobuf Reader

- **Protocol Buffer Decoding**: Automatically decode binary GTFS-RT feeds into readable JSON
- **Multi-Feed Support**: Fetch Trip Updates, Vehicle Positions, and Service Alerts simultaneously
- **Custom Headers**: Add authentication headers for protected feeds
- **Auto-Refresh**: Monitor feeds with configurable refresh intervals
- **Collapsible Tree View**: Navigate complex nested data structures with ease
- **Copy to Clipboard**: Quickly copy decoded JSON data for further analysis

### User Experience

- **Dark Mode**: Easy on the eyes with full dark theme support
- **Persistent Settings**: Your configuration is saved locally
- **Responsive Design**: Works seamlessly on desktop and tablet
- **Modern UI**: Clean, minimalist interface built with Tailwind CSS

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **pnpm** (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/OneBusAway/maglev-validator.git
cd maglev-validator

# Install dependencies
pnpm install
```

### Development

```bash
# Start the development server
pnpm run dev

# Or open in browser automatically
pnpm run dev -- --open
```

The app will be available at `http://localhost:5173`

### Linting & Formatting

```bash
# Run the linter
pnpm run lint

# Format code (fixes formatting issues and organizes imports)
pnpm run format
```

---

## Usage

### API Comparator

1. **Configure Servers**: Enter your two server base URLs
   - Server 1: `http://localhost:4000/api/where/`
   - Server 2: `https://your-production-server.com/api/where/`

2. **Select Endpoint**: Choose from pre-configured OneBusAway API endpoints
   - Trip Details, Stops for Route, Arrivals and Departures, and more...

3. **Enter Parameters**: Fill in required parameters (Trip ID, Stop ID, API Key, etc.)

4. **Fetch & Compare**: Click "Fetch Now" or enable "Auto-refresh" for continuous monitoring

5. **Analyze Differences**: Review the color-coded side-by-side comparison

### GTFS-Realtime Reader

1. **Enter Feed URLs**: Provide URLs for your GTFS-RT feeds
   - Trip Updates, Vehicle Positions, Service Alerts

2. **Add Headers** (optional): Configure authentication headers if required

3. **Fetch Feeds**: Click "Fetch Now" to decode and display the feeds

4. **Explore Data**: Navigate the collapsible JSON tree to inspect entities

---

## Tech Stack

| Technology                                                                           | Purpose                   |
| ------------------------------------------------------------------------------------ | ------------------------- |
| **[SvelteKit](https://kit.svelte.dev/)**                                             | Full-stack web framework  |
| **[Svelte 5 Runes](https://svelte.dev/)**                                            | Reactive state management |
| **[TypeScript](https://www.typescriptlang.org/)**                                    | Type safety               |
| **[Tailwind CSS](https://tailwindcss.com/)**                                         | Utility-first styling     |
| **[gtfs-realtime-bindings](https://github.com/MobilityData/gtfs-realtime-bindings)** | GTFS-RT Protobuf parsing  |

---

## Building for Production

```bash
# Create production build
pnpm run build

# Preview production build
pnpm run preview
```

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## License

This project is licensed under the [MIT License](LICENSE).

Part of the [OneBusAway](https://onebusaway.org/) open-source transit platform.

---

<div align="center">

**Made for the transit community**

[OneBusAway](https://onebusaway.org/) • [GitHub](https://github.com/OneBusAway)

</div>
