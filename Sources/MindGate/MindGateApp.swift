import SwiftUI
import AppKit

class AppDelegate: NSObject, NSApplicationDelegate {
    var accessibilityManager: AccessibilityManager!
    var windowManager: WindowManager!
    var workspaceMonitor: WorkspaceMonitor!
    var ollamaService: OllamaService!
    var decisionEngine: DecisionEngine!
    
    func applicationDidFinishLaunching(_ notification: Notification) {
        // Initialize managers
        accessibilityManager = AccessibilityManager()
        windowManager = WindowManager()
        ollamaService = OllamaService()
        decisionEngine = DecisionEngine(ollamaService: ollamaService)
        workspaceMonitor = WorkspaceMonitor(
            windowManager: windowManager,
            decisionEngine: decisionEngine
        )
        
        // Check accessibility permissions
        if !accessibilityManager.hasAccessibilityPermissions() {
            showAccessibilityPrompt()
        } else {
            // Start monitoring
            workspaceMonitor.startMonitoring()
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
