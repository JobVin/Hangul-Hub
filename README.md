# Hangul Hub

A static web application designed for absolute beginners to learn Korean Hangul literacy.

## Status

**Early Scaffolding & Initial Reference Data Phase**
Currently set up with project folder structure and the Part 1 Jamo reference data draft (`data/jamo/part1-jamo.json`). No HTML UI, styling, or application logic has been built yet.

## Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Architecture**: Decoupled JSON data loaded asynchronously via `fetch()`
- **Build Step**: None (No bundlers, no transpilers, no package managers)
- **Target Host**: GitHub Pages

## Local Development Setup

Because data is loaded via `fetch()`, opening `index.html` directly using the `file://` protocol will trigger browser CORS restrictions. Please use a local HTTP server.

### Running a Local Server (PowerShell / Windows)

You can launch a local server using any of the following methods from PowerShell in the project root:

#### Option 1: Python HTTP Server
```powershell
python -m http.server 8000
```
Then visit `http://localhost:8000`.

#### Option 2: Node `serve` package (without installing globally)
```powershell
npx serve .
```

#### Option 3: VS Code Live Server Extension
Open the workspace in VS Code and click **"Go Live"** from the status bar.

### PowerShell Command Equivalents
When inspecting files or searching through code on Windows PowerShell:
- Search text within files: `Select-String -Path "js/*.js" -Pattern "fetch"` (PowerShell equivalent of `grep`)

## Repository Structure

```
hangul-hub/
├── index.html                  # Main application entry point (placeholder stub)
├── css/
│   └── styles.css              # Main stylesheet (placeholder)
├── js/
│   ├── main.js                 # Application entry script (placeholder)
│   └── data-loader.js          # Async JSON fetching utility (placeholder)
├── data/
│   └── jamo/
│       └── part1-jamo.json     # Part 1: Jamo reference data (40 entries)
├── docs/
│   └── data-sources.md         # Data provenance and verification tracking
├── .gitignore                  # Git ignore rules for OS & editor files
└── README.md                   # Project documentation
```
