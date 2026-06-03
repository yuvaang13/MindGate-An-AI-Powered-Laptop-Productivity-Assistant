import SwiftUI
import AppKit
import OSLog

class AppDelegate: NSObject, NSApplicationDelegate {
    var accessibilityManager: AccessibilityManager!
    var windowManager: WindowManager!
    var workspaceMonitor: WorkspaceMonitor!
    var decisionEngine: DecisionEngine!
    var configurationManager: ConfigurationManager!
    private let logger = Logger(subsystem: "com.mindgate.MindGate", category: "AppDelegate")
    private var statusBarItem: NSStatusItem!
    private var settingsWindow: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        logger.info("🚀 MindGate: Application launched")

        // Initialize Configuration Manager
        configurationManager = ConfigurationManager()
        let configuration = configurationManager.configuration

        // Initialize services and engines
        let ollamaService = OllamaService(configurationManager: configurationManager)
        decisionEngine = DecisionEngine(ollamaService: ollamaService, configurationManager: configurationManager)

        // Initialize managers
        accessibilityManager = AccessibilityManager()
        windowManager = WindowManager(decisionEngine: decisionEngine, configurationManager: configurationManager)
        workspaceMonitor = WorkspaceMonitor(
            windowManager: windowManager,
            decisionEngine: decisionEngine,
            configurationManager: configurationManager
        )

        // Check accessibility permissions
        let hasPermissions = accessibilityManager.hasAccessibilityPermissions()
        logger.info("🔐 Accessibility permissions: \(hasPermissions ? "✅ Granted" : "❌ Denied")")

        if !hasPermissions {
            accessibilityManager.requestAccessibilityPermissions()
            logger.warning("⚠️ Browser monitoring may not work until accessibility permissions are granted")
            logger.info("💡 Grant permissions in System Settings > Privacy & Security > Accessibility")
        }

        workspaceMonitor.startMonitoring()

        setupStatusBarItem()
    }

    private func setupStatusBarItem() {
        statusBarItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        statusBarItem.button?.image = NSImage(systemSymbolName: "brain.head.profile", accessibilityDescription: "MindGate")
        statusBarItem.button?.toolTip = "MindGate Productivity Assistant"

        let menu = NSMenu()
        menu.addItem(NSMenuItem(title: "Settings", action: #selector(openSettings), keyEquivalent: ""))
        menu.addItem(NSMenuItem(title: "Request Accessibility Permission", action: #selector(requestAccessibilityPermission), keyEquivalent: ""))
        menu.addItem(NSMenuItem.separator())
        menu.addItem(NSMenuItem(title: "Quit MindGate", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        statusBarItem.menu = menu
    }

    @objc private func openSettings() {
        if settingsWindow == nil {
            settingsWindow = NSWindow(
                contentRect: NSRect(x: 0, y: 0, width: 600, height: 800),
                styleMask: [.titled, .closable, .miniaturizable, .resizable],
                backing: .buffered,
                defer: false
            )
            settingsWindow?.center()
            settingsWindow?.setFrameAutosaveName("MindGateSettingsWindow")
            settingsWindow?.contentView = NSHostingView(rootView: SettingsView().environmentObject(configurationManager))
            settingsWindow?.title = "MindGate Settings"
        }
        settingsWindow?.makeKeyAndOrderFront(nil)
    }

    @objc private func requestAccessibilityPermission() {
        accessibilityManager.requestAccessibilityPermissions()
        if let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility") {
            NSWorkspace.shared.open(url)
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }
    
    func applicationWillTerminate(_ notification: Notification) {
        logger.info("🛑 MindGate: Application terminating")
        workspaceMonitor?.stopMonitoring()
    }

    private func showAccessibilityPrompt() {
        let alert = NSAlert()
        alert.messageText = "Accessibility Permissions Required"
        alert.informativeText = "MindGate needs accessibility permissions to monitor your active applications and help you stay focused.\n\nPlease grant permissions in System Settings > Privacy & Security > Accessibility."
        alert.alertStyle = .warning
        alert.addButton(withTitle: "Open System Settings")
        alert.addButton(withTitle: "Quit")

        let response = alert.runModal()

        if response == .alertFirstButtonReturn {
            NSWorkspace.shared.open(URL(string: "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")!)
        }

        NSApplication.shared.terminate(nil)
    }
}
