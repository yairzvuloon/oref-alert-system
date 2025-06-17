# 🚨 Oref Alert System

A real-time alert monitoring system for Israeli Red Alert (Pikud-Ha-Oref) notifications with customizable audio alerts and live tracking.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/node.js-18%2B-green.svg)
![Status](https://img.shields.io/badge/status-active-success.svg)

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Audio System](#audio-system)
- [File Structure](#file-structure)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## 🎯 Overview

The Oref Alert System is a web-based application that monitors Israeli Red Alert notifications in real-time. It provides customizable audio alerts, visual notifications, and comprehensive alert history tracking for specific cities or nationwide alerts.

**Key Capabilities:**
- Real-time alert monitoring for any Israeli city
- Category-specific audio notifications with different durations
- Dark/light theme support
- Comprehensive alert history filtering
- Responsive design for desktop and mobile

## ✨ Features

### 🔔 Alert Monitoring
- **Real-time Updates**: Polls every 30 seconds for new alerts
- **City-Specific**: Monitor alerts for any Israeli city
- **Nationwide Coverage**: Includes country-wide alerts
- **Smart Polling**: Pauses during sound playback to prevent interruptions

### 🎵 Audio System
- **Category-Specific Sounds**: Different audio files for each alert type
- **Variable Duration**: 
  - Update alerts: 5 seconds
  - Missiles/Hostile Aircraft/Flash: 30 seconds
- **Sound Testing**: Test all alert sounds via dropdown menu
- **Manual Control**: Stop sounds manually at any time

### 📊 Alert Categories
| Category | Icon | Duration | Description |
|----------|------|----------|-------------|
| Missiles | 🚀 | 30s | Missile attack alerts |
| Hostile Aircraft | ✈️ | 30s | Aircraft intrusion alerts |
| Flash | ⚡ | 30s | Emergency flash alerts |
| Update | 📢 | 5s | General updates |

### 🎨 User Interface
- **Modern Design**: Clean, responsive interface
- **Dark Mode**: Toggle between light and dark themes
- **Live Status**: Real-time connection indicator
- **Sortable History**: Sort alerts by time (ascending/descending)
- **Category Filtering**: Show/hide specific alert types

## 🚀 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn package manager

### Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/oref-alert-system.git
   cd oref-alert-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Verify audio files**
   Ensure the audio files are present in the correct location:
   ```
   public/audio/
   ├── missiles.mp3
   ├── hostileAircraft.mp3
   ├── flash.mp3
   └── update.mp3
   ```

4. **Start the server**
   ```bash
   npm start
   # or
   node server/server.mjs
   ```

5. **Open in browser**
   ```
   http://localhost:3000
   ```

## 📖 Usage

### Basic Operation

1. **Set Your City**: Enter your city name in the "City" field
2. **Configure Refresh**: Set polling interval (default: 30 seconds)
3. **Set Alert Range**: Configure how long alerts stay "fresh" (default: 30 seconds)
4. **Choose History Period**: Select from last 24 hours, week, or month
5. **Filter Categories**: Use checkboxes to show/hide specific alert types

### Controls

- **⏸️ Pause Updates**: Stop automatic polling
- **🔊 Test Sounds**: Test audio for each alert category
- **⏹️ Stop All Sounds**: Immediately stop any playing audio
- **🌙/☀️ Dark Mode**: Toggle theme
- **Sort ↓/↑**: Change alert ordering

### Alert Display

Alerts show:
- **Time**: When the alert occurred
- **Category**: Type of alert or "Across the country" for nationwide
- **Icon**: Visual indicator for alert type
- **Color Coding**: Category-specific colors

## ⚙️ Configuration

### NPM Scripts

Your `package.json` should include:
```json
{
  "scripts": {
    "start": "node server/server.mjs",
    "dev": "node server/server.mjs"
  }
}
```

### Environment Variables

```bash
PORT=3000                    # Server port (default: 3000)
```

### Audio Configuration

Edit `public/js/script.js` to customize sound settings:

```javascript
// Sound files for each category (relative to public/ directory)
const CATEGORY_SOUNDS = {
  1: "audio/missiles.mp3",
  2: "audio/hostileAircraft.mp3", 
  14: "audio/flash.mp3",
  13: "audio/update.mp3",
};

// Duration for each category (milliseconds)
const CATEGORY_SOUND_DURATIONS = {
  1: 30000,  // Missiles: 30 seconds
  2: 30000,  // Hostile aircraft: 30 seconds
  14: 30000, // Flash: 30 seconds
  13: 5000,  // Update: 5 seconds
};
```

### Polling Settings

Configure in `public/js/script.js`:

```javascript
const MIN_SEC = 5;           // Minimum polling interval
// Default lookback time for "fresh" alerts
let lookBackMs = 30 * 1000;  // 30 seconds
```

## 🔌 API Endpoints

### Health Check
```
GET /api/health
```
Returns server status and timestamp.

### Alert History
```
GET /api/history?city={cityName}&range={period}
```

**Parameters:**
- `city`: City name (default: "Yad Binyamin")
- `range`: Time period - "day", "week", or "month" (default: "day")

**Response:**
```json
[
  {
    "alertDate": "2024-01-15T14:30:00.000Z",
    "category": 1,
    "category_desc": "Missiles"
  }
]
```

## 🎵 Audio System

### Sound Files Required

The audio files are already included in the `public/audio/` directory:

- `audio/missiles.mp3` - Missile alert sound
- `audio/hostileAircraft.mp3` - Aircraft alert sound  
- `audio/flash.mp3` - Flash alert sound
- `audio/update.mp3` - Update notification sound

### Audio Behavior

- **Looping**: All sounds loop during their duration
- **No Overlap**: New sounds stop previous ones
- **Auto-Stop**: Sounds automatically stop after their duration
- **Smart Polling**: System pauses API calls during sound playback
- **Manual Override**: Stop button immediately ends all sounds

## 📁 File Structure

```
oref-alert-system/
├── server/
│   └── server.mjs          # Express server with CORS and API proxy
├── public/
│   ├── index.html          # Main application HTML
│   ├── js/
│   │   └── script.js       # Client-side JavaScript application
│   ├── css/
│   │   └── style.css       # Responsive CSS styling
│   ├── audio/
│   │   ├── flash.mp3       # Flash alert sound
│   │   ├── hostileAircraft.mp3  # Aircraft alert sound
│   │   ├── missiles.mp3    # Missile alert sound
│   │   └── update.mp3      # Update notification sound
│   └── icons/
│       └── favicon.svg     # Site icon
├── .gitignore              # Git ignore rules
├── package.json            # Node.js dependencies and scripts
├── package-lock.json       # Dependency lock file
└── README.md              # This file
```

## 🔧 Troubleshooting

### Common Issues

**🔴 Sounds Not Playing**
- Ensure all MP3 files are in the `public/audio/` directory
- Check browser audio permissions
- Verify file names match exactly (case-sensitive)
- Test with browser dev tools console for error messages

**🔴 No Alerts Showing**
- Verify city name spelling (try "Tel Aviv" or "Jerusalem")
- Check internet connection
- Look for CORS errors in browser console
- Ensure the Oref API is accessible

**🔴 Polling Issues**
- Check if "Pause Updates" is enabled
- Verify refresh interval is reasonable (5+ seconds)
- Monitor browser console for API errors

### Debug Mode

Enable detailed logging by setting:
```javascript
const DEBUG = true; // In public/js/script.js
```

### Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

**Required Features:**
- ES6 Modules
- Fetch API
- Web Audio API
- CSS Grid/Flexbox

## 🤝 Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Code Style

- Use ES6+ JavaScript features
- Follow existing naming conventions
- Add comments for complex logic
- Ensure responsive design principles

### Testing

Before submitting:
- Test all alert categories
- Verify audio playback
- Check responsive design
- Test with different cities

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Pikud-Ha-Oref](https://www.oref.org.il/) for providing the alert API
- Open source audio assets
- Contributors and testers

## 📞 Support

For issues and questions:
- Create an issue on GitHub
- Check existing issues for solutions
- Review troubleshooting guide above

---

**⚠️ Important Note**: This system is for informational purposes. Always follow official emergency protocols and authorities for actual emergency situations.