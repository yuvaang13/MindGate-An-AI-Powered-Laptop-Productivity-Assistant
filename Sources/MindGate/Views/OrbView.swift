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
                FlowingLinesView(size: Configuration.Dimensions.orbSize)
                    .frame(width: Configuration.Dimensions.orbSize, height: Configuration.Dimensions.orbSize)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        withAnimation(.easeInOut(duration: Configuration.Animation.orbTransitionDuration)) {
                            windowManager?.expandOrb()
                        }
                    }
            }
        }
    }
}

struct FlowingLinesView: View {
    let size: CGFloat
    
    @State private var phase: CGFloat = 0
    @State private var breath: CGFloat = 0
    @State private var glowIntensity: CGFloat = 0.5
    
    var body: some View {
        ZStack {
            // Premium black gradient background
            LinearGradient(
                colors: [
                    Color.black.opacity(0.98),
                    Color.black.opacity(0.92)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            
            // Subtle ambient glow
            RadialGradient(
                colors: [
                    Color.white.opacity(glowIntensity * 0.08),
                    Color.clear
                ],
                center: .center,
                startRadius: 0,
                endRadius: size * 0.6
            )
            .blur(radius: 20)
            
            // Layered white flowing lines animation
            ZStack {
                // Background layer - subtle
                ForEach(0..<3, id: \.self) { index in
                    FlowingLine(
                        phase: phase * 0.7 + CGFloat(index) * 1.2,
                        amplitude: 12 + CGFloat(index) * 4,
                        frequency: 0.025 + CGFloat(index) * 0.008,
                        yOffset: CGFloat(index - 1) * 12
                    )
                    .stroke(
                        Color.white.opacity(0.15 - CGFloat(index) * 0.03),
                        lineWidth: 2
                    )
                    .blur(radius: 1.5)
                }
                
                // Middle layer - main
                ForEach(0..<5, id: \.self) { index in
                    FlowingLine(
                        phase: phase + CGFloat(index) * 0.9,
                        amplitude: 18 + CGFloat(index) * 3.5,
                        frequency: 0.035 + CGFloat(index) * 0.006,
                        yOffset: CGFloat(index - 2) * 10
                    )
                    .stroke(
                        Color.white.opacity(0.5 - CGFloat(index) * 0.07),
                        lineWidth: 1.8
                    )
                    .blur(radius: 0.8)
                }
                
                // Foreground layer - accent
                ForEach(0..<2, id: \.self) { index in
                    FlowingLine(
                        phase: phase * 1.3 + CGFloat(index) * 1.5,
                        amplitude: 22 + CGFloat(index) * 2,
                        frequency: 0.04 + CGFloat(index) * 0.004,
                        yOffset: (CGFloat(index) - 0.5) * 15
                    )
                    .stroke(
                        Color.white.opacity(0.7 - CGFloat(index) * 0.1),
                        lineWidth: 1.2
                    )
                }
            }
            .frame(width: size * 0.85, height: size * 0.65)
        }
        .frame(width: size, height: size)
        .scaleEffect(1 + breath * 0.04)
        .opacity(0.96 + breath * 0.04)
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
