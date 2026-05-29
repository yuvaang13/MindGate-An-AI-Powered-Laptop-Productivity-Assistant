import Foundation
import AppKit
import SwiftUI

@MainActor
class WindowManager: ObservableObject {
    private var orbPanel: NSPanel?
    private var overlayPanel: NSPanel?
    private var orbHostingController: NSHostingController<OrbView>?
    private var overlayHostingController: NSHostingController<OverlayView>?
    
    @Published var isOrbExpanded = false
    @Published var isOverlayVisible = false
    
    init() {
        setupOrbPanel()
        setupOverlayPanel()
    }
    
    // MARK: - Orb Panel Setup
    private func setupOrbPanel() {
        let orbView = OrbView()
        orbView.windowManager = self
        
        orbHostingController = NSHostingController(rootView: orbView)
        
        let panel = NSPanel(
            contentRect: NSRect(x: 0, y: 0, width: Configuration.Dimensions.orbSize, height: Configuration.Dimensions.orbSize),
            styleMask: [.borderless],
            backing: .buffered,
            defer: false
        )
        
        panel.isFloatingPanel = true
        panel.level = .mainMenu
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .ignoresCycle]
        panel.backgroundColor = .clear
        panel.isOpaque = false
        panel.hasShadow = false
        panel.contentView = orbHostingController?.view
        panel.contentView?.wantsLayer = true
        panel.contentView?.layer?.backgroundColor = NSColor.clear.cgColor
        
        orbPanel = panel
        positionOrbPanel()
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
        
        let x = screenFrame.maxX - orbSize - 20
        let y = screenFrame.maxY - orbHeight - 20
        
        orbPanel?.setFrameOrigin(NSPoint(x: x, y: y))
        
        if isOrbExpanded {
            orbPanel?.setContentSize(NSSize(width: Configuration.Dimensions.orbExpandedWidth, height: Configuration.Dimensions.orbExpandedHeight))
        } else {
            orbPanel?.setContentSize(NSSize(width: Configuration.Dimensions.orbSize, height: Configuration.Dimensions.orbSize))
        }
    }
    
    // MARK: - Orb Control
    func showOrb() {
        positionOrbPanel()
        orbPanel?.orderFrontRegardless()
    }
    
    func hideOrb() {
        orbPanel?.orderOut(nil)
        isOrbExpanded = false
    }
    
    func expandOrb() {
        isOrbExpanded = true
        positionOrbPanel()
        orbPanel?.orderFrontRegardless()
    }
    
    func collapseOrb() {
        isOrbExpanded = false
        positionOrbPanel()
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
