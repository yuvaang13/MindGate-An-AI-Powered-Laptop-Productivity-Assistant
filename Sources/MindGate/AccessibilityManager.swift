import Foundation
import ApplicationServices
import AppKit

class AccessibilityManager {
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
              let window = windowRef as! AXUIElement? else {
            return nil
        }
        
        var titleRef: AnyObject?
        let titleResult = AXUIElementCopyAttributeValue(window, kAXTitleAttribute as CFString, &titleRef)
        
        guard titleResult == .success,
              let title = titleRef as? String else {
            return nil
        }
        
        return title
    }
}
