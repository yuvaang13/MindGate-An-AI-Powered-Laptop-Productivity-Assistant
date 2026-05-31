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
        print("🔍 MindGate: Starting workspace monitoring...")
        observer = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            self?.handleApplicationActivation(notification)
        }
        print("✅ MindGate: Workspace monitoring started")
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
        let bundleID = app.bundleIdentifier ?? ""
        print("📱 App activated: \(appName) (Bundle: \(bundleID))")

        if decisionEngine?.hasActiveAccess(for: app) == true {
            print("✅ Active access window still valid for \(appName)")
            return
        }

        // Check if app is distracting
        if Configuration.distractingApps.contains(appName) {
            print("⚠️ Distracting app detected: \(appName)")
            Task { @MainActor in
                self.windowManager?.showOrb()
                self.decisionEngine?.setCurrentApp(app)
            }
            return
        }

        // Check if it's a browser with restricted content
        let isBrowser = Configuration.monitoredBrowsers.contains(appName) ||
                       bundleID.contains("chrome") ||
                       bundleID.contains("safari") ||
                       bundleID.contains("firefox") ||
                       bundleID.contains("brave") ||
                       bundleID.contains("edge")

        if isBrowser {
            print("🌐 Browser detected: \(appName)")
            checkBrowserContent(app: app)
        }
    }

    private func checkBrowserContent(app: NSRunningApplication) {
        let canAccess = accessibilityManager.testAccessibilityForApp(app)
        print("🔐 Can access browser windows: \(canAccess)")

        if !canAccess {
            print("❌ Accessibility permissions not working for browser")
            return
        }

        let windowTitles = accessibilityManager.getAllWindowTitles(for: app)

        print("🔍 Browser window titles: \(windowTitles)")

        for title in windowTitles {
            let lowercasedTitle = title.lowercased()
            for keyword in Configuration.restrictedKeywords {
                if lowercasedTitle.contains(keyword) {
                    print("⚠️ Restricted keyword detected: \(keyword) in title: \(title)")
                    Task { @MainActor in
                        self.windowManager?.showOrb()
                        self.decisionEngine?.setCurrentApp(app)
                    }
                    return
                }
            }
        }

        if windowTitles.isEmpty {
            print("⚠️ Could not get any window titles for browser")
        }
    }

    deinit {
        stopMonitoring()
    }
}
