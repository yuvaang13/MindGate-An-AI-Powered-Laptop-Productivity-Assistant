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

    @State private var wavePhase: CGFloat = 0
    @State private var breath: CGFloat = 0

    var body: some View {
        ZStack {
            // Bright white glow background
            RadialGradient(
                colors: [
                    Color.white.opacity(0.8),
                    Color.white.opacity(0.4),
                    Color.clear
                ],
                center: .center,
                startRadius: 0,
                endRadius: size * 0.8
            )
            .blur(radius: 20)
            .frame(width: size, height: size)

            // Glassmorphic base
            Circle()
                .fill(.ultraThinMaterial)
                .overlay(
                    Circle()
                        .stroke(
                            LinearGradient(
                                colors: [.white.opacity(0.9), .white.opacity(0.5), .white.opacity(0.3)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 2
                        )
                )
                .shadow(color: .white.opacity(0.6), radius: 30, x: 0, y: 0)

            // Animated wave lines with more visible movement
            ZStack {
                ForEach(0..<7, id: \.self) { index in
                    WaveLine(
                        phase: wavePhase + CGFloat(index) * 0.8,
                        amplitude: 12 + CGFloat(index) * 3,
                        frequency: 0.03 + CGFloat(index) * 0.008,
                        yOffset: CGFloat(index - 3) * 6
                    )
                    .stroke(
                        LinearGradient(
                            colors: [.white, .white.opacity(0.7), .white.opacity(0.4)],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        lineWidth: 3
                    )
                    .opacity(0.4 + CGFloat(index) * 0.08)
                }
            }
            .frame(width: size * 0.75, height: size * 0.55)
            .blur(radius: 0.5)
        }
        .frame(width: size, height: size)
        .scaleEffect(1 + breath * 0.05)
        .opacity(0.98 + breath * 0.02)
        .drawingGroup(opaque: false, colorMode: .linear)
        .accessibilityLabel("MindGate AI orb")
        .onAppear {
            withAnimation(.easeInOut(duration: 1.8).repeatForever(autoreverses: true)) {
                breath = 1
            }
            withAnimation(.linear(duration: 2).repeatForever(autoreverses: false)) {
                wavePhase = 2 * .pi
            }
        }
    }
}

struct WaveLine: Shape {
    var phase: CGFloat
    var amplitude: CGFloat
    var frequency: CGFloat
    var yOffset: CGFloat

    func path(in rect: CGRect) -> Path {
        var path = Path()
        let width = rect.width
        let height = rect.height
        let midY = height / 2 + yOffset

        path.move(to: CGPoint(x: 0, y: midY))

        for x in stride(from: 0, through: width, by: 1) {
            let normalizedX = x / width
            let y = midY + sin(normalizedX * .pi * 2 * frequency + phase) * amplitude * sin(normalizedX * .pi)
            path.addLine(to: CGPoint(x: x, y: y))
        }

        return path
    }
}

struct MindGateOrbPalette {
    // White color palette for clean, premium look
    let indigo = Color.white
    let violet = Color.white
    let deepViolet = Color.gray
    let teal = Color.white
    let emerald = Color.white
    let cyan = Color.white
    let pink = Color.white
    let ink = Color.black
    let glassWhite = Color.white

    static let mindGate = MindGateOrbPalette()
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
