import SwiftUI

struct OrbView: View {
    weak var windowManager: WindowManager?
    let decisionEngine: DecisionEngine
    let configurationManager: ConfigurationManager
    let isExpanded: Bool

    @State private var isHovered = false

    init(windowManager: WindowManager?, decisionEngine: DecisionEngine, configurationManager: ConfigurationManager, isExpanded: Bool) {
        self.windowManager = windowManager
        self.decisionEngine = decisionEngine
        self.configurationManager = configurationManager
        self.isExpanded = isExpanded
    }

    var body: some View {
        ZStack {
            if isExpanded {
                ChatView(windowManager: windowManager, decisionEngine: decisionEngine, configuration: configurationManager.configuration)
                    .frame(width: configurationManager.configuration.theme.dimensions.orbExpandedWidth, height: configurationManager.configuration.theme.dimensions.orbExpandedHeight)
            } else {
                FlowingLinesView(size: configurationManager.configuration.theme.dimensions.orbSize, configuration: configurationManager.configuration, isHovered: isHovered)
                    .frame(width: configurationManager.configuration.theme.dimensions.orbSize, height: configurationManager.configuration.theme.dimensions.orbSize)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        withAnimation(.easeInOut(duration: configurationManager.configuration.theme.animation.orbTransitionDuration)) {
                            windowManager?.expandOrb()
                        }
                    }
                    .onHover { hovering in
                        withAnimation(.easeInOut(duration: 0.2)) {
                            isHovered = hovering
                        }
                    }
            }
        }
    }
}

struct FlowingLinesView: View {
    let size: CGFloat
    let configuration: Configuration
    let isHovered: Bool

    @State private var phase: CGFloat = 0
    @State private var breath: CGFloat = 0
    @State private var glowIntensity: CGFloat = 0.5

    private var breathingScale: CGFloat {
        // 0.8-1.2 scale with 3s cycle per plan
        isHovered ? 1 + breath * 0.1 : 1 + breath * 0.04
    }

    private var breathingOpacity: CGFloat {
        isHovered ? 0.92 + breath * 0.08 : 0.96 + breath * 0.04
    }

    private var glowEffect: CGFloat {
        isHovered ? glowIntensity * 0.2 : glowIntensity * 0.08
    }

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: size * 0.5, style: .continuous)
                .fill(.ultraThinMaterial.opacity(0.35))
                .background(
                    RoundedRectangle(cornerRadius: size * 0.5, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color(hex: configuration.theme.colors.primary).opacity(0.04),
                                    Color.clear
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: size * 0.5, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: [
                                    Color(hex: configuration.theme.colors.primary).opacity(0.12),
                                    Color.clear
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 0.5
                        )
                )

            RadialGradient(
                colors: [
                    Color(hex: configuration.theme.colors.primary).opacity(glowEffect * 0.6),
                    Color.clear
                ],
                center: .center,
                startRadius: 0,
                endRadius: size * 0.45
            )
            .blur(radius: 16)

            ZStack {
                ForEach(0..<3, id: \.self) { index in
                    FlowingLine(
                        phase: phase * 0.7 + CGFloat(index) * 1.2,
                        amplitude: 12 + CGFloat(index) * 4,
                        frequency: 0.025 + CGFloat(index) * 0.008,
                        yOffset: CGFloat(index - 1) * 12
                    )
                    .stroke(
                        Color(hex: configuration.theme.colors.primary).opacity(0.1 - CGFloat(index) * 0.02),
                        lineWidth: 1.5
                    )
                    .blur(radius: 1.2)
                }

                ForEach(0..<5, id: \.self) { index in
                    FlowingLine(
                        phase: phase + CGFloat(index) * 0.9,
                        amplitude: 18 + CGFloat(index) * 3.5,
                        frequency: 0.035 + CGFloat(index) * 0.006,
                        yOffset: CGFloat(index - 2) * 10
                    )
                    .stroke(
                        Color(hex: configuration.theme.colors.primary).opacity(0.35 - CGFloat(index) * 0.06),
                        lineWidth: 1.5
                    )
                    .blur(radius: 0.7)
                }

                ForEach(0..<2, id: \.self) { index in
                    FlowingLine(
                        phase: phase * 1.3 + CGFloat(index) * 1.5,
                        amplitude: 22 + CGFloat(index) * 2,
                        frequency: 0.04 + CGFloat(index) * 0.004,
                        yOffset: (CGFloat(index) - 0.5) * 15
                    )
                    .stroke(
                        Color(hex: configuration.theme.colors.primary).opacity(0.55 - CGFloat(index) * 0.1),
                        lineWidth: 1
                    )
                }
            }
            .frame(width: size * 0.85, height: size * 0.65)
        }
        .frame(width: size, height: size)
        .scaleEffect(breathingScale)
        .opacity(breathingOpacity)
        .drawingGroup(opaque: false, colorMode: .linear)
        .accessibilityLabel("MindGate flowing lines")
        .onAppear {
            withAnimation(.easeInOut(duration: 2.5).repeatForever(autoreverses: true)) {
                breath = 1
            }
            withAnimation(.linear(duration: 4.0).repeatForever(autoreverses: false)) {
                phase = 2 * .pi
            }
            withAnimation(.easeInOut(duration: 3.0).repeatForever(autoreverses: true)) {
                glowIntensity = 0.8
            }
        }
    }
}

struct OrbBreathingView: View {
    let configurationManager: ConfigurationManager

    @State private var scale: CGFloat = 1.0
    @State private var opacity: CGFloat = 0.0

    var body: some View {
        Circle()
            .fill(Color(hex: configurationManager.configuration.theme.colors.accent).opacity(0.6))
            .frame(width: 40, height: 40)
            .scaleEffect(scale)
            .opacity(opacity)
            .animation(
                .easeInOut(duration: configurationManager.configuration.theme.animation.orbBreathingDuration)
                .repeatForever(autoreverses: true),
                value: scale
            )
            .onAppear {
                scale = 1.2
                opacity = 0.4
            }
    }
}

struct FlowingLine: Shape {
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