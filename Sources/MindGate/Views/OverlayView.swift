import SwiftUI
import AppKit

struct OverlayView: View {
    let configurationManager: ConfigurationManager
    var aiMessage: String?
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                Color.black.opacity(0.25)
                    .ignoresSafeArea()

                VStack(spacing: 24) {
                    liquidGlassContent
                        .padding(40)
                }
                .frame(width: 400, height: 300)
                .background(
                    RoundedRectangle(cornerRadius: 28, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.18),
                                    Color.white.opacity(0.08),
                                    Color.white.opacity(0.02),
                                    Color.clear
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 28, style: .continuous)
                                .fill(
                                    RadialGradient(
                                        colors: [
                                            Color.white.opacity(0.25),
                                            Color.clear
                                        ],
                                        center: UnitPoint(x: 0.3, y: 0.3),
                                        startRadius: 0,
                                        endRadius: 120
                                    )
                                )
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 28, style: .continuous)
                                .stroke(
                                    LinearGradient(
                                        colors: [
                                            Color.white.opacity(0.25),
                                            Color.white.opacity(0.10),
                                            .clear
                                        ],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    ),
                                    lineWidth: 1.0
                                )
                        )
                        .shadow(color: Color.black.opacity(0.25), radius: 30, x: 0, y: 10)
                )
            }
            .frame(width: geometry.size.width, height: geometry.size.height)
            .drawingGroup(opaque: false, colorMode: .linear)
        }
    }

    private var liquidGlassContent: some View {
        VStack(spacing: 20) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 70, weight: .medium))
                .foregroundStyle(
                    LinearGradient(
                        colors: [
                            Color(hex: configurationManager.configuration.theme.colors.error),
                            Color(hex: configurationManager.configuration.theme.colors.warning)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .shadow(color: Color(hex: configurationManager.configuration.theme.colors.error).opacity(0.4), radius: 20)
                .symbolEffect(.pulse.wholeSymbol, options: .speed(2))

            Text(aiMessage ?? "Access Denied")
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(
                    LinearGradient(
                        colors: [.white, Color.white.opacity(0.7)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            Text("Return to your work")
                .font(.system(size: 16, weight: .medium, design: .rounded))
                .foregroundColor(Color.white.opacity(0.6))

            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: Color(hex: configurationManager.configuration.theme.colors.warning)))
                .scaleEffect(1.5)
        }
    }
}