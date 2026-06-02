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

    func applicationDidFinishLaunching(_ notification: Notification) {
        logger.info("🚀 MindGate: Application launched")

        // Initialize Configuration Manager
        configurationManager = ConfigurationManager()
        let configuration = configurationManager.configuration

        // Initialize services and engines
        let ollamaService = OllamaService(configuration: configuration)
        decisionEngine = DecisionEngine(ollamaService: ollamaService, configuration: configuration)

        // Initialize managers
        accessibilityManager = AccessibilityManager()
        windowManager = WindowManager(decisionEngine: decisionEngine, configuration: configuration)
        workspaceMonitor = WorkspaceMonitor(
            windowManager: windowManager,
            decisionEngine: decisionEngine,
            configuration: configuration
        )

        // Check accessibility permissions
        let hasPermissions = accessibilityManager.hasAccessibilityPermissions()
        logger.info("🔐 Accessibility permissions: \(hasPermissions ? "✅ Granted" : "❌ Denied")")

        // Start monitoring regardless of permissions for testing
        // Browser monitoring requires permissions, but app monitoring works without them
        workspaceMonitor.startMonitoring()

        if !hasPermissions {
            logger.warning("⚠️ Browser monitoring may not work without accessibility permissions")
            logger.info("💡 Grant permissions in System Settings > Privacy & Security > Accessibility")
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
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
