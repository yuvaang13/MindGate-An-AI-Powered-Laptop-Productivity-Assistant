import Foundation
import AppKit
import OSLog

class WorkspaceMonitor {
    private weak var windowManager: WindowManager?
    private weak var decisionEngine: DecisionEngine?
    private var accessibilityManager: AccessibilityManager!
    private var observer: NSObjectProtocol?
    private var pollTimer: Timer?
    private var lastCheckedApp: NSRunningApplication?
    private var lastCheckedTime: Date?
    private var activePromptIdentifier: String?
    private var activePromptShownAt: Date?
    private let debounceInterval: TimeInterval = 0.75
    private let pollInterval: TimeInterval = 1.0
    private let promptRepeatInterval: TimeInterval = 20.0
    private weak var configurationManager: ConfigurationManager?
    private let fallbackConfiguration: Configuration
    private var configuration: Configuration {
        configurationManager?.configuration ?? fallbackConfiguration
    }
    private let logger = Logger(subsystem: "com.mindgate.MindGate", category: "WorkspaceMonitor")

    init(windowManager: WindowManager, decisionEngine: DecisionEngine, configurationManager: ConfigurationManager) {
        self.windowManager = windowManager
        self.decisionEngine = decisionEngine
        self.accessibilityManager = AccessibilityManager()
        self.configurationManager = configurationManager
        self.fallbackConfiguration = configurationManager.configuration
    }

    func startMonitoring() {
        logger.info("🔍 Starting workspace monitoring...")
        stopMonitoring()

        observer = NSWorkspace.shared.notificationCenter.addObserver(
            forName: NSWorkspace.didActivateApplicationNotification,
            object: nil,
            queue: .main
        ) { [weak self] notification in
            self?.handleApplicationActivation(notification)
        }

        let timer = Timer(timeInterval: pollInterval, repeats: true) { [weak self] _ in
            self?.checkFrontmostApplication(reason: "poll")
        }
        RunLoop.main.add(timer, forMode: .common)
        pollTimer = timer

        checkFrontmostApplication(reason: "startup")
        logger.info("✅ Workspace monitoring started")
    }

    func stopMonitoring() {
        if let observer = observer {
            NSWorkspace.shared.notificationCenter.removeObserver(observer)
            self.observer = nil
        }

        pollTimer?.invalidate()
        pollTimer = nil
    }

    private func handleApplicationActivation(_ notification: Notification) {
        guard let app = notification.userInfo?[NSWorkspace.applicationUserInfoKey] as? NSRunningApplication else {
            return
        }

        evaluate(app: app, reason: "activation")
    }

    private func checkFrontmostApplication(reason: String) {
        guard let app = accessibilityManager.getActiveApplication() else {
            logger.debug("No frontmost application available during \(reason)")
            return
        }

        evaluate(app: app, reason: reason)
    }

    private func evaluate(app: NSRunningApplication, reason: String) {
        if isMindGate(app) {
            return
        }

        let appName = app.localizedName ?? ""
        let bundleID = app.bundleIdentifier ?? ""
        logger.info("📱 Checking app during \(reason): \(appName) (Bundle: \(bundleID))")

        if decisionEngine?.hasActiveAccess(for: app) == true {
            logger.info("✅ Active access window still valid for \(appName)")
            clearActivePrompt()
            return
        }

        // Check if app is distracting
        if isDistractingApp(app) {
            logger.warning("⚠️ Distracting app detected: \(appName)")
            presentDistractionPrompt(for: app, reason: "distracting app")
            return
        }

        // Check if it's a browser with restricted content
        if isBrowser(app) {
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
            if browserContainsRestrictedContent(app: app) {
                presentDistractionPrompt(for: app, reason: "restricted browser content")
            } else {
                clearPromptIfNeeded(for: app)
            }

            return
        }

        clearPromptIfNeeded(for: app)
    }

    private func browserContainsRestrictedContent(app: NSRunningApplication) -> Bool {
        if let url = accessibilityManager.getActiveBrowserURL(for: app), !url.isEmpty {
            logger.info("🔎 Active browser URL: \(url)")

            if let keyword = matchedRestrictedKeyword(in: url) {
                logger.warning("⚠️ Restricted keyword detected: \(keyword) in URL: \(url)")
                return true
            }
        }

        let canAccess = accessibilityManager.testAccessibilityForApp(app)
        logger.info("🔐 Can access browser windows: \(canAccess)")

        if !canAccess {
            logger.warning("❌ Accessibility permissions not working for browser")
            return false
        }

        let windowTitles = accessibilityManager.getAllWindowTitles(for: app)

        logger.info("🔍 Browser window titles: \(windowTitles)")

        for title in windowTitles {
            // Check for YouTube specifically with multiple patterns
            let lowercasedTitle = title.lowercased()
            if lowercasedTitle.contains("youtube") ||
                lowercasedTitle.contains("youtu.be") ||
                lowercasedTitle.contains("- youtube") {
                logger.warning("⚠️ YouTube detected in title: \(title)")
                return true
            }

            // Check other restricted keywords
            if let keyword = matchedRestrictedKeyword(in: title) {
                logger.warning("⚠️ Restricted keyword detected: \(keyword) in title: \(title)")
                return true
            }
        }

        if windowTitles.isEmpty {
            logger.warning("⚠️ Could not get any window titles for browser")
        }

        return false
    }

    private func presentDistractionPrompt(for app: NSRunningApplication, reason: String) {
        let identifier = appIdentifier(for: app)

        if activePromptIdentifier == identifier,
           let activePromptShownAt,
           Date().timeIntervalSince(activePromptShownAt) < promptRepeatInterval {
            logger.debug("Prompt already active for \(identifier)")
            return
        }

        activePromptIdentifier = identifier
        activePromptShownAt = Date()
        logger.warning("🚨 Presenting MindGate prompt for \(app.localizedName ?? identifier): \(reason)")

        Task { @MainActor in
            self.decisionEngine?.setCurrentApp(app)
            self.windowManager?.targetApp = app // Set target app for overlay positioning
            self.windowManager?.showOrb()
        }
    }

    private func clearPromptIfNeeded(for app: NSRunningApplication) {
        guard let activePromptIdentifier else {
            return
        }

        if activePromptIdentifier == appIdentifier(for: app) {
            logger.info("✅ No restricted content remains for \(app.localizedName ?? activePromptIdentifier)")
            clearActivePrompt()

            Task { @MainActor in
                self.windowManager?.hideOrb()
            }
        }
    }

    private func isDistractingApp(_ app: NSRunningApplication) -> Bool {
        let values = normalizedValues(for: app)

        return configuration.settings.distractingApps.contains { configuredName in
            let normalizedName = normalize(configuredName)
            guard !normalizedName.isEmpty else { return false }

            return values.contains { value in
                value == normalizedName || (normalizedName.count >= 4 && value.contains(normalizedName))
            }
        }
    }

    private func isBrowser(_ app: NSRunningApplication) -> Bool {
        let values = normalizedValues(for: app)

        if configuration.settings.monitoredBrowsers.contains(where: { configuredName in
            let normalizedName = normalize(configuredName)
            return values.contains { value in
                value == normalizedName || (normalizedName.count >= 4 && value.contains(normalizedName))
            }
        }) {
            return true
        }

        return values.contains { value in
            value.contains("chrome") ||
                value.contains("safari") ||
                value.contains("firefox") ||
                value.contains("brave") ||
                value.contains("edge")
        }
    }

    private func matchedRestrictedKeyword(in text: String) -> String? {
        let normalizedText = normalize(text)

        return configuration.settings.restrictedKeywords.first { keyword in
            let normalizedKeyword = normalize(keyword)
            return !normalizedKeyword.isEmpty && normalizedText.contains(normalizedKeyword)
        }
    }

    private func normalizedValues(for app: NSRunningApplication) -> [String] {
        [
            app.localizedName,
            app.bundleIdentifier
        ].compactMap { $0 }.map(normalize)
    }

    private func normalize(_ value: String) -> String {
        value.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private func appIdentifier(for app: NSRunningApplication) -> String {
        if let bundleIdentifier = app.bundleIdentifier, !bundleIdentifier.isEmpty {
            return bundleIdentifier
        }

        return app.localizedName ?? "\(app.processIdentifier)"
    }

    private func isMindGate(_ app: NSRunningApplication) -> Bool {
        app.processIdentifier == ProcessInfo.processInfo.processIdentifier
    }

    private func clearActivePrompt() {
        activePromptIdentifier = nil
        activePromptShownAt = nil
    }

    deinit {
        stopMonitoring()
    }
}
