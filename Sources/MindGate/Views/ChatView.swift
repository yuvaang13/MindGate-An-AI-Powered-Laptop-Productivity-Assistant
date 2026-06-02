import SwiftUI
import AppKit

struct ChatView: View {
    weak var windowManager: WindowManager?
    let decisionEngine: DecisionEngine
    let configuration: Configuration

    @State private var userInput: String = ""
    @State private var isLoading: Bool = false
    @State private var aiResponse: String = ""
    @State private var showDurationSelection: Bool = false
    @State private var showDeniedMessage: Bool = false
    @State private var showTakeoverView: Bool = false // New state for takeover view
    @State private var countdownSeconds: Int = 20 // Initial countdown time
    @State private var timer: Timer? // Timer instance

    var body: some View {
        ZStack(alignment: .topTrailing) {
            // Premium glassmorphic background
            RoundedRectangle(cornerRadius: 16)
                .fill(.ultraThinMaterial)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color(hex: configuration.theme.colors.background).opacity(0.85),
                                    Color(hex: configuration.theme.colors.background).opacity(0.75)
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                )

            FlowingLinesView(size: configuration.theme.dimensions.orbExpandedWidth, configuration: configuration)
                .allowsHitTesting(false)
                .opacity(0.15)

            VStack(spacing: 8) {
                Spacer(minLength: 12)

                Text(headlineText)
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundColor(Color(hex: configuration.theme.colors.primary).opacity(0.95))
                    .multilineTextAlignment(.center)
                    .shadow(color: Color(hex: configuration.theme.colors.background).opacity(0.4), radius: 8, x: 0, y: 2)
                    .tracking(0)
                    .lineLimit(nil)
                    .fixedSize(horizontal: false, vertical: true)

                Text("Distraction detected. Explain why.")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(Color(hex: configuration.theme.colors.primary).opacity(0.62))
                    .multilineTextAlignment(.center)
                    .opacity(showDurationSelection || showDeniedMessage || showTakeoverView || isLoading ? 0 : 1)
                    .tracking(0.2)

                contentView
                    .frame(maxWidth: .infinity)

                Spacer(minLength: 12)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            closeButton
        }
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .contentShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(
                    LinearGradient(
                        colors: [
                            Color(hex: configuration.theme.colors.primary).opacity(0.18),
                            Color(hex: configuration.theme.colors.primary).opacity(0.08),
                            Color(hex: configuration.theme.colors.primary).opacity(0.04)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        )
        .shadow(color: .black.opacity(0.6), radius: 40, x: 0, y: 20)
        .shadow(color: .white.opacity(0.08), radius: 20, x: 0, y: 8)
        .onAppear(perform: startCountdown)
        .onDisappear(perform: stopCountdown)
    }

    @ViewBuilder
    private var contentView: some View {
        if showDurationSelection {
            durationSelectionView
        } else if showTakeoverView {
            TakeoverView(configuration: configuration, windowManager: windowManager, decisionEngine: decisionEngine)
        } else if showDeniedMessage {
            deniedMessageView
        } else if isLoading {
            loadingView
        } else if !aiResponse.isEmpty {
            responseView
        } else {
            inputView
        }
    }

    private var headlineText: String {
        if showDurationSelection {
            return "Access granted"
        }

        if showDeniedMessage {
            return "Access denied"
        }

        if isLoading {
            return "Checking with AI"
        }

        if countdownSeconds > 0 {
            return "Why are you here? (\(countdownSeconds)s)"
        }

        return "Why are you here?"
    }

    private var closeButton: some View {
        Button(action: {
            withAnimation(.easeInOut(duration: configuration.theme.animation.orbTransitionDuration)) {
                windowManager?.collapseOrb()
            }
        }) {
            Image(systemName: "xmark")
                .font(.system(size: 12, weight: .semibold))
                .foregroundColor(Color(hex: configuration.theme.colors.primary).opacity(0.88))
                .frame(width: 32, height: 32)
                .background(
                    Circle()
                        .fill(.ultraThinMaterial)
                        .background(
                            Circle()
                                .fill(Color(hex: configuration.theme.colors.primary).opacity(0.08))
                        )
                )
                .overlay(Circle().stroke(Color(hex: configuration.theme.colors.primary).opacity(0.18), lineWidth: 0.5))
        }
        .buttonStyle(.plain)
        .padding(.top, 36)
        .padding(.trailing, 40)
    }

    private var inputView: some View {
        VStack(spacing: 6) {
            assistantPromptView
            promptBox
        }
        .padding(.horizontal, 0)
    }

    private var assistantPromptView: some View {
        Text("Why do you need access?")
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundColor(Color(hex: configuration.theme.colors.primary).opacity(0.9))
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 4)
    }

    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: Color(hex: configuration.theme.colors.primary)))
                .scaleEffect(1.0)

            Text("AI is thinking...")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(Color(hex: configuration.theme.colors.primary).opacity(0.72))
                .tracking(0.3)
        }
        .padding(.top, 8)
    }

    private var responseView: some View {
        VStack(spacing: 14) {
            Text(aiResponse)
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .foregroundColor(Color(hex: configuration.theme.colors.primary).opacity(0.82))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 4)
                .lineSpacing(3)
                .tracking(0.2)

            Button(action: {
                windowManager?.collapseOrb()
                resetState()
            }) {
                Label("Close", systemImage: "checkmark")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
            }
            .buttonStyle(MinimalActionButtonStyle(configuration: configuration))
        }
        .padding(.horizontal, 4)
    }

    private var durationSelectionView: some View {
        VStack(spacing: 14) {
            Text("Choose duration:")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(Color(hex: configuration.theme.colors.primary).opacity(0.68))
                .tracking(0.3)

            HStack(spacing: 8) {
                ForEach(0..<configuration.settings.accessDurationLabels.count, id: \.self) { index in
                    Button(action: {
                        selectDuration(index: index)
                    }) {
                        Text(configuration.settings.accessDurationLabels[index])
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(MinimalActionButtonStyle(configuration: configuration))
                }
            }
        }
        .padding(.horizontal, 4)
    }

    private var deniedMessageView: some View {
        VStack(spacing: 12) {
            Image(systemName: "xmark.shield.fill")
                .font(.system(size: 32))
                .foregroundColor(Color(hex: configuration.theme.colors.primary).opacity(0.9))
                .shadow(color: Color(hex: configuration.theme.colors.background).opacity(0.3), radius: 8, x: 0, y: 4)

            Text("Stay focused and return to work.")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(Color(hex: configuration.theme.colors.primary).opacity(0.68))
                .multilineTextAlignment(.center)
                .tracking(0.2)
        }
        .padding(.horizontal, 4)
    }

    private var promptBox: some View {
        HStack(alignment: .bottom, spacing: 10) {
            ReliablePromptTextView(
                text: $userInput,
                placeholder: "I need this because...",
                onSubmit: submitRequest,
                configuration: configuration
            )
            .frame(height: 50)

            Button(action: submitRequest) {
                Image(systemName: "arrow.up")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(Color(hex: configuration.theme.colors.primary))
                    .frame(width: 34, height: 34)
                    .background(
                        Circle()
                            .fill(
                                canSubmit 
                                ? LinearGradient(
                                    colors: [
                                        Color(hex: configuration.theme.colors.primary).opacity(0.9),
                                        Color(hex: configuration.theme.colors.primary).opacity(0.7)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                                : LinearGradient(
                                    colors: [
                                        Color(hex: configuration.theme.colors.primary).opacity(0.12),
                                        Color(hex: configuration.theme.colors.primary).opacity(0.08)
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                )
                            )
                    )
                    .overlay(Circle().stroke(Color(hex: configuration.theme.colors.primary).opacity(canSubmit ? 0.3 : 0.15), lineWidth: 0.5))
            }
            .buttonStyle(.plain)
            .disabled(!canSubmit)
            .help("Submit")
        }
        .padding(6)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(.ultraThinMaterial)
                .background(
                    RoundedRectangle(cornerRadius: 14)
                        .fill(Color(hex: configuration.theme.colors.background).opacity(0.3))
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [
                            Color(hex: configuration.theme.colors.primary).opacity(0.15),
                            Color(hex: configuration.theme.colors.primary).opacity(0.08),
                            Color(hex: configuration.theme.colors.primary).opacity(0.04)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        )
        .shadow(color: Color(hex: configuration.theme.colors.background).opacity(0.4), radius: 16, x: 0, y: 10)
    }

    private var canSubmit: Bool {
        !userInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isLoading
    }

    private func submitRequest() {
        guard canSubmit else { return }
        isLoading = true

        Task { @MainActor in
            do {
                let result = try await decisionEngine.evaluateRequest(userInput: userInput)

                isLoading = false
                aiResponse = result.message

                if result.isApproved {
                    showDurationSelection = true
                } else {
                    showTakeoverView = true // Show takeover view on denial

                    // Trigger overlay and close app/tab after delay
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        windowManager?.showOverlay()
                        decisionEngine.closeCurrentAppOrTab()

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
        let duration = configuration.settings.accessDurations[index]
        decisionEngine.grantAccess(for: duration)

        windowManager?.hideOrb()
        resetState()
    }

    private func resetState() {
        userInput = ""
        aiResponse = ""
        isLoading = false
        showDurationSelection = false
        showDeniedMessage = false
        showTakeoverView = false // Reset takeover view state
        countdownSeconds = 20 // Reset countdown
        stopCountdown() // Stop any active timer
    }

    private func startCountdown() {
        // Invalidate any existing timer first
        stopCountdown()

        countdownSeconds = 20 // Set initial countdown time
        timer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { _ in
            if self.countdownSeconds > 0 {
                self.countdownSeconds -= 1
            } else {
                self.handleCountdownExpired()
            }
        }
    }

    private func stopCountdown() {
        timer?.invalidate()
        timer = nil
    }

    private func handleCountdownExpired() {
        stopCountdown()
        if !isLoading && !showDurationSelection && !showDeniedMessage {
            // If no decision has been made and timer expires, deny access
            Task { @MainActor in
                isLoading = false
                aiResponse = "Time's up! Access denied."
                showTakeoverView = true // Show takeover view on denial
                windowManager?.showOverlay()
                decisionEngine.closeCurrentAppOrTab()
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                    windowManager?.hideOverlay()
                    windowManager?.hideOrb()
                    resetState()
                }
            }
        }
    }
}

struct MinimalActionButtonStyle: ButtonStyle {
    let configuration: Configuration

    func makeBody(configuration: Self.Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundColor(Color(hex: self.configuration.theme.colors.primary).opacity(0.92))
            .padding(.horizontal, 14)
            .frame(height: 36)
            .background(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(hex: self.configuration.theme.colors.primary).opacity(configuration.isPressed ? 0.25 : 0.35),
                                Color(hex: self.configuration.theme.colors.primary).opacity(configuration.isPressed ? 0.15 : 0.25)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .background(
                        RoundedRectangle(cornerRadius: 8)
                            .fill(.ultraThinMaterial)
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .stroke(Color(hex: self.configuration.theme.colors.primary).opacity(0.18), lineWidth: 0.5)
            )
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
    }
}



private struct ReliablePromptTextView: NSViewRepresentable {
    @Binding var text: String
    let placeholder: String
    let onSubmit: () -> Void
    let configuration: Configuration

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text, onSubmit: onSubmit)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        scrollView.drawsBackground = false
        scrollView.hasVerticalScroller = false
        scrollView.hasHorizontalScroller = false
        scrollView.borderType = .noBorder

        let textView = PlaceholderTextView(configuration: configuration)
        textView.placeholder = placeholder
        textView.delegate = context.coordinator
        textView.isRichText = false
        textView.importsGraphics = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticTextReplacementEnabled = false
        textView.allowsUndo = true
        textView.isEditable = true
        textView.isSelectable = true
        textView.font = NSFont.systemFont(ofSize: 14, weight: .regular)
        textView.textColor = NSColor(Color(hex: configuration.theme.colors.primary).opacity(0.9))
        textView.insertionPointColor = NSColor(Color(hex: configuration.theme.colors.primary))
        textView.backgroundColor = .clear
        textView.drawsBackground = false
        textView.textContainerInset = NSSize(width: 0, height: 2)
        textView.textContainer?.lineFragmentPadding = 0
        textView.textContainer?.widthTracksTextView = true
        textView.textContainer?.containerSize = NSSize(width: scrollView.contentSize.width, height: .greatestFiniteMagnitude)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.minSize = NSSize(width: 0, height: 0)
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        textView.frame = NSRect(x: 0, y: 0, width: 240, height: 62)
        textView.autoresizingMask = [.width]
        textView.string = text

        scrollView.documentView = textView

        DispatchQueue.main.async {
            textView.window?.makeFirstResponder(textView)
        }

        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        guard let textView = scrollView.documentView as? PlaceholderTextView else { return }

        textView.placeholder = placeholder
        if textView.string != text {
            textView.string = text
        }
        textView.frame.size.width = scrollView.contentSize.width
        textView.needsDisplay = true
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        @Binding private var text: String
        private let onSubmit: () -> Void

        init(text: Binding<String>, onSubmit: @escaping () -> Void) {
            _text = text
            self.onSubmit = onSubmit
        }

        func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            text = textView.string
        }

        func textView(_ textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
            if commandSelector == #selector(NSResponder.insertNewline(_:)),
               NSApp.currentEvent?.modifierFlags.contains(.command) == true {
                onSubmit()
                return true
            }

            return false
        }
    }
}

private final class PlaceholderTextView: NSTextView {
    var placeholder: String = ""
    var configuration: Configuration // Added for color access

    init(configuration: Configuration) {
        self.configuration = configuration
        super.init(frame: .zero, textContainer: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)

        guard string.isEmpty else { return }

        let attributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: NSColor(Color(hex: configuration.theme.colors.primary).opacity(0.48)),
            .font: NSFont.systemFont(ofSize: 13, weight: .regular)
        ]
        placeholder.draw(
            at: NSPoint(x: textContainerInset.width, y: textContainerInset.height),
            withAttributes: attributes
        )
    }
}
