import Foundation
import ApplicationServices
import AppKit
import OSLog

class AccessibilityManager {
    private let logger = Logger(subsystem: "com.mindgate.MindGate", category: "AccessibilityManager")
    func hasAccessibilityPermissions() -> Bool {
        return AXIsProcessTrusted()
    }

    func requestAccessibilityPermissions() {
        let options = [kAXTrustedCheckOptionPrompt.takeRetainedValue() as String: true]
        AXIsProcessTrustedWithOptions(options as CFDictionary)
    }

    func getActiveApplication() -> NSRunningApplication? {
        return NSWorkspace.shared.frontmostApplication
    }

    func getWindowTitle(for application: NSRunningApplication) -> String? {
        let appElement = AXUIElementCreateApplication(application.processIdentifier)
        var windowRef: AnyObject?
        let result = AXUIElementCopyAttributeValue(appElement, kAXFocusedWindowAttribute as CFString, &windowRef)

        guard result == .success,
              let windowRef else {
            return nil
        }

        let window = windowRef as! AXUIElement

        var titleRef: AnyObject?
        let titleResult = AXUIElementCopyAttributeValue(window, kAXTitleAttribute as CFString, &titleRef)

        guard titleResult == .success,
              let title = titleRef as? String else {
            return nil
        }

        return title
    }

    func getAllWindowTitles(for application: NSRunningApplication) -> [String] {
        let appElement = AXUIElementCreateApplication(application.processIdentifier)
        var windowsRef: AnyObject?
        let result = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)

        logger.debug("🔧 AXUIElementCopyAttributeValue result: \(result.rawValue)")

        guard result == .success,
              let windows = windowsRef as? [AXUIElement] else {
            logger.error("❌ Failed to get windows or windows array is empty for app: \(application.localizedName ?? "Unknown")")
            return []
        }

        logger.debug("✅ Got \(windows.count) windows for app: \(application.localizedName ?? "Unknown")")

        var titles: [String] = []
        for window in windows {
            var titleRef: AnyObject?
            let titleResult = AXUIElementCopyAttributeValue(window, kAXTitleAttribute as CFString, &titleRef)

            if titleResult == .success,
               let title = titleRef as? String {
                titles.append(title)
                logger.debug("📄 Window title: \(title)")
            }
        }

        return titles
    }

    func testAccessibilityForApp(_ application: NSRunningApplication) -> Bool {
        let appElement = AXUIElementCreateApplication(application.processIdentifier)
        var windowsRef: AnyObject?
        let result = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)

        return result == .success
    }
}
