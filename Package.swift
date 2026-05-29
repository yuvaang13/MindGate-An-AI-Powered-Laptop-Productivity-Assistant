// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MindGate",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(
            name: "MindGate",
            targets: ["MindGate"]
        ),
    ],
    targets: [
        .executableTarget(
            name: "MindGate",
            dependencies: [],
            path: "Sources/MindGate",
            exclude: ["Info.plist"],
            resources: [
                .process("Info.plist")
            ],
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("Foundation"),
                .linkedFramework("SwiftUI")
            ]
        ),
    ]
)
