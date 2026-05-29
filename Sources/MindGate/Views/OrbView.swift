import SwiftUI

struct OrbView: View {
    @State private var isBreathing = true
    @State private var scale: CGFloat = 1.0
    @State private var glowIntensity: Double = 0.5
    @State private var rotation: Double = 0.0
    
    weak var windowManager: WindowManager?
    
    var body: some View {
        ZStack {
            if windowManager?.isOrbExpanded == false {
                // Compact Orb
                orbBody
                    .frame(width: Configuration.Dimensions.orbSize, height: Configuration.Dimensions.orbSize)
                    .onTapGesture {
                        withAnimation(.easeInOut(duration: Configuration.Animation.orbTransitionDuration)) {
                            windowManager?.expandOrb()
                        }
                    }
            } else {
                // Expanded Chat Interface
                ChatView(windowManager: windowManager)
                    .frame(width: Configuration.Dimensions.orbExpandedWidth, height: Configuration.Dimensions.orbExpandedHeight)
            }
        }
    }
    
    private var orbBody: some View {
        ZStack {
            // Outer glow
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Configuration.Colors.primary.opacity(glowIntensity * 0.3),
                            Configuration.Colors.secondary.opacity(glowIntensity * 0.2),
                            Color.clear
                        ],
                        center: .center,
                        startRadius: 20,
                        endRadius: 60
                    )
                )
                .frame(width: 100, height: 100)
                .blur(radius: 10)
            
            // Main orb
            Circle()
                .fill(
                    RadialGradient(
                        colors: [
                            Configuration.Colors.primary,
                            Configuration.Colors.secondary,
                            Configuration.Colors.accent
                        ],
                        center: .topLeading,
                        startRadius: 0,
                        endRadius: 30
                    )
                )
                .frame(width: Configuration.Dimensions.orbSize, height: Configuration.Dimensions.orbSize)
                .scaleEffect(scale)
                .rotationEffect(.degrees(rotation))
                .shadow(color: Configuration.Colors.primary.opacity(0.5), radius: 20, x: 0, y: 0)
                .overlay(
                    Circle()
                        .stroke(
                            LinearGradient(
                                colors: [Configuration.Colors.accent.opacity(0.8), Configuration.Colors.primary.opacity(0.4)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 2
                        )
                )
        }
        .onAppear {
            startBreathingAnimation()
        }
    }
    
    private func startBreathingAnimation() {
        withAnimation(.easeInOut(duration: Configuration.Animation.orbBreathingDuration).repeatForever(autoreverses: true)) {
            scale = 1.1
            glowIntensity = 0.8
        }
        
        withAnimation(.linear(duration: 20).repeatForever(autoreverses: false)) {
            rotation = 360.0
        }
    }
}
