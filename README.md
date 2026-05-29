# MindGate - AI-Powered Laptop Productivity Assistant

A futuristic, on-device AI productivity assistant for macOS that helps you stay focused by intelligently managing access to distracting applications and websites.

## Features

- **AI Orb Interface**: A futuristic, breathing AI orb that appears when you visit distracting content
- **Local AI Evaluation**: Uses Ollama (phi3 or llama3) running locally to evaluate your access requests
- **Smart Access Control**: AI decides whether to grant access (with time limits) or block the distraction
- **Seamless Integration**: Runs as a background agent without a Dock icon
- **Browser Monitoring**: Tracks Safari and Chrome for distracting keywords
- **App Monitoring**: Detects when you switch to distracting applications

## System Requirements

- macOS 14.0 or later
- Swift 5.9 or later
- Ollama running locally (http://localhost:11434)
- Accessibility permissions (granted on first launch)

## Installation

### Using Swift Package Manager (No Xcode Required)

1. Clone this repository:
```bash
git clone https://github.com/YOUR_USERNAME/An-AI-Powered-Laptop-Productivity-Assistant.git
cd An-AI-Powered-Laptop-Productivity-Assistant
```

2. Install Ollama if you haven't already:
```bash
# Visit https://ollama.ai to download and install Ollama
# Then pull a model:
ollama pull phi3
# or
ollama pull llama3
```

3. Build the project:
```bash
swift build
```

4. Run the application:
```bash
swift run
```

5. Grant Accessibility permissions when prompted:
   - Go to System Settings > Privacy & Security > Accessibility
   - Add MindGate and enable it

### Using Xcode (Optional)

If you prefer to use Xcode:

```bash
# Open the package in Xcode
swift package edit
# Or double-click Package.swift to open in Xcode
```

## Usage

1. Launch MindGate - it runs in the background (no Dock icon)
2. When you navigate to a distracting app or website, the AI Orb appears
3. Click the Orb to expand the chat interface
4. Type your justification for needing access
5. The AI evaluates your request:
   - **Approved**: Choose a duration (5/10/15 minutes) and continue
   - **Denied**: The app/website is hidden and you're returned to work

## Configuration

Edit the `Sources/MindGate/Configuration.swift` file to customize:
- Distracting applications list
- Restricted website keywords
- Ollama model selection
- Access duration options

## Architecture

- **WindowManager**: Manages Orb and Overlay NSPanel windows
- **WorkspaceMonitor**: Tracks active application changes via NSWorkspace
- **AccessibilityMonitor**: Scrapes browser titles using AXUIElement
- **OllamaService**: Handles local AI API communication
- **DecisionEngine**: Processes AI responses and manages access control

## Privacy

- All AI processing happens locally on your machine
- No data is sent to external servers
- Ollama runs entirely on-device

## License

MIT License - feel free to use and modify for your needs

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
