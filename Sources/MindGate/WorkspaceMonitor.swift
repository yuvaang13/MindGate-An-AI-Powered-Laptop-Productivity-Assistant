import Foundation
import AppKit

class WorkspaceMonitor {
    private weak var windowManager: WindowManager?
    private weak var decisionEngine: DecisionEngine?
    private var accessibilityManager: AccessibilityManager!
    private var observer: NSObjectProtocol?
    
    init(windowManager: WindowManager, decisionEngine: DecisionEngine) {
        self.windowManager = windowManager
        self.decisionEngine = decisionEngine
        self.accessibilityManager = AccessibilityManager()
    }
    
    func startMonitoring() {
        observer = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            self?.handleApplicationActivation(notification)
        }
    }
    
    func stopMonitoring() {
        if let observer = observer {
            NSWorkspace.shared.notificationCenter.removeObserver(observer)
        }
    }
    
    private func handleApplicationActivation(_ notification: Notification) {
        guard let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication else {
            return
        }
        
        let appName = app.localizedName ?? ""
        
        // Check if app is distracting
        if Configuration.distractingApps.contains(appName) {
            Task { @MainActor in
                self.windowManager?.showOrb()
                self.decisionEngine?.setCurrentApp(app)
            }
            return
        }
        
        // Check if it's a browser with restricted content
        if Configuration.monitoredBrowsers.contains(appName) {
            checkBrowserContent(app: app)
        }
    }
    
    private func checkBrowserContent(app: NSRunningApplication) {
        let windowTitle = accessibilityManager.getWindowTitle(for: app)
        
        if let title = windowTitle?.lowercased() {
            for keyword in Configuration.restrictedKeywords {
                if title.contains(keyword) {
                    Task { @MainActor in
                        self.windowManager?.showOrb()
                        self.decisionEngine?.setCurrentApp(app)
                    }
                    return
                }
            }
        }
    }
    
    deinit {
        stopMonitoring()
    }
}
