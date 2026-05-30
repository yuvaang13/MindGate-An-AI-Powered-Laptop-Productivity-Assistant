import SwiftUI

struct ChatView: View {
    weak var windowManager: WindowManager?
    
    @State private var userInput: String = ""
    @State private var isLoading: Bool = false
    @State private var aiResponse: String = ""
    @State private var showDurationSelection: Bool = false
    @State private var showDeniedMessage: Bool = false
    
    var body: some View {
        VStack(spacing: 20) {
            // Header
            HStack {
                Text("MindGate")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(Configuration.Colors.text)
                
                Spacer()
                
                Button(action: {
                    withAnimation(.easeInOut(duration: Configuration.Animation.orbTransitionDuration)) {
                        windowManager?.collapseOrb()
                    }
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundColor(Configuration.Colors.textSecondary)
                }
                .buttonStyle(PlainButtonStyle())
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            
            Divider()
                .background(Configuration.Colors.textSecondary.opacity(0.2))
            
            // Content
            if showDurationSelection {
                durationSelectionView
            } else if showDeniedMessage {
                deniedMessageView
            } else if isLoading {
                loadingView
            } else if !aiResponse.isEmpty {
                responseView
            } else {
                inputView
            }
            
            Spacer()
        }
        .background(
            RoundedRectangle(cornerRadius: Configuration.Dimensions.chatCornerRadius)
                .fill(.ultraThinMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: Configuration.Dimensions.chatCornerRadius)
                        .stroke(
                            LinearGradient(
                                colors: [Configuration.Colors.primary.opacity(0.5), Configuration.Colors.secondary.opacity(0.3)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 1
                        )
                )
        )
        .shadow(color: Configuration.Colors.primary.opacity(0.3), radius: 20, x: 0, y: 10)
    }
    
    private var inputView: some View {
        VStack(spacing: 16) {
            Text("Why do you need access?")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(Configuration.Colors.textSecondary)
            
            ZStack(alignment: .topLeading) {
                Configuration.Colors.surface
                    .cornerRadius(8)
                
                TextEditor(text: $userInput)
                    .font(.system(size: 14))
                    .foregroundColor(Configuration.Colors.text)
                    .background(Color.clear)
                    .cornerRadius(8)
                    .frame(height: 100)
                    .padding(8)
                    .scrollContentBackground(.hidden)
            }
            .overlay(
                RoundedRectangle(cornerRadius: 8)
                    .stroke(Configuration.Colors.textSecondary.opacity(0.2), lineWidth: 1)
            )
            
            Button(action: submitRequest) {
                Text("Submit")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(
                        LinearGradient(
                            colors: [Configuration.Colors.primary, Configuration.Colors.secondary],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .cornerRadius(8)
            }
            .disabled(userInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            .opacity(userInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.5 : 1.0)
        }
        .padding(20)
    }
    
    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: Configuration.Colors.accent))
                .scaleEffect(1.5)
            
            Text("AI is thinking...")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(Configuration.Colors.textSecondary)
        }
        .padding(20)
    }
    
    private var responseView: some View {
        VStack(spacing: 16) {
            Text(aiResponse)
                .font(.system(size: 14))
                .foregroundColor(Configuration.Colors.text)
                .multilineTextAlignment(.center)
                .padding()
            
            Button(action: {
                windowManager?.collapseOrb()
                resetState()
            }) {
                Text("Close")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Configuration.Colors.surface)
                    .cornerRadius(8)
            }
        }
        .padding(20)
    }
    
    private var durationSelectionView: some View {
        VStack(spacing: 16) {
            Text("Access Granted")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(Configuration.Colors.accent)
            
            Text("Choose duration:")
                .font(.system(size: 14))
                .foregroundColor(Configuration.Colors.textSecondary)
            
            HStack(spacing: 12) {
                ForEach(0..<Configuration.accessDurationLabels.count, id: \.self) { index in
                    Button(action: {
                        selectDuration(index: index)
                    }) {
                        Text(Configuration.accessDurationLabels[index])
                            .font(.system(size: 14, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(
                                LinearGradient(
                                    colors: [Configuration.Colors.accent, Configuration.Colors.primary],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                            .cornerRadius(8)
                    }
                }
            }
        }
        .padding(20)
    }
    
    private var deniedMessageView: some View {
        VStack(spacing: 16) {
            Image(systemName: "xmark.shield.fill")
                .font(.system(size: 40))
                .foregroundColor(.red)
            
            Text("Access Denied")
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(.red)
            
            Text("Stay focused and return to work.")
                .font(.system(size: 14))
                .foregroundColor(Configuration.Colors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(20)
    }
    
    private func submitRequest() {
        isLoading = true
        
        Task { @MainActor in
            do {
                let decisionEngine = DecisionEngine.shared
                let result = try await decisionEngine.evaluateRequest(userInput: userInput)
                
                isLoading = false
                aiResponse = result.message
                
                if result.isApproved {
                    showDurationSelection = true
                } else {
                    showDeniedMessage = true
                    
                    // Trigger overlay and app hiding after delay
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        windowManager?.showOverlay()
                        DecisionEngine.shared.hideCurrentApp()
                        
                        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                            windowManager?.hideOverlay()
                            windowManager?.hideOrb()
                            resetState()
                        }
                    }
                }
            } catch {
                isLoading = false
                aiResponse = "Error: \(error.localizedDescription)"
            }
        }
    }
    
    private func selectDuration(index: Int) {
        let duration = Configuration.accessDurations[index]
        DecisionEngine.shared.grantAccess(for: duration)
        
        windowManager?.hideOrb()
        resetState()
    }
    
    private func resetState() {
        userInput = ""
        aiResponse = ""
        isLoading = false
        showDurationSelection = false
        showDeniedMessage = false
    }
}
