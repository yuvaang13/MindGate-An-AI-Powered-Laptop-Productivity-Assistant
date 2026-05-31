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
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
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
        guard let screen = NSScreen.main else { return }
        let screenFrame = screen.visibleFrame

        let orbSize = isOrbExpanded ? Configuration.Dimensions.orbExpandedWidth : Configuration.Dimensions.orbSize
        let orbHeight = isOrbExpanded ? Configuration.Dimensions.orbExpandedHeight : Configuration.Dimensions.orbSize

        let xOffset: CGFloat = isOrbExpanded ? 34 : 14
        let yOffset: CGFloat = isOrbExpanded ? 22 : 14
        let x = screenFrame.maxX - orbSize + xOffset
        let y = screenFrame.maxY - orbHeight + yOffset

        orbPanel?.setFrameOrigin(NSPoint(x: x, y: y))

        let contentSize = NSSize(width: orbSize, height: orbHeight)

        orbPanel?.setContentSize(contentSize)
        applyOrbPanelShape(size: contentSize)
    }

    private func refreshOrbView() {
        orbHostingController?.rootView = OrbView(windowManager: self, decisionEngine: decisionEngine)
    }

    private func applyOrbPanelShape(size: NSSize) {
        guard let contentView = orbPanel?.contentView else { return }

        contentView.wantsLayer = true
        contentView.layer?.backgroundColor = NSColor.clear.cgColor
        contentView.layer?.cornerRadius = min(size.width, size.height) / 2
        contentView.layer?.cornerCurve = .continuous
        contentView.layer?.masksToBounds = true
    }

    // MARK: - Orb Control
    func showOrb() {
        print("🔮 Showing Orb...")
        isOrbExpanded = true
        positionOrbPanel()
        refreshOrbView()

        guard let panel = orbPanel else {
            print("❌ Orb panel is nil")
            return
        }

        panel.level = .floating
        NSApplication.shared.activate(ignoringOtherApps: true)
        panel.makeKeyAndOrderFront(nil)

        print("✅ Orb displayed at frame: \(panel.frame)")
        print("📐 Screen frame: \(NSScreen.main?.frame ?? .zero)")
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
        NSApplication.shared.activate(ignoringOtherApps: true)
        orbPanel?.makeKeyAndOrderFront(nil)
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
