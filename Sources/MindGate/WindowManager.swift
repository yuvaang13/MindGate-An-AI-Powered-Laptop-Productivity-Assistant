import Foundation
import AppKit
import SwiftUI
import OSLog
import ApplicationServices
import CoreGraphics

private final class OrbWindowDelegate: NSObject, NSWindowDelegate {
    private weak var textView: NSTextView?

    init(textView: NSTextView?) {
        self.textView = textView
    }

    func windowDidBecomeKey(_ notification: Notification) {
        guard let textView = textView else { return }
        guard let window = notification.object as? NSWindow else { return }
        NSApp.activate(ignoringOtherApps: true)
        DispatchQueue.main.async {
            window.makeFirstResponder(textView)
        }
    }

    func windowDidResignKey(_ notification: Notification) {
        // Let the user click away without fighting them
    }
}

private final class FocusablePanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
    override var acceptsFirstResponder: Bool { true }
}

private final class OverlayPanel: NSPanel {
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
    private let configurationManager: ConfigurationManager
    private let orbWindowLevel: NSWindow.Level = .popUpMenu
    private let logger = Logger(subsystem: "com.mindgate.MindGate", category: "WindowManager")
    private var orbWindowDelegate: OrbWindowDelegate?
    private var observedOrbTextView: NSTextView?
    weak var targetApp: NSRunningApplication?
    private var targetWindowFrame: NSRect?
    @Published var isOrbExpanded = false
    @Published var isOverlayVisible = false
    @Published var isDistractionDetected = false

    init(decisionEngine: DecisionEngine, configurationManager: ConfigurationManager) {
        self.decisionEngine = decisionEngine
        self.configurationManager = configurationManager
        setupOrbPanel()
        setupOverlayPanel()
    }

    private func setupOrbPanel() {
        let orbView = OrbView(
            windowManager: self,
            decisionEngine: decisionEngine,
            configurationManager: configurationManager,
            isExpanded: isOrbExpanded
        )
        orbHostingController = NSHostingController(rootView: orbView)
        let panel = FocusablePanel(
            contentRect: NSRect(x: 0, y: 0, width: configurationManager.configuration.theme.dimensions.orbSize, height: configurationManager.configuration.theme.dimensions.orbSize),
            styleMask: .borderless,
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
        let containerView = NSView(frame: panel.contentLayoutRect)
        containerView.wantsLayer = true
        containerView.layer?.backgroundColor = NSColor.clear.cgColor
        let visualEffectView = NSVisualEffectView(frame: containerView.bounds)
        visualEffectView.material = .underWindowBackground
        visualEffectView.blendingMode = .behindWindow
        visualEffectView.state = .active
        visualEffectView.autoresizingMask = [.width, .height]
        let hostingView = orbHostingController!.view
        hostingView.frame = containerView.bounds
        hostingView.autoresizingMask = [.width, .height]
        hostingView.wantsLayer = true
        hostingView.layer?.backgroundColor = NSColor.clear.cgColor
        containerView.addSubview(visualEffectView)
        containerView.addSubview(hostingView, positioned: .above, relativeTo: visualEffectView)
        panel.contentView = containerView
        orbPanel = panel
        positionOrbPanel()
    }

    private func setupOverlayPanel() {
        let overlayView = OverlayView(configurationManager: configurationManager)
        overlayHostingController = NSHostingController(rootView: overlayView)
        let panel = OverlayPanel(
            contentRect: NSRect(x: 0, y: 0, width: 1920, height: 1080),
            styleMask: .borderless,
            backing: .buffered,
            defer: false
        )
        panel.isFloatingPanel = true
        panel.level = .screenSaver + 1
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle, .stationary]
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = false
        panel.ignoresMouseEvents = true
        panel.isExcludedFromWindowsMenu = true
        panel.hidesOnDeactivate = false
        panel.acceptsMouseMovedEvents = false
        panel.alphaValue = 1.0
        let containerView = NSView(frame: panel.contentLayoutRect)
        containerView.wantsLayer = true
        containerView.layer?.backgroundColor = NSColor.clear.cgColor
        let visualEffectView = NSVisualEffectView(frame: containerView.bounds)
        visualEffectView.material = .underWindowBackground
        visualEffectView.blendingMode = .behindWindow
        visualEffectView.state = .active
        visualEffectView.autoresizingMask = [.width, .height]
        containerView.addSubview(visualEffectView)
        if let hostingView = overlayHostingController?.view {
            hostingView.frame = containerView.bounds
            hostingView.autoresizingMask = [.width, .height]
            containerView.addSubview(hostingView, positioned: .above, relativeTo: visualEffectView)
        }
        panel.contentView = containerView
        overlayPanel = panel
    }

    private func positionOrbPanel() {
        guard let screen = targetScreen() else { return }
        let screenFrame = screen.visibleFrame
        let panelWidth = isOrbExpanded ? configurationManager.configuration.theme.dimensions.orbExpandedWidth : configurationManager.configuration.theme.dimensions.orbSize
        let panelHeight = isOrbExpanded ? configurationManager.configuration.theme.dimensions.orbExpandedHeight : configurationManager.configuration.theme.dimensions.orbSize
        let xOffset: CGFloat = isOrbExpanded ? configurationManager.configuration.theme.dimensions.orbXOffset + 6 : configurationManager.configuration.theme.dimensions.orbXOffset
        let yOffset: CGFloat = isOrbExpanded ? configurationManager.configuration.theme.dimensions.orbYOffset : configurationManager.configuration.theme.dimensions.orbYOffset
        let distractionOffset: CGFloat = isDistractionDetected ? configurationManager.configuration.theme.dimensions.orbDistractionOffset : 0
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
            configurationManager: configurationManager,
            isExpanded: isOrbExpanded
        )
        orbHostingController?.view.frame = orbPanel?.frame ?? .zero
        orbHostingController?.view.needsLayout = true
    }

    private func applyOrbPanelShape(size: NSSize) {
        guard let contentView = orbPanel?.contentView else { return }
        contentView.wantsLayer = true
        contentView.frame = NSRect(origin: .zero, size: size)
        contentView.layer?.cornerRadius = 16
        contentView.layer?.cornerCurve = .continuous
        contentView.layer?.masksToBounds = true
        for subview in contentView.subviews {
            subview.frame = contentView.bounds
            subview.layer?.cornerRadius = 16
            subview.layer?.cornerCurve = .continuous
        }
        contentView.layer?.backgroundColor = NSColor.clear.cgColor
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
            logger.info(" Orb visible at frame: \(panel.frame.debugDescription), level: \(panel.level.rawValue)")
        } else {
            logger.error(" Orb presentation failed. isVisible=\(panel.isVisible), isOnAnyScreen=\(isOnAnyScreen), frame=\(panel.frame.debugDescription)")
        }
    }

    func showOrb() {
        logger.info(" Showing Orb...")
        isDistractionDetected = true
        isOrbExpanded = true
        if let app = targetApp {
            targetWindowFrame = getTargetAppWindowFrameWithFallback(app: app)
        }
        if let storedFrame = targetWindowFrame {
            logger.info("Captured target window frame at distraction time: \(storedFrame.debugDescription)")
        }
        refreshOrbView()
        positionOrbPanel()
        guard let panel = orbPanel else {
            logger.error(" Orb panel is nil")
            return
        }
        presentOrbPanel(panel)
    }

    func hideOrb() {
        orbPanel?.orderOut(nil)
        isOrbExpanded = false
        isDistractionDetected = false
        targetWindowFrame = nil
        refreshOrbView()
        orbWindowDelegate = nil
        observedOrbTextView = nil
    }

    func expandOrb() {
        isOrbExpanded = true
        refreshOrbView()
        positionOrbPanel()
        if let orbPanel {
            presentOrbPanel(orbPanel)
        }
    }

    func registerOrbTextView(_ textView: NSTextView) {
        orbWindowDelegate = OrbWindowDelegate(textView: textView)
        orbPanel?.delegate = orbWindowDelegate
        observedOrbTextView = textView
    }

    func collapseOrb() {
        isOrbExpanded = false
        isDistractionDetected = false
        positionOrbPanel()
        refreshOrbView()
        orbWindowDelegate = nil
        observedOrbTextView = nil
    }

    func showOverlay() {
        let targetFrame: NSRect
        if let storedFrame = targetWindowFrame {
            targetFrame = storedFrame
            logger.info("Using captured target window frame: \(targetFrame.debugDescription)")
        } else if let targetApp = targetApp {
            targetFrame = getTargetAppWindowFrameWithFallback(app: targetApp)
            logger.info("Using fresh app window frame: \(targetFrame.debugDescription)")
        } else {
            let mouseLocation = NSEvent.mouseLocation
            let screen = NSScreen.screens.first { screen in
                NSMouseInRect(mouseLocation, screen.frame, false)
            } ?? NSScreen.main ?? NSScreen.screens.first
            targetFrame = screen?.frame ?? NSRect(x: 0, y: 0, width: 1920, height: 1080)
            logger.warning("No target app, using screen frame: \(targetFrame.debugDescription)")
        }
        guard let panel = overlayPanel else {
            logger.error("Overlay panel is nil")
            return
        }
        panel.level = .screenSaver + 1
        panel.setFrame(targetFrame, display: true)
        if let containerView = panel.contentView {
            containerView.frame = targetFrame
            if let hostingView = overlayHostingController?.view {
                hostingView.frame = targetFrame
            }
        }
        NSApp.activate(ignoringOtherApps: true)
        panel.orderFrontRegardless()
        panel.makeKeyAndOrderFront(nil)
        panel.alphaValue = 1.0
        panel.displayIfNeeded()
        isOverlayVisible = true
        logger.info("Overlay visibility check: isVisible=\(panel.isVisible), frame=\(panel.frame.debugDescription), level=\(panel.level.rawValue), screenCount=\(NSScreen.screens.count)")
    }

    private func getTargetAppWindowFrame(app: NSRunningApplication) -> NSRect? {
        let appElement = AXUIElementCreateApplication(app.processIdentifier)
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
                return NSRect(x: point.x, y: point.y, width: windowSize.width, height: windowSize.height)
            }
        }
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
                return NSRect(x: point.x, y: point.y, width: windowSize.width, height: windowSize.height)
            }
        }
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
                    if NSMouseInRect(mouseLocation, windowFrame, false) {
                        return windowFrame
                    }
                }
            }
            if let firstWindow = windows.first {
                var positionRef: CFTypeRef?
                var sizeRef: CFTypeRef?
                AXUIElementCopyAttributeValue(firstWindow, kAXPositionAttribute as CFString, &positionRef)
                AXUIElementCopyAttributeValue(firstWindow, kAXSizeAttribute as CFString, &sizeRef)
                if let position = positionRef as? NSValue,
                   let size = sizeRef as? NSValue {
                    let point = position.pointValue
                    let windowSize = size.sizeValue
                    return NSRect(x: point.x, y: point.y, width: windowSize.width, height: windowSize.height)
                }
            }
        }
        let mouseLocation = NSEvent.mouseLocation
        let screen = NSScreen.screens.first { screen in
            NSMouseInRect(mouseLocation, screen.frame, false)
        } ?? NSScreen.main ?? NSScreen.screens.first
        logger.warning("Could not get window frame, using screen frame: \(screen?.frame.debugDescription ?? "nil")")
        return screen?.frame ?? NSRect(x: 0, y: 0, width: 1920, height: 1080)
    }

    private func getTargetAppWindowFrameCG(app: NSRunningApplication) -> NSRect? {
        guard let windowList = CGWindowListCreateDescriptionFromArray(nil) else { return nil }
        let windows = windowList as NSArray as? [NSDictionary] ?? []
        let appPID = app.processIdentifier
        let mouseLocation = NSEvent.mouseLocation
        for window in windows where window["ownerPID"] as? pid_t == appPID {
            guard let boundsDict = window["bounds"] as? [String: NSNumber],
                  let layer = window["layer"] as? Int,
                  layer >= 0 else { continue }
            let x = boundsDict["X"]?.doubleValue ?? 0
            let y = boundsDict["Y"]?.doubleValue ?? 0
            let width = boundsDict["Width"]?.doubleValue ?? 0
            let height = boundsDict["Height"]?.doubleValue ?? 0
            let windowFrame = NSRect(x: x, y: y, width: width, height: height)
            if layer == 0 && NSMouseInRect(mouseLocation, windowFrame, false) {
                return windowFrame
            }
        }
        for window in windows where window["ownerPID"] as? pid_t == appPID {
            guard let layer = window["layer"] as? Int,
                  layer == 0,
                  let boundsDict = window["bounds"] as? [String: NSNumber] else { continue }
            let x = boundsDict["X"]?.doubleValue ?? 0
            let y = boundsDict["Y"]?.doubleValue ?? 0
            let width = boundsDict["Width"]?.doubleValue ?? 0
            let height = boundsDict["Height"]?.doubleValue ?? 0
            return NSRect(x: x, y: y, width: width, height: height)
        }
        return nil
    }

    private func getTargetAppWindowFrameWithFallback(app: NSRunningApplication) -> NSRect {
        if let axFrame = getTargetAppWindowFrame(app: app) { return axFrame }
        if let cgFrame = getTargetAppWindowFrameCG(app: app) { return cgFrame }
        let mouseLocation = NSEvent.mouseLocation
        let screen = NSScreen.screens.first { screen in
            NSMouseInRect(mouseLocation, screen.frame, false)
        } ?? NSScreen.main ?? NSScreen.screens.first
        return screen?.frame ?? NSRect(x: 0, y: 0, width: 1920, height: 1080)
    }

    func hideOverlay() {
        overlayPanel?.orderOut(nil)
        isOverlayVisible = false
    }

    func cleanup() {
        orbPanel?.close()
        overlayPanel?.close()
    }
}
