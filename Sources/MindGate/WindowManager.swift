import Foundation
import AppKit
import SwiftUI
import OSLog

private final class FocusablePanel: NSPanel {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

@MainActor
class WindowManager: ObservableObject {
    private var orbPanel: NSPanel?
    private var overlayPanel: NSPanel?
    private var orbHostingController: NSHostingController<OrbView>?
    private var overlayHostingController: NSHostingController<OverlayView>?
    private let decisionEngine: DecisionEngine
    private let configuration: Configuration
    private let orbWindowLevel: NSWindow.Level = .screenSaver
    private let logger = Logger(subsystem: "com.mindgate.MindGate", category: "WindowManager")
    private var focusTimer: Timer?

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
            contentRect: NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1920, height: 1080),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )

        panel.isFloatingPanel = true
        panel.level = .screenSaver
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = false
        panel.contentView = overlayHostingController?.view
        panel.contentView?.wantsLayer = true
        panel.contentView?.layer?.backgroundColor = NSColor.clear.cgColor

        overlayPanel = panel
    }

    // MARK: - Positioning
    private func positionOrbPanel() {
        guard let screen = targetScreen() else { return }
        let screenFrame = screen.visibleFrame

        let panelWidth = isOrbExpanded ? configuration.theme.dimensions.orbExpandedWidth : configuration.theme.dimensions.orbSize
        let panelHeight = isOrbExpanded ? configuration.theme.dimensions.orbExpandedHeight : configuration.theme.dimensions.orbSize

        // Position panel on upper left edge
        let xOffset: CGFloat = isOrbExpanded ? configuration.theme.dimensions.orbXOffset + 6 : configuration.theme.dimensions.orbXOffset
        let yOffset: CGFloat = isOrbExpanded ? configuration.theme.dimensions.orbYOffset : configuration.theme.dimensions.orbYOffset
        
        // Add +50px offset when distraction is detected
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
        panel.level = orbWindowLevel
        panel.alphaValue = 1
        panel.ignoresMouseEvents = false
        panel.setFrame(panel.frame, display: true)
        panel.contentView?.layoutSubtreeIfNeeded()
        panel.orderFrontRegardless()

        if isOrbExpanded {
            NSApplication.shared.activate(ignoringOtherApps: true)
            panel.makeKeyAndOrderFront(nil)
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
        startFocusPolling()
    }

    func hideOrb() {
        orbPanel?.orderOut(nil)
        isOrbExpanded = false
        isDistractionDetected = false
        refreshOrbView()
        // Stop focus polling
        focusTimer?.invalidate()
        focusTimer = nil
    }

    func expandOrb() {
        isOrbExpanded = true
        refreshOrbView()
        positionOrbPanel()

        if let orbPanel {
            presentOrbPanel(orbPanel)
            // Start aggressive focus polling
            startFocusPolling()
        }
    }
    
    private func startFocusPolling() {
        focusTimer?.invalidate()
        focusTimer = Timer.scheduledTimer(withTimeInterval: 0.1, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.pollForFirstResponder()
            }
        }
    }
    
    private func pollForFirstResponder() {
        guard let panel = orbPanel,
              let contentView = panel.contentView,
              let scrollView = contentView.subviews.first(where: { $0 is NSScrollView }),
              let textView = (scrollView as? NSScrollView)?.documentView as? NSTextView else {
            return
        }
        
        if panel.firstResponder !== textView {
            panel.makeKey()
            panel.makeFirstResponder(textView)
        }
    }

    func collapseOrb() {
        isOrbExpanded = false
        isDistractionDetected = false
        positionOrbPanel()
        refreshOrbView()
        // Stop focus polling
        focusTimer?.invalidate()
        focusTimer = nil
    }

    // MARK: - Overlay Control
    func showOverlay() {
        guard let screen = NSScreen.main else { return }
        overlayPanel?.setFrame(screen.frame, display: true)
        overlayPanel?.orderFrontRegardless()
        isOverlayVisible = true
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
