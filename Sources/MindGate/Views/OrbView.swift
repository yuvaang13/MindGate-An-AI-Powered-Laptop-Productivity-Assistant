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
    private let breathDuration: TimeInterval = 2.5
    private let breathScale: CGFloat = 0.035
    private let highlightTravel: CGFloat = 0.05

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
    // Premium color palette with vibrant, modern colors
    let indigo = Color(hex: "#6366F1")
    let violet = Color(hex: "#8B5CF6")
    let deepViolet = Color(hex: "#1E1B4B")
    let teal = Color(hex: "#14B8A6")
    let emerald = Color(hex: "#10B981")
    let cyan = Color(hex: "#06B6D4")
    let pink = Color(hex: "#EC4899")
    let ink = Color(hex: "#0F172A")
    let glassWhite = Color.white

    static let mindGate = MindGateOrbPalette()
}

private struct OrbAmbientBackground: View {
    let size: CGFloat
    let palette: MindGateOrbPalette
    let breath: CGFloat

    var body: some View {
        ZStack {
            // Enhanced low-frequency glow for premium feel
            Circle()
                .fill(palette.indigo.opacity(0.3 + 0.12 * breath))
                .frame(width: size * 1.45, height: size * 1.45)
                .blur(radius: size * (0.18 + 0.035 * breath))

            Circle()
                .fill(palette.cyan.opacity(0.25 + 0.1 * breath))
                .frame(width: size * 1.25, height: size * 1.25)
                .offset(x: size * 0.18, y: size * 0.14)
                .blur(radius: size * (0.15 + 0.025 * breath))

            Circle()
                .fill(palette.pink.opacity(0.2 + 0.08 * breath))
                .frame(width: size * 1.3, height: size * 1.3)
                .offset(x: -size * 0.2, y: -size * 0.14)
                .blur(radius: size * 0.18)

            Circle()
                .fill(palette.violet.opacity(0.15 + 0.05 * breath))
                .frame(width: size * 1.15, height: size * 1.15)
                .blur(radius: size * 0.12)

            Circle()
                .stroke(palette.glassWhite.opacity(0.18 + 0.08 * breath), lineWidth: 1.2)
                .frame(width: size * 0.98, height: size * 0.98)
                .blur(radius: size * 0.02)
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
                            palette.indigo.opacity(0.92),
                            palette.violet.opacity(0.88),
                            palette.pink.opacity(0.82),
                            palette.cyan.opacity(0.85),
                            palette.deepViolet.opacity(0.94),
                            palette.indigo.opacity(0.92)
                        ],
                        center: .center,
                        angle: .degrees(18 + 9 * Double(breath))
                    )
                )
                .opacity(0.95)

            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            palette.glassWhite.opacity(0.32 + 0.08 * breath),
                            palette.cyan.opacity(0.22),
                            palette.ink.opacity(0.52)
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
            cyanCaustic
            lowerGlassArc
        }
        .clipShape(Circle())
    }

    private var softSpecular: some View {
        Ellipse()
            .fill(
                RadialGradient(
                    colors: [
                        palette.glassWhite.opacity(0.85),
                        palette.glassWhite.opacity(0.32),
                        Color.clear
                    ],
                    center: .center,
                    startRadius: 0,
                    endRadius: size * 0.25
                )
            )
            .frame(width: size * 0.42, height: size * 0.28)
            .blur(radius: size * (0.02 + 0.015 * breath))
            .offset(
                x: -size * (0.2 - breath * travel),
                y: -size * (0.24 + breath * travel)
            )
            .blendMode(.screen)
    }

    private var emeraldCaustic: some View {
        Capsule()
            .fill(
                LinearGradient(
                    colors: [
                        palette.emerald.opacity(0.0),
                        palette.emerald.opacity(0.6 + 0.2 * breath),
                        palette.indigo.opacity(0.0)
                    ],
                    startPoint: .leading,
                    endPoint: .trailing
                )
            )
            .frame(width: size * 0.78, height: max(size * 0.05, 2))
            .rotationEffect(.degrees(-26 + 6 * Double(breath)))
            .offset(x: size * 0.1, y: size * (0.07 - breath * 0.025))
            .blur(radius: size * 0.02)
            .blendMode(.screen)
    }

    private var cyanCaustic: some View {
        Capsule()
            .fill(
                LinearGradient(
                    colors: [
                        palette.cyan.opacity(0.0),
                        palette.cyan.opacity(0.5 + 0.18 * breath),
                        palette.violet.opacity(0.0)
                    ],
                    startPoint: .trailing,
                    endPoint: .leading
                )
            )
            .frame(width: size * 0.72, height: max(size * 0.04, 2))
            .rotationEffect(.degrees(26 - 5 * Double(breath)))
            .offset(x: -size * 0.08, y: size * (0.05 + breath * 0.02))
            .blur(radius: size * 0.018)
            .blendMode(.screen)
    }

    private var lowerGlassArc: some View {
        Circle()
            .trim(from: 0.56, to: 0.9)
            .stroke(
                palette.glassWhite.opacity(0.38 + 0.1 * breath),
                style: StrokeStyle(lineWidth: max(size * 0.014, 1), lineCap: .round)
            )
            .rotationEffect(.degrees(10))
            .padding(size * 0.08)
            .blur(radius: size * 0.005)
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
