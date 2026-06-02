import Foundation
import AppKit
import OSLog

class WorkspaceMonitor {
    private weak var windowManager: WindowManager?
    private weak var decisionEngine: DecisionEngine?
    private var accessibilityManager: AccessibilityManager!
    private var observer: NSObjectProtocol?
    private var lastCheckedApp: NSRunningApplication?
    private var lastCheckedTime: Date?
    private let debounceInterval: TimeInterval = 0.05
    private let configuration: Configuration
    private let logger = Logger(subsystem: "com.mindgate.MindGate", category: "WorkspaceMonitor")

    init(windowManager: WindowManager, decisionEngine: DecisionEngine, configuration: Configuration) {
        self.windowManager = windowManager
        self.decisionEngine = decisionEngine
        self.accessibilityManager = AccessibilityManager()
        self.configuration = configuration
    }

    func startMonitoring() {
        logger.info("🔍 Starting workspace monitoring...")
        observer = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            self?.handleApplicationActivation(notification)
        }
        logger.info("✅ Workspace monitoring started")
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
        logger.info("📱 App activated: \(appName) (Bundle: \(bundleID))")

        if decisionEngine?.hasActiveAccess(for: app) == true {
            logger.info("✅ Active access window still valid for \(appName)")
            return
        }

        // Check if app is distracting
        if configuration.settings.distractingApps.contains(appName) {
            logger.warning("⚠️ Distracting app detected: \(appName)")
            Task { @MainActor in
                self.windowManager?.showOrb()
                self.decisionEngine?.setCurrentApp(app)
            }
            return
        }

        // Check if it's a browser with restricted content
        let isBrowser = configuration.settings.monitoredBrowsers.contains(appName) ||
                       bundleID.contains("chrome") ||
                       bundleID.contains("safari") ||
                       bundleID.contains("firefox") ||
                       bundleID.contains("brave") ||
                       bundleID.contains("edge")

        if isBrowser {
            logger.info("🌐 Browser detected: \(appName)")
            // Debounce browser content checks
            let now = Date()
            if let lastTime = lastCheckedTime,
               now.timeIntervalSince(lastTime) < debounceInterval,
               lastCheckedApp?.bundleIdentifier == app.bundleIdentifier {
                logger.debug("⏱️ Debouncing browser check (too soon)")
                return
            }
            lastCheckedApp = app
            lastCheckedTime = now
            checkBrowserContent(app: app)
        }
    }

    private func checkBrowserContent(app: NSRunningApplication) {
        let canAccess = accessibilityManager.testAccessibilityForApp(app)
        logger.info("🔐 Can access browser windows: \(canAccess)")

        if !canAccess {
            logger.warning("❌ Accessibility permissions not working for browser")
            return
        }

        let windowTitles = accessibilityManager.getAllWindowTitles(for: app)

        logger.info("🔍 Browser window titles: \(windowTitles)")

        for title in windowTitles {
            let lowercasedTitle = title.lowercased()
            
            // Check for YouTube specifically with multiple patterns
            if lowercasedTitle.contains("youtube") || 
               lowercasedTitle.contains("youtu.be") ||
               lowercasedTitle.contains("- youtube") {
                logger.warning("⚠️ YouTube detected in title: \(title)")
                Task { @MainActor in
                    self.windowManager?.showOrb()
                    self.decisionEngine?.setCurrentApp(app)
                }
                return
            }
            
            // Check other restricted keywords
            for keyword in configuration.settings.restrictedKeywords {
                if lowercasedTitle.contains(keyword) {
                    logger.warning("⚠️ Restricted keyword detected: \(keyword) in title: \(title)")
                    Task { @MainActor in
                        self.windowManager?.showOrb()
                        self.decisionEngine?.setCurrentApp(app)
                    }
                    return
                }
            }
        }

        if windowTitles.isEmpty {
            logger.warning("⚠️ Could not get any window titles for browser")
        }
    }

    deinit {
        stopMonitoring()
    }
}
