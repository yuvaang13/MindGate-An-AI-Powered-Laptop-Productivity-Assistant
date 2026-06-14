import SwiftUI
import AppKit
import Foundation

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let delegate = AppDelegate()
app.delegate = delegate

signal(SIGINT) { _ in
    DispatchQueue.main.async {
        app.terminate(nil)
    }
}

signal(SIGTERM) { _ in
    DispatchQueue.main.async {
        app.terminate(nil)
    }
}

app.run()