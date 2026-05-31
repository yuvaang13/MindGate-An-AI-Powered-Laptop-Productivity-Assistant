import SwiftUI

struct OrbView: View {
    weak var windowManager: WindowManager?
    let decisionEngine: DecisionEngine

    init(windowManager: WindowManager?, decisionEngine: DecisionEngine) {
        self.windowManager = windowManager
        self.decisionEngine = decisionEngine
    }

    var body: some View {
        ZStack {
            if windowManager?.isOrbExpanded ?? false {
                ChatView(windowManager: windowManager, decisionEngine: decisionEngine)
                    .frame(width: Configuration.Dimensions.orbExpandedWidth, height: Configuration.Dimensions.orbExpandedHeight)
            } else {
                MindGateOrb(size: Configuration.Dimensions.orbSize, presentation: .compact)
                    .frame(width: Configuration.Dimensions.orbSize, height: Configuration.Dimensions.orbSize)
                    .contentShape(Circle())
                    .onTapGesture {
                        withAnimation(.easeInOut(duration: Configuration.Animation.orbTransitionDuration)) {
                            windowManager?.expandOrb()
                        }
                    }
            }
        }
    }
}

struct MindGateOrb: View {
    enum Presentation {
        case compact
        case interface
    }

    let size: CGFloat
    var presentation: Presentation = .compact
    var palette: MindGateOrbPalette = .mindGate

    // Tweak these three values to change the life of the orb without touching the layer math.
    private let breathDuration: TimeInterval = 3.8
    private let breathScale: CGFloat = 0.022
    private let highlightTravel: CGFloat = 0.035

    @State private var breath: CGFloat = 0

    var body: some View {
        ZStack {
            OrbAmbientBackground(size: size, palette: palette, breath: breath)
            OrbCoreBody(size: size, palette: palette, breath: breath)
            OrbForegroundHighlights(size: size, palette: palette, breath: breath, travel: highlightTravel)
        }
        .frame(width: size, height: size)
        .scaleEffect(1 + breath * breathScale)
        .opacity(0.96 + breath * 0.04)
        .drawingGroup(opaque: false, colorMode: .linear)
        .accessibilityLabel("MindGate AI orb")
        .onAppear(perform: startBreathing)
    }

    private func startBreathing() {
        let animation = Animation
            .timingCurve(0.42, 0.0, 0.18, 1.0, duration: breathDuration)
            .repeatForever(autoreverses: true)

        withAnimation(animation) {
            breath = 1
        }
    }
}

struct MindGateOrbPalette {
    // Edit these hex values for brand-level color tuning.
    let indigo = Color(hex: "#3F5BFF")
    let violet = Color(hex: "#7A2CFF")
    let deepViolet = Color(hex: "#160A36")
    let teal = Color(hex: "#00E6C3")
    let emerald = Color(hex: "#2AFFA8")
    let ink = Color(hex: "#050711")
    let glassWhite = Color.white

    static let mindGate = MindGateOrbPalette()
}

private struct OrbAmbientBackground: View {
    let size: CGFloat
    let palette: MindGateOrbPalette
    let breath: CGFloat

    var body: some View {
        ZStack {
            // Low-frequency glow that makes the panel feel embedded instead of pasted on.
            Circle()
                .fill(palette.indigo.opacity(0.2 + 0.08 * breath))
                .frame(width: size * 1.32, height: size * 1.32)
                .blur(radius: size * (0.14 + 0.025 * breath))

            Circle()
                .fill(palette.teal.opacity(0.18 + 0.07 * breath))
                .frame(width: size * 1.12, height: size * 1.12)
                .offset(x: size * 0.16, y: size * 0.12)
                .blur(radius: size * (0.12 + 0.018 * breath))

            Circle()
                .fill(palette.violet.opacity(0.18))
                .frame(width: size * 1.18, height: size * 1.18)
                .offset(x: -size * 0.18, y: -size * 0.12)
                .blur(radius: size * 0.16)

            Circle()
                .stroke(palette.glassWhite.opacity(0.14 + 0.06 * breath), lineWidth: 1)
                .frame(width: size * 0.99, height: size * 0.99)
                .blur(radius: size * 0.018)
        }
    }
}

private struct OrbCoreBody: View {
    let size: CGFloat
    let palette: MindGateOrbPalette
    let breath: CGFloat

    var body: some View {
        ZStack {
            Circle()
                .fill(.ultraThinMaterial)
                .overlay(coreColorField)
                .overlay(innerDepth)
                .overlay(crispRim)

            // A smaller refractive body gives the orb a layered glass interior.
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            palette.glassWhite.opacity(0.34),
                            palette.indigo.opacity(0.34),
                            palette.deepViolet.opacity(0.28),
                            Color.clear
                        ],
                        center: .topLeading,
                        startRadius: size * 0.02,
                        endRadius: size * 0.46
                    )
                )
                .padding(size * 0.13)
                .blur(radius: size * (0.006 + 0.006 * breath))
                .blendMode(.screen)
        }
        .clipShape(Circle())
    }

    private var coreColorField: some View {
        ZStack {
            Circle()
                .fill(
                    AngularGradient(
                        colors: [
                            palette.indigo.opacity(0.86),
                            palette.violet.opacity(0.78),
                            palette.deepViolet.opacity(0.94),
                            palette.teal.opacity(0.72),
                            palette.indigo.opacity(0.86)
                        ],
                        center: .center,
                        angle: .degrees(18 + 7 * Double(breath))
                    )
                )
                .opacity(0.92)

            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            palette.glassWhite.opacity(0.24 + 0.06 * breath),
                            palette.teal.opacity(0.15),
                            palette.ink.opacity(0.46)
                        ],
                        center: .topLeading,
                        startRadius: size * 0.03,
                        endRadius: size * 0.82
                    )
                )
                .blendMode(.screen)
        }
    }

    private var innerDepth: some View {
        ZStack {
            Circle()
                .stroke(palette.ink.opacity(0.38), lineWidth: size * 0.045)
                .blur(radius: size * 0.028)
                .offset(x: size * 0.018, y: size * 0.026)
                .mask(Circle().fill(LinearGradient(colors: [.clear, .black], startPoint: .topLeading, endPoint: .bottomTrailing)))

            Circle()
                .stroke(palette.glassWhite.opacity(0.18 + 0.08 * breath), lineWidth: size * 0.028)
                .blur(radius: size * 0.018)
                .offset(x: -size * 0.018, y: -size * 0.02)
                .mask(Circle().fill(LinearGradient(colors: [.black, .clear], startPoint: .topLeading, endPoint: .bottomTrailing)))
        }
    }

    private var crispRim: some View {
        Circle()
            .stroke(
                LinearGradient(
                    colors: [
                        palette.glassWhite.opacity(0.72),
                        palette.teal.opacity(0.42),
                        palette.violet.opacity(0.34),
                        palette.glassWhite.opacity(0.16)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                ),
                lineWidth: 0.8
            )
    }
}

private struct OrbForegroundHighlights: View {
    let size: CGFloat
    let palette: MindGateOrbPalette
    let breath: CGFloat
    let travel: CGFloat

    var body: some View {
        ZStack {
            softSpecular
            emeraldCaustic
            lowerGlassArc
        }
        .clipShape(Circle())
    }

    private var softSpecular: some View {
        Ellipse()
            .fill(
                RadialGradient(
                    colors: [
                        palette.glassWhite.opacity(0.72),
                        palette.glassWhite.opacity(0.24),
                        Color.clear
                    ],
                    center: .center,
                    startRadius: 0,
                    endRadius: size * 0.22
                )
            )
            .frame(width: size * 0.38, height: size * 0.24)
            .blur(radius: size * (0.016 + 0.012 * breath))
            .offset(
                x: -size * (0.19 - breath * travel),
                y: -size * (0.22 + breath * travel)
            )
            .blendMode(.screen)
    }

    private var emeraldCaustic: some View {
        Capsule()
            .fill(
                LinearGradient(
                    colors: [
                        palette.emerald.opacity(0.0),
                        palette.emerald.opacity(0.5 + 0.16 * breath),
                        palette.indigo.opacity(0.0)
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .frame(width: size * 0.74, height: max(size * 0.045, 2))
            .rotationEffect(.degrees(-26 + 5 * Double(breath)))
            .offset(x: size * 0.08, y: size * (0.06 - breath * 0.02))
            .blur(radius: size * 0.018)
            .blendMode(.screen)
    }

    private var lowerGlassArc: some View {
        Circle()
            .trim(from: 0.58, to: 0.88)
            .stroke(
                palette.glassWhite.opacity(0.32 + 0.08 * breath),
                style: StrokeStyle(lineWidth: max(size * 0.012, 0.8), lineCap: .round)
            )
            .rotationEffect(.degrees(8))
            .padding(size * 0.075)
            .blur(radius: size * 0.004)
            .blendMode(.screen)
    }
}

private extension Color {
    init(hex: String, alpha: Double = 1) {
        var value = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        if value.count == 3 {
            value = value.map { "\($0)\($0)" }.joined()
        }

        var integer: UInt64 = 0
        Scanner(string: value).scanHexInt64(&integer)

        let red = Double((integer >> 16) & 0xFF) / 255.0
        let green = Double((integer >> 8) & 0xFF) / 255.0
        let blue = Double(integer & 0xFF) / 255.0

        self.init(.sRGB, red: red, green: green, blue: blue, opacity: alpha)
    }
}
