import Foundation
import AppKit
import SwiftUI
import OSLog
import ApplicationServices
import CoreGraphics

private final class FocusablePanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
    override var acceptsFirstResponder: Bool { true }
}

private final class KeyboardFocusableWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
    override var acceptsFirstResponder: Bool { true }
}

@MainActor
class WindowManager: ObservableObject {
    private var orbPanel: NSPanel?
    private var overlayPanel: NSPanel?
    private var orbHostingController: NSHostingController<OrbView>?
    private var overlayHostingController: NSHostingController<OverlayView>?
    private let decisionEngine: DecisionEngine
    private let configuration: Configuration
    private let orbWindowLevel: NSWindow.Level = .popUpMenu
    private let logger = Logger(subsystem: "com.mindgate.MindGate", category: "WindowManager")
    private var focusTimer: Timer?
    weak var targetApp: NSRunningApplication?

    @Published var isOrbExpanded = false
    @Published var isOverlayVisible = false
    @Published var isDistractionDetected = false

    init(decisionEngine: DecisionEngine, configuration: Configuration) {
        self.decisionEngine = decisionEngine
        self.configuration = configuration
        setupOrbPanel()
        setupOverlayPanel()
    }

    // MARK: - Orb Panel Setup
    private func setupOrbPanel() {
        let orbView = OrbView(
            windowManager: self,
            decisionEngine: decisionEngine,
            configuration: configuration,
            isExpanded: isOrbExpanded
        )

        orbHostingController = NSHostingController(rootView: orbView)

        let panel = FocusablePanel(
            contentRect: NSRect(x: 0, y: 0, width: configuration.theme.dimensions.orbSize, height: configuration.theme.dimensions.orbSize),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )

        panel.isFloatingPanel = true
        panel.level = orbWindowLevel
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .stationary, .ignoresCycle]
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = false
        panel.hidesOnDeactivate = false
        panel.becomesKeyOnlyIfNeeded = false
        panel.acceptsMouseMovedEvents = true
        panel.tabbingMode = .disallowed
        panel.ignoresMouseEvents = false
        panel.contentView = orbHostingController?.view
        panel.contentView?.wantsLayer = true
        panel.contentView?.layer?.backgroundColor = NSColor.clear.cgColor

        orbPanel = panel
        positionOrbPanel()

        logger.info("🔧 Orb panel setup complete")
    }

    // MARK: - Overlay Panel Setup
    private func setupOverlayPanel() {
        let overlayView = OverlayView(configuration: configuration)

        overlayHostingController = NSHostingController(rootView: overlayView)

        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )

        panel.isFloatingPanel = true
        panel.level = NSWindow.Level(Int(CGShieldingWindowLevel()))
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
        panel.backgroundColor = NSColor.black
        panel.isOpaque = false
        panel.hasShadow = false
        panel.ignoresMouseEvents = true
        panel.hidesOnDeactivate = false
        
        panel.contentView = overlayHostingController?.view
        panel.contentView?.wantsLayer = true
        panel.contentView?.layer?.backgroundColor = NSColor.black.withAlphaComponent(0.7).cgColor
        overlayPanel = panel
        logger.info("Overlay panel setup complete")
    }

    // MARK: - Positioning
    private func positionOrbPanel() {
        guard let screen = targetScreen() else { return }
        let screenFrame = screen.visibleFrame

        let panelWidth = isOrbExpanded ? configuration.theme.dimensions.orbExpandedWidth : configuration.theme.dimensions.orbSize
        let panelHeight = isOrbExpanded ? configuration.theme.dimensions.orbExpandedHeight : configuration.theme.dimensions.orbSize

        let xOffset: CGFloat = isOrbExpanded ? configuration.theme.dimensions.orbXOffset + 6 : configuration.theme.dimensions.orbXOffset
        let yOffset: CGFloat = isOrbExpanded ? configuration.theme.dimensions.orbYOffset : configuration.theme.dimensions.orbYOffset
        
        let distractionOffset: CGFloat = isDistractionDetected ? configuration.theme.dimensions.orbDistractionOffset : 0
        let x = screenFrame.minX + xOffset + distractionOffset
        let y = screenFrame.maxY - panelHeight - yOffset - 100 + distractionOffset

        let contentSize = NSSize(width: panelWidth, height: panelHeight)
        let frame = NSRect(origin: NSPoint(x: x, y: y), size: contentSize)

        orbPanel?.setFrame(frame, display: true, animate: true)
        applyOrbPanelShape(size: contentSize)
    }

    private func refreshOrbView() {
        orbHostingController?.rootView = OrbView(
            windowManager: self,
            decisionEngine: decisionEngine,
            configuration: configuration,
            isExpanded: isOrbExpanded
        )
        orbHostingController?.view.frame = NSRect(
            origin: .zero,
            size: NSSize(
                width: isOrbExpanded ? configuration.theme.dimensions.orbExpandedWidth : configuration.theme.dimensions.orbSize,
                height: isOrbExpanded ? configuration.theme.dimensions.orbExpandedHeight : configuration.theme.dimensions.orbSize
            )
        )
        orbHostingController?.view.needsLayout = true
    }

    private func applyOrbPanelShape(size: NSSize) {
        guard let contentView = orbPanel?.contentView else { return }

        contentView.wantsLayer = true
        contentView.frame = NSRect(origin: .zero, size: size)
        contentView.layer?.backgroundColor = NSColor.clear.cgColor
        contentView.layer?.cornerRadius = 16
        contentView.layer?.cornerCurve = .continuous
        contentView.layer?.masksToBounds = true
    }

    private func targetScreen() -> NSScreen? {
        let mouseLocation = NSEvent.mouseLocation

        return NSScreen.screens.first { screen in
            NSMouseInRect(mouseLocation, screen.frame, false)
        } ?? NSScreen.main ?? NSScreen.screens.first
    }

    private func presentOrbPanel(_ panel: NSPanel) {
        panel.level = isOrbExpanded ? .normal : orbWindowLevel
        panel.alphaValue = 1
        panel.ignoresMouseEvents = false
        panel.setFrame(panel.frame, display: true)
        panel.contentView?.layoutSubtreeIfNeeded()
        panel.orderFrontRegardless()

        if isOrbExpanded {
            NSApplication.shared.activate(ignoringOtherApps: true)
            panel.makeKeyAndOrderFront(nil)
            panel.makeMain()
        }
        panel.orderFrontRegardless()
        panel.displayIfNeeded()

        let isOnAnyScreen = NSScreen.screens.contains { screen in
            screen.frame.intersects(panel.frame)
        }

        if panel.isVisible && isOnAnyScreen {
            logger.info("✅ Orb visible at frame: \(panel.frame.debugDescription), level: \(panel.level.rawValue)")
        } else {
            logger.error("❌ Orb presentation failed. isVisible=\(panel.isVisible), isOnAnyScreen=\(isOnAnyScreen), frame=\(panel.frame.debugDescription)")
        }
    }

    // MARK: - Orb Control
    func showOrb() {
        logger.info("🔮 Showing Orb...")
        isDistractionDetected = true
        isOrbExpanded = true
        refreshOrbView()
        positionOrbPanel()

        guard let panel = orbPanel else {
            logger.error("❌ Orb panel is nil")
            return
        }

        presentOrbPanel(panel)
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            self.startFocusPolling()
        }
    }

    func hideOrb() {
        orbPanel?.orderOut(nil)
        isOrbExpanded = false
        isDistractionDetected = false
        refreshOrbView()
        focusTimer?.invalidate()
        focusTimer = nil
    }

    func expandOrb() {
        isOrbExpanded = true
        refreshOrbView()
        positionOrbPanel()

        if let orbPanel {
            presentOrbPanel(orbPanel)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                self.startFocusPolling()
            }
        }
    }
    
    func requestKeyboardFocus() {
        startFocusPolling()
    }
    
    func forceKeyboardFocus() {
        pollForFirstResponder()
    }
    
    private func startFocusPolling() {
        focusTimer?.invalidate()
        focusTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.pollForFirstResponder()
            }
        }
    }
    
    private func stopFocusPolling() {
        focusTimer?.invalidate()
        focusTimer = nil
    }
    
    private func pollForFirstResponder() {
        guard let panel = orbPanel, isOrbExpanded else { 
            stopFocusPolling()
            return 
        }
        
        let textView = findTextViewRecursively(in: panel.contentView)
        
        if let textView = textView {
            NSApp.activate(ignoringOtherApps: true)
            panel.makeKeyAndOrderFront(nil)
            panel.makeMain()
            panel.makeFirstResponder(textView)
        }
    }
    
    private func findTextViewRecursively(in view: NSView?) -> NSTextView? {
        guard let view = view else { return nil }
        
        if let scrollView = view as? NSScrollView {
            return scrollView.documentView as? NSTextView ?? findTextViewRecursively(in: scrollView.contentView)
        }
        
        if let textView = view as? NSTextView {
            return textView
        }
        
        if view.isMember(of: NSClassFromString("NSHostingView") ?? NSView.self) {
            for subview in view.subviews {
                if let found = findTextViewRecursively(in: subview) {
                    return found
                }
            }
        }
        
        for subview in view.subviews {
            if let found = findTextViewRecursively(in: subview) {
                return found
            }
        }
        
        return nil
    }

    func collapseOrb() {
        isOrbExpanded = false
        isDistractionDetected = false
        positionOrbPanel()
        refreshOrbView()
        focusTimer?.invalidate()
        focusTimer = nil
    }

    // MARK: - Overlay Control
    func showOverlay() {
        guard let targetApp = targetApp else { 
            logger.error("No target app set for overlay")
            return 
        }
        
        // Get the target app window frame directly - don't rely on mouse location
        // since the orb may be capturing mouse events
        let targetFrame = getTargetAppWindowFrame(app: targetApp)
        logger.info("Showing overlay over target app window frame: \(targetFrame.debugDescription)")
        
        guard let panel = overlayPanel else {
            logger.error("Overlay panel is nil")
            return
        }
        
        panel.setFrame(targetFrame, display: true)
        panel.orderFrontRegardless()
        
        isOverlayVisible = true
        logger.info("Overlay is now visible at: \(targetFrame.debugDescription)")
    }
    
    private func getTargetAppWindowFrame(app: NSRunningApplication) -> NSRect {
        let appElement = AXUIElementCreateApplication(app.processIdentifier)
        
        // First try to get the main window
        var mainWindowRef: CFTypeRef?
        let mainWindowResult = AXUIElementCopyAttributeValue(appElement, kAXMainWindowAttribute as CFString, &mainWindowRef)
        
        if mainWindowResult == .success, let mainWindow = mainWindowRef {
            var positionRef: CFTypeRef?
            var sizeRef: CFTypeRef?
            
            AXUIElementCopyAttributeValue(mainWindow as! AXUIElement, kAXPositionAttribute as CFString, &positionRef)
            AXUIElementCopyAttributeValue(mainWindow as! AXUIElement, kAXSizeAttribute as CFString, &sizeRef)
            
            if let position = positionRef as? NSValue,
               let size = sizeRef as? NSValue {
                let point = position.pointValue
                let windowSize = size.sizeValue
                let windowFrame = NSRect(x: point.x, y: point.y, width: windowSize.width, height: windowSize.height)
                logger.info("Got main window frame: \(windowFrame.debugDescription)")
                return windowFrame
            }
        }
        
        // Try to get any focused window
        var focusedWindowRef: CFTypeRef?
        let focusedResult = AXUIElementCopyAttributeValue(appElement, kAXFocusedWindowAttribute as CFString, &focusedWindowRef)
        
        if focusedResult == .success, let focusedWindow = focusedWindowRef {
            var positionRef: CFTypeRef?
            var sizeRef: CFTypeRef?
            
            AXUIElementCopyAttributeValue(focusedWindow as! AXUIElement, kAXPositionAttribute as CFString, &positionRef)
            AXUIElementCopyAttributeValue(focusedWindow as! AXUIElement, kAXSizeAttribute as CFString, &sizeRef)
            
            if let position = positionRef as? NSValue,
               let size = sizeRef as? NSValue {
                let point = position.pointValue
                let windowSize = size.sizeValue
                let windowFrame = NSRect(x: point.x, y: point.y, width: windowSize.width, height: windowSize.height)
                logger.info("Got focused window frame: \(windowFrame.debugDescription)")
                return windowFrame
            }
        }
        
        // Try to get all windows and find the one near mouse
        var windowsRef: CFTypeRef?
        let windowsResult = AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute as CFString, &windowsRef)
        
        if windowsResult == .success, let windows = windowsRef as? [AXUIElement] {
            let mouseLocation = NSEvent.mouseLocation
            for window in windows {
                var positionRef: CFTypeRef?
                var sizeRef: CFTypeRef?
                
                AXUIElementCopyAttributeValue(window, kAXPositionAttribute as CFString, &positionRef)
                AXUIElementCopyAttributeValue(window, kAXSizeAttribute as CFString, &sizeRef)
                
                if let position = positionRef as? NSValue,
                   let size = sizeRef as? NSValue {
                    let point = position.pointValue
                    let windowSize = size.sizeValue
                    let windowFrame = NSRect(x: point.x, y: point.y, width: windowSize.width, height: windowSize.height)
                    
                    // Check if mouse is inside this window
                    if NSMouseInRect(mouseLocation, windowFrame, false) {
                        logger.info("Found window containing mouse at: \(windowFrame.debugDescription)")
                        return windowFrame
                    }
                }
            }
            
            // If no window contains mouse, use the first window
            if let firstWindow = windows.first {
                var positionRef: CFTypeRef?
                var sizeRef: CFTypeRef?
                
                AXUIElementCopyAttributeValue(firstWindow, kAXPositionAttribute as CFString, &positionRef)
                AXUIElementCopyAttributeValue(firstWindow, kAXSizeAttribute as CFString, &sizeRef)
                
                if let position = positionRef as? NSValue,
                   let size = sizeRef as? NSValue {
                    let point = position.pointValue
                    let windowSize = size.sizeValue
                    let windowFrame = NSRect(x: point.x, y: point.y, width: windowSize.width, height: windowSize.height)
                    logger.info("Using first window frame: \(windowFrame.debugDescription)")
                    return windowFrame
                }
            }
        }
        
        // Fallback to screen frame where mouse is located
        let mouseLocation = NSEvent.mouseLocation
        let screen = NSScreen.screens.first { screen in
            NSMouseInRect(mouseLocation, screen.frame, false)
        } ?? NSScreen.main ?? NSScreen.screens.first
        
        logger.warning("Could not get window frame, using screen frame: \(screen?.frame.debugDescription ?? "nil")")
        return screen?.frame ?? NSRect(x: 0, y: 0, width: 1920, height: 1080)
    }

    func hideOverlay() {
        overlayPanel?.orderOut(nil)
        isOverlayVisible = false
    }

    // MARK: - Cleanup
    func cleanup() {
        orbPanel?.close()
        overlayPanel?.close()
    }
}