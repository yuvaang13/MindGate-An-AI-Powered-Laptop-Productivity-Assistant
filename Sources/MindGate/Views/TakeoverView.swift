import SwiftUI

struct TakeoverView: View {
    let configuration: Configuration
    weak var windowManager: WindowManager?
    let decisionEngine: DecisionEngine

    var body: some View {
        VStack(spacing: 20) {
            VStack(spacing: 6) {
                Text("Time to Refocus")
                    .font(.system(size: 24, weight: .bold, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.white, Color.white.opacity(0.7)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                Text("Your work is waiting for you.")
                    .font(.system(size: 14, weight: .medium, design: .rounded))
                    .foregroundColor(Color.white.opacity(0.6))
            }

            VStack(alignment: .leading, spacing: 10) {
                Text("Productive Suggestions:")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundColor(Color.white.opacity(0.8))

                ScrollView {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(configuration.settings.productiveTasks, id: \.self) { task in
                            HStack(alignment: .top, spacing: 6) {
                                Circle()
                                    .fill(Color(hex: configuration.theme.colors.warning))
                                    .frame(width: 5, height: 5)
                                    .padding(.top, 4)
                                Text(task)
                                    .font(.system(size: 13, weight: .regular, design: .rounded))
                                    .foregroundColor(Color.white.opacity(0.75))
                                    .lineLimit(2)
                            }
                        }
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Color.white.opacity(0.07))
                            .background(.ultraThinMaterial.opacity(0.35))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(Color.white.opacity(0.14), lineWidth: 0.8)
                    )
                }
                .frame(maxHeight: 150)
            }

            VStack(spacing: 10) {
                HStack(spacing: 10) {
                    Button(action: openNewBrowserTab) {
                        Label("New Tab", systemImage: "safari.fill")
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(LiquidGlassButtonStyle())

                    Button(action: openProductiveApp) {
                        Label("Open App", systemImage: "app.fill")
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(LiquidGlassButtonStyle())
                }

                Button(action: {
                    windowManager?.hideOrb()
                }) {
                    Text("Dismiss & Return to Work")
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(LiquidGlassButtonStyle())
            }
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.18),
                            Color.white.opacity(0.08),
                            Color.black.opacity(0.12)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .background(.ultraThinMaterial.opacity(0.4))
                .overlay(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .stroke(Color.white.opacity(0.2), lineWidth: 0.8)
                )
                .shadow(color: Color.black.opacity(0.3), radius: 20, x: 0, y: 8)
        )
    }

    private func openNewBrowserTab() {
        if let url = URL(string: "https://www.google.com") {
            NSWorkspace.shared.open(url)
            windowManager?.hideOrb()
        }
    }

    private func openProductiveApp() {
        if let appName = configuration.settings.productiveApps.randomElement() {
            if let url = URL(string: "file:///Applications/\(appName).app") {
                let configuration = NSWorkspace.OpenConfiguration()
                NSWorkspace.shared.openApplication(at: url, configuration: configuration) { _, error in
                    if let error = error {
                        print("Failed to launch app: \(error.localizedDescription)")
                    }
                }
            }
            windowManager?.hideOrb()
        }
    }
}

struct LiquidGlassButtonStyle: ButtonStyle {
    func makeBody(configuration: Self.Configuration) -> some View {
        configuration.label
            .foregroundStyle(Color.white)
            .padding(.horizontal, 12)
            .frame(height: 34)
                    .background(
                        RoundedRectangle(cornerRadius: 16, style: .continuous)
                            .fill(
                                LinearGradient(
                                    colors: [
                                        Color.white.opacity(0.16),
                                        Color.white.opacity(0.10),
                                        Color.white.opacity(0.04)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .background(.ultraThinMaterial.opacity(0.45))
                            .overlay(
                                RoundedRectangle(cornerRadius: 16, style: .continuous)
                                    .stroke(Color.white.opacity(0.22), lineWidth: 0.8)
                            )
                    )
            .scaleEffect(configuration.isPressed ? 0.95 : 1)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}