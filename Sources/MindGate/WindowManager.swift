import Foundation
import AppKit
import SwiftUI

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
    private let orbWindowLevel: NSWindow.Level = .screenSaver

    @Published var isOrbExpanded = false
    @Published var isOverlayVisible = false

    init(decisionEngine: DecisionEngine) {
        self.decisionEngine = decisionEngine
        setupOrbPanel()
        setupOverlayPanel()
    }

    // MARK: - Orb Panel Setup
    private func setupOrbPanel() {
        let orbView = OrbView(windowManager: self, decisionEngine: decisionEngine)

        orbHostingController = NSHostingController(rootView: orbView)

        let panel = FocusablePanel(
            contentRect: NSRect(x: 0, y: 0, width: Configuration.Dimensions.orbSize, height: Configuration.Dimensions.orbSize),
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

        print("🔧 Orb panel setup complete")
    }

    // MARK: - Overlay Panel Setup
    private func setupOverlayPanel() {
        let overlayView = OverlayView()

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

        let orbSize = isOrbExpanded ? Configuration.Dimensions.orbExpandedWidth : Configuration.Dimensions.orbSize
        let orbHeight = isOrbExpanded ? Configuration.Dimensions.orbExpandedHeight : Configuration.Dimensions.orbSize

        // Position orb on upper middle left edge when compact
        let xOffset: CGFloat = isOrbExpanded ? 18 : orbSize * 0.5
        let yOffset: CGFloat = isOrbExpanded ? 12 : orbSize * 0.5
        let x = screenFrame.minX - xOffset
        let y = screenFrame.maxY - orbHeight - yOffset - 100

        let contentSize = NSSize(width: orbSize, height: orbHeight)
        let frame = NSRect(origin: NSPoint(x: x, y: y), size: contentSize)

        orbPanel?.setFrame(frame, display: true)
        applyOrbPanelShape(size: contentSize)
    }

    private func refreshOrbView() {
        orbHostingController?.rootView = OrbView(windowManager: self, decisionEngine: decisionEngine)
    }

    private func applyOrbPanelShape(size: NSSize) {
        guard let contentView = orbPanel?.contentView else { return }

        contentView.wantsLayer = true
        contentView.frame = NSRect(origin: .zero, size: size)
        contentView.layer?.backgroundColor = NSColor.clear.cgColor
        contentView.layer?.cornerRadius = min(size.width, size.height) / 2
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
        panel.orderFrontRegardless()

        NSApplication.shared.activate(ignoringOtherApps: true)
        panel.makeKeyAndOrderFront(nil)
        panel.orderFrontRegardless()
        panel.displayIfNeeded()

        let isOnAnyScreen = NSScreen.screens.contains { screen in
            screen.frame.intersects(panel.frame)
        }

        if panel.isVisible && isOnAnyScreen {
            print("✅ Orb visible at frame: \(panel.frame), level: \(panel.level.rawValue)")
        } else {
            print("❌ Orb presentation failed. isVisible=\(panel.isVisible), isOnAnyScreen=\(isOnAnyScreen), frame=\(panel.frame)")
        }
    }

    // MARK: - Orb Control
    func showOrb() {
        print("🔮 Showing Orb...")
        isOrbExpanded = false
        positionOrbPanel()
        refreshOrbView()

        guard let panel = orbPanel else {
            print("❌ Orb panel is nil")
            return
        }

        presentOrbPanel(panel)
    }

    func hideOrb() {
        orbPanel?.orderOut(nil)
        isOrbExpanded = false
        refreshOrbView()
    }

    func expandOrb() {
        isOrbExpanded = true
        positionOrbPanel()
        refreshOrbView()

        if let orbPanel {
            presentOrbPanel(orbPanel)
        }
    }

    func collapseOrb() {
        isOrbExpanded = false
        positionOrbPanel()
        refreshOrbView()
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
