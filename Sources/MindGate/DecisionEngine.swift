import Foundation
import AppKit
import OSLog

struct DecisionResult {
    let isApproved: Bool
    let message: String
}

class DecisionEngine {
    private let ollamaService: OllamaService
    private let configurationManager: ConfigurationManager
    private var currentApp: NSRunningApplication?
    private var accessTimer: Timer?
    private var grantedAppIdentifier: String?
    private var accessExpiresAt: Date?
    private let logger = Logger(subsystem: "com.mindgate.MindGate", category: "DecisionEngine")

    init(ollamaService: OllamaService, configurationManager: ConfigurationManager) {
        self.ollamaService = ollamaService
        self.configurationManager = configurationManager
    }

    func setCurrentApp(_ app: NSRunningApplication) {
        self.currentApp = app
    }

    func evaluateRequest(userInput: String) async throws -> DecisionResult {
        logger.info("User justification received: \"\(userInput)\"")

        let systemPrompt = """
        You are a highly advanced, strict productivity mentor. The user is trying to access a distracting app. Their reason is: \'\(userInput)\'.
        If this is genuinely essential for immediate work, task tracking, or safety, respond only with the word \'YES\'.
        If it is an excuse, mindless scrolling, or procrastination, reply only with the word \'NO\'.
        
        Current productive tasks: \(configurationManager.configuration.settings.productiveTasks.joined(separator: ", "))
        Current productive apps: \(configurationManager.configuration.settings.productiveApps.joined(separator: ", "))
        """

        do {
            let response = try await ollamaService.generateResponse(prompt: systemPrompt)
            logger.info("Ollama raw response: \"\(response)\"")

            let isApproved = Self.parseApproval(from: response)
            let resultMessage: String

            if isApproved {
                resultMessage = "Access approved. Please select a duration."
                logger.info("Decision: APPROVED. Message: \"\(resultMessage)\"")
            } else {
                resultMessage = "Access denied. Stay focused on your work."
                logger.warning("Decision: DENIED. Message: \"\(resultMessage)\"")
            }
            return DecisionResult(isApproved: isApproved, message: resultMessage)

        } catch {
            logger.error("Error evaluating request with Ollama: \(error.localizedDescription). Defaulting to access denied.")
            // If Ollama fails, default to denying access for safety
            let errorMessage = "AI service unavailable. Access denied."
            logger.warning("Decision: DENIED. Message: \"\(errorMessage)\" (due to AI service error)")
            return DecisionResult(isApproved: false, message: errorMessage)
        }
    }

    func grantAccess(for duration: TimeInterval) {
        // Start a timer to revoke access after the duration
        accessTimer?.invalidate()
        grantedAppIdentifier = currentApp.map(Self.identifier)
        accessExpiresAt = Date().addingTimeInterval(duration)

        accessTimer = Timer.scheduledTimer(withTimeInterval: duration, repeats: false) { [weak self] _ in
            self?.revokeAccess()
        }

        logger.info("Access granted for \(duration) seconds.")
    }

    private func revokeAccess() {
        // Hide the current app when time expires
        if let app = currentApp {
            app.hide()
        }

        accessTimer?.invalidate()
        accessTimer = nil
        grantedAppIdentifier = nil
        accessExpiresAt = nil
    }

    func hideCurrentApp() {
        if let app = currentApp {
            app.hide()
        }
    }

    func closeCurrentAppOrTab() {
        guard let app = currentApp else { return }

        // For browsers, try to close the current tab using AppleScript
        let bundleID = app.bundleIdentifier ?? ""
        let isBrowser = bundleID.contains("chrome") ||
                       bundleID.contains("safari") ||
                       bundleID.contains("firefox") ||
                       bundleID.contains("brave") ||
                       bundleID.contains("edge")

        if isBrowser {
            closeBrowserTab(bundleID: bundleID)
        } else {
            // For regular apps, just hide or quit them
            app.hide()
        }
    }

    private func closeBrowserTab(bundleID: String) {
        let script: String
        if bundleID.contains("chrome") {
            script = "tell application \"Google Chrome\" to close active tab of front window"
        } else if bundleID.contains("safari") {
            script = "tell application \"Safari\" to close current tab of front window"
        } else if bundleID.contains("firefox") {
            script = "tell application \"Firefox\" to close active tab of front window"
        } else if bundleID.contains("brave") {
            script = "tell application \"Brave Browser\" to close active tab of front window"
        } else if bundleID.contains("edge") {
            script = "tell application \"Microsoft Edge\" to close active tab of front window"
        } else {
            script = ""
        }

        if !script.isEmpty {
            var error: NSDictionary?
            NSAppleScript(source: script)?.executeAndReturnError(&error)
            if let error = error {
                logger.error("❌ Failed to close browser tab: \(error)")
            } else {
                logger.info("✅ Closed browser tab")
            }
        }
    }

    func hasActiveAccess(for app: NSRunningApplication) -> Bool {
        guard let grantedAppIdentifier,
              let accessExpiresAt,
              accessExpiresAt > Date() else {
            cancelAccessTimer()
            return false
        }

        return grantedAppIdentifier == Self.identifier(for: app)
    }

    func cancelAccessTimer() {
        accessTimer?.invalidate()
        accessTimer = nil
        grantedAppIdentifier = nil
        accessExpiresAt = nil
    }

    private static func parseApproval(from response: String) -> Bool {
        let normalized = response
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .uppercased()

        if normalized.hasPrefix("YES") {
            return true
        }

        return false
    }

    private static func identifier(for app: NSRunningApplication) -> String {
        if let bundleIdentifier = app.bundleIdentifier, !bundleIdentifier.isEmpty {
            return bundleIdentifier
        }

        return app.localizedName ?? "\(app.processIdentifier)"
    }
}
