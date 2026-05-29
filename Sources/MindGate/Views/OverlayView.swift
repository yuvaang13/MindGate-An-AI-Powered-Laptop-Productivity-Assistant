import SwiftUI

struct OverlayView: View {
    var body: some View {
        ZStack {
            // Blur background
            Color.black.opacity(0.8)
                .ignoresSafeArea()
                .blur(radius: 20)
            
            // Warning message
            VStack(spacing: 24) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 80))
                    .foregroundColor(.red)
                    .shadow(color: .red.opacity(0.5), radius: 20)
                
                Text("Access Denied")
                    .font(.system(size: 32, weight: .bold))
                    .foregroundColor(.white)
                
                Text("Return to your work")
                    .font(.system(size: 18))
                    .foregroundColor(Configuration.Colors.textSecondary)
                
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: Configuration.Colors.accent))
                    .scaleEffect(1.5)
            }
        }
    }
}
