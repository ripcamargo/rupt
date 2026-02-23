# Rupt - Lightweight Task Timer

A minimal, real-time task timer for tracking daily work interruptions. Built with React, Vite, and modern hooks.

## Features

✨ **Two-Step Task Creation** - Enter description, then requester name  
⏱️ **Real-time Timer** - Live second-by-second duration tracking  
🔄 **Auto-Pause** - Switching tasks automatically pauses the previous one  
📅 **Group by Date** - Tasks organized in collapsible daily groups  
🚨 **Urgent Marking** - Flag critical tasks that appear at the top (red indicator)  
🔄 **Reopen Tasks** - Reactivate completed tasks if needed  
⚙️ **Smart Rounding** - Auto-round completed task durations (configurable)  
📥 **Log Export** - Download daily or complete activity logs as text files  
💾 **Local Persistence** - All data saved in browser LocalStorage  
🌙 **Dark Theme** - Minimal, clean UI optimized for focus  
📱 **Responsive** - Works great on desktop and mobile  
⌨️ **Keyboard Friendly** - Fast interactions, minimal clicking  

## Quick Start

### Installation
```bash
npm install
npm run dev
```

App runs at `http://localhost:5173/`

## How to Use

### Creating Tasks
1. Type the **task description** and press **Enter** 
2. The input changes to request the **requester name**
3. Type the name and press **Enter** or click **Criar**
4. Task starts automatically and is added to today's group
5. Input returns to description step for next task

### Managing Tasks
- **Start/Resume**: Click "Iniciar" to resume a paused task
  - Current running task pauses automatically
- **Pause**: Click "Pausar" on the running task
- **Mark Urgent**: Click "🚨" button to flag critical tasks
  - Urgent tasks show at the top of each day
  - Display red border and glow effect
- **Complete**: Click "Concluído" to mark task complete
  - Duration is auto-rounded based on settings (default: rounded up to nearest 10 minutes)
  - Appears faded with strikethrough
- **Reopen**: Click "Reabrir" on completed tasks
  - Returns task to paused state for tracking

### Settings ⚙️
Click the gear icon (⚙️) next to "Hoje:" to access settings:

**Arredondar Períodos:**
- **Para Cima** (default): Round completed task durations up
  - Set step size (default: 10 minutes)
  - Example: 8 minutes → 10 min, 2h34min → 2h40min
- **Para Baixo**: Round down to nearest step
  - Set step size (default: 10 minutes)
- **Não Arredondar**: No rounding applied

**Exportar Dados:**
- Download complete activity log as .txt file

### Viewing Progress
- **Today Total**: Shows cumulative time at top right
- **Daily Groups**: Each day is collapsible
  - Shows date and total hours worked
  - Click to expand/collapse
  - Today group expanded by default
  - **Download Log** (📥): Export that day's activities as .txt
- **Task Details**: Each task card shows:
  - Start time (HH:MM format)
  - Requester name (if provided)
  - Current duration
- **Urgent Tasks**: Appear first in each day group with red styling

## Project Structure

```
src/
├── components/
│   ├── TaskItem.jsx           # Individual task with controls
│   ├── DayGroup.jsx           # Daily group accordion with log download
│   └── SettingsModal.jsx      # Settings popup dialog
├── hooks/
│   └── useTimer.js            # Custom timer logic
├── utils/
│   ├── storage.js             # LocalStorage helpers
│   ├── timeFormatter.js       # Time formatting utilities
│   ├── dateGrouping.js        # Date grouping logic
│   ├── settings.js            # Settings persistence
│   ├── rounding.js            # Duration rounding logic
│   └── logExporter.js         # Activity log generation and download
├── styles/
│   ├── TaskItem.css           # Task item styles
│   ├── DayGroup.css           # Daily group styles
│   ├── SettingsModal.css      # Settings modal styles
│   └── (global in App.css & index.css)
├── App.jsx                    # Main state manager
├── App.css                    # App layout styles
├── main.jsx                   # React entry point
└── index.css                  # Global styles
```

## Task Data Structure

Each task stores:
```javascript
{
  id: Number,                    // Unique timestamp
  description: String,           // Task description
  requester: String,             // Name of person requesting the task
  createdAt: String,            // ISO timestamp (used for grouping)
  startedAt: String,            // Last start time
  totalDurationSeconds: Number, // Cumulative seconds (auto-rounded on complete)
  status: String,               // 'running' | 'paused' | 'completed'
  isUrgent: Boolean             // Task marked as urgent
}
```

## Features in Detail

### Two-Step Task Creation
- Step 1: Enter task description and press Enter
- Step 2: Enter requester name and press Enter (or click "Criar" button)
- Task immediately starts running
- Input field auto-focuses for next task

### Daily Groups
- Tasks automatically grouped by creation date
- Each group shows total time for that day
- Click group header to expand/collapse
- Today's group expanded by default
- Groups ordered newest first
- Download button (📥) exports day's activities as .txt file

### Urgent Marking
- Click 🚨 icon to toggle urgent status
- Urgent tasks sorted to top of each day
- Visual indicators:
  - Red border (#d93f3f)
  - 🚨 badge next to description
  - Button highlights in red when active

### Settings & Configuration
- Access via gear icon (⚙️) in header
- **Rounding Options:**
  - Para Cima: Rounds up to nearest step on task completion
  - Para Baixo: Rounds down to nearest step
  - Não Arredondar: No rounding applied
  - Configurable step size (1-60 minutes, default: 10)
- **Log Export:**
  - Download complete activity history
  - Includes all tasks from all dates
  - Formatted .txt file with timestamps and durations

### Activity Log Export
- **Daily Log**: Click 📥 on day group header
- **Complete Log**: Access via Settings modal
- **Format**: Plain text (.txt) with:
  - Date and time of generation
  - Task descriptions and requesters
  - Start times (HH:MM)
  - Durations (formatted)
  - Status and urgent flags
  - Daily totals

### Storage
- **Format**: JSON in `localStorage['rupt_tasks']` and `localStorage['rupt_settings']`
- **Daily Reset**: Old tasks cleared on new calendar day (in rupt_date key)
- **Auto-save**: Saves after every change
- **Persistence**: Data survives page reload
- **Settings Saved**: Rounding preferences persist across sessions

## Build & Deploy

### Development
```bash
npm run dev
```

### Production Build
```bash
npm run build      # Creates optimized dist/
npm run preview    # Preview production build
```

## Technologies

- **React** 18+ (hooks only, no Redux)
- **Vite** for build tooling
- **JavaScript** (no TypeScript)
- **CSS3** with media queries
- **LocalStorage API** for persistence

## UI Components

### TaskItem
- Shows description, start time, requester, and duration
- Displays urgent badge (🚨) if marked
- Control buttons: Iniciar/Pausar, 🚨 toggle, Concluído
- Visual states:
  - **Running**: Turquoise border + highlight
  - **Urgent**: Red border + badge
  - **Completed**: Strikethrough, faded, with "Reabrir" option

### DayGroup
- Header with date, day name, and total time
- Download button (📥) for exporting day's log
- Collapsible arrow indicator
- Auto-expands today's group
- Smooth expand/collapse animation

### SettingsModal
- Popup dialog with configuration options
- Rounding mode selection (radio buttons)
- Step size input (appears when "Para Cima" or "Para Baixo" selected)
- Export complete log button
- Save/Cancel actions

## Color Palette

- **Background**: #1a1a1a
- **Surface**: #2a2a2a
- **Primary (Running)**: #4adeb9 (turquoise)
- **Urgent**: #d93f3f (red)
- **Pause**: #fbbf24 (yellow)
- **Complete**: #4ab2de (blue)
- **Text**: #e5e5e5

## Performance

- Single timer interval for all tasks
- Minimal re-renders with React hooks
- LocalStorage for instant persistence
- No external UI frameworks
- Optimized CSS with smooth transitions

## Browser Compatibility

- Modern browsers with ES6+
- React 18+
- LocalStorage API
- CSS Grid/Flexbox

## Keyboard Shortcuts

- **Enter**: Create and start new task
- **Tab**: Navigate buttons
- **Focus**: Auto-focused input on load

## Future Enhancements

- Keyboard navigation (arrows, numbers)
- Task editing capability
- Daily/weekly statistics
- Export data (CSV/JSON)
- Categories/tags
- Restore completed tasks
- Time estimation
- Break/rest timer

## License

MIT

