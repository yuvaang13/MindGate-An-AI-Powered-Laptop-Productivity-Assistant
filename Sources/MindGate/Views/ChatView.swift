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
    @State private var showTakeoverView: Bool = false
    @State private var countdownSeconds: Int = 0
    @State private var timer: Timer?
    @State private var hasSubmitted: Bool = false

    var body: some View {
        ZStack(alignment: .topTrailing) {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .fill(.ultraThinMaterial.opacity(0.35))
                .background(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.14),
                                    Color.white.opacity(0.04),
                                    Color.clear
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 24, style: .continuous)
                        .stroke(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.18),
                                    Color.white.opacity(0.06),
                                    Color.clear
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 0.6
                        )
                )

            FlowingLinesView(size: configuration.theme.dimensions.orbExpandedWidth, configuration: configuration, isHovered: false)
                .allowsHitTesting(false)
                .opacity(0.15)

            VStack(spacing: 8) {
                Spacer(minLength: 12)

                Text(headlineText)
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [.white, Color.white.opacity(0.7)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .multilineTextAlignment(.center)
                    .tracking(0)
                    .lineLimit(nil)
                    .fixedSize(horizontal: false, vertical: true)
                    .allowsHitTesting(false)

                Text("Distraction detected. Explain why.")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(Color.white.opacity(0.55))
                    .multilineTextAlignment(.center)
                    .opacity(showDurationSelection || showDeniedMessage || showTakeoverView || isLoading ? 0 : 1)
                    .tracking(0.2)
                    .allowsHitTesting(false)

                contentView
                    .frame(maxWidth: .infinity)

                Spacer(minLength: 12)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            closeButton
        }
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .onAppear {
            startCountdown()
            NSApp.activate(ignoringOtherApps: true)
        }
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
                .foregroundStyle(Color.white.opacity(0.85))
                .frame(width: 32, height: 32)
                .background(
                    Circle()
                        .fill(.ultraThinMaterial.opacity(0.3))
                        .background(
                            Circle()
                                .fill(
                                    LinearGradient(
                                        colors: [
                                            Color.white.opacity(0.14),
                                            Color.clear
                                        ],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                        )
                )
                .overlay(
                    Circle()
                        .stroke(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.16),
                                    Color.clear
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            ),
                            lineWidth: 0.5
                        )
                )
        }
        .buttonStyle(.plain)
        .padding(.top, 32)
        .padding(.trailing, 36)
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
            .foregroundColor(Color.white.opacity(0.9))
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 4)
    }

    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: Color(hex: configuration.theme.colors.warning)))
                .scaleEffect(1.0)

            Text("AI is thinking...")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(Color.white.opacity(0.7))
                .tracking(0.3)
        }
        .padding(.top, 8)
    }

    private var responseView: some View {
        VStack(spacing: 14) {
            TypingTextView(text: aiResponse, configuration: configuration)

            Button(action: {
                if showDeniedMessage {
                    resetStateWithRetry()
                } else {
                    windowManager?.collapseOrb()
                    resetState()
                }
            }) {
                Label(showDeniedMessage ? "Try Again" : "Close", systemImage: showDeniedMessage ? "arrow.clockwise" : "checkmark")
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
                .foregroundColor(Color.white.opacity(0.68))
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
                .font(.system(size: 36))
                .foregroundStyle(
                    LinearGradient(
                        colors: [.white, Color.white.opacity(0.6)],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .shadow(color: Color.black.opacity(0.2), radius: 12, x: 0, y: 4)

            Text("Stay focused and return to work.")
                .font(.system(size: 14, weight: .medium, design: .rounded))
                .foregroundColor(Color.white.opacity(0.7))
                .multilineTextAlignment(.center)
                .tracking(0.3)
        }
        .padding(.horizontal, 4)
    }

    private var promptBox: some View {
        HStack(alignment: .bottom, spacing: 10) {
            ReliablePromptTextView(
                text: $userInput,
                placeholder: "I need this because...",
                onSubmit: submitRequest,
                configuration: configuration,
                windowManager: windowManager
            )
            .frame(height: 50)

            Button(action: submitRequest) {
                Image(systemName: "arrow.up")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Color.white.opacity(canSubmit ? 0.95 : 0.4))
                    .frame(width: 34, height: 34)
                    .background(
                        Circle()
                            .fill(.ultraThinMaterial.opacity(canSubmit ? 0.65 : 0.3))
                            .background(
                            Circle()
                                .fill(
                                    LinearGradient(
                                        colors: [
                                            Color.white.opacity(canSubmit ? 0.18 : 0.06),
                                            Color.clear
                                        ],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                            )
                    )
                    .overlay(
                        Circle()
                            .stroke(
                                LinearGradient(
                                    colors: [
                                        Color.white.opacity(canSubmit ? 0.18 : 0.08),
                                        Color.clear
                                    ],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ),
                                lineWidth: 0.6
                            )
                    )
            }
            .buttonStyle(.plain)
            .disabled(!canSubmit)
            .help("Submit")
        }
        .padding(6)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(.thickMaterial.opacity(0.28))
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color.white.opacity(0.10),
                                    Color.white.opacity(0.03),
                                    Color.clear
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                )
        )
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.16),
                            Color.white.opacity(0.06),
                            Color.clear
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 0.6
                )
                .allowsHitTesting(false)
        )
        .shadow(color: Color.black.opacity(0.25), radius: 16, x: 0, y: 8)
    }

    private var canSubmit: Bool {
        !userInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isLoading
    }

    private func submitRequest() {
        guard canSubmit else { return }
        isLoading = true

        Task { @MainActor in
            let isOllamaRunning = await decisionEngine.checkOllamaConnection()
            if !isOllamaRunning {
                isLoading = false
                aiResponse = "Ollama is not running. Please start Ollama to continue."
                showDeniedMessage = true
                return
            }

            do {
                let result = try await decisionEngine.evaluateRequest(userInput: userInput)

                isLoading = false
                aiResponse = result.message

                if result.isApproved {
                    showDurationSelection = true
                } else {
                    showDeniedMessage = true

                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                        windowManager?.showOverlay()

                        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                            decisionEngine.closeCurrentAppOrTab()
                        }

                        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) {
                            windowManager?.hideOverlay()
                            self.showTakeoverView = true
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
        showTakeoverView = false
        countdownSeconds = configuration.settings.justificationCountdownDuration
        stopCountdown()
        hasSubmitted = false
    }

    private func resetStateWithRetry() {
        userInput = ""
        aiResponse = ""
        isLoading = false
        showDurationSelection = false
        showDeniedMessage = false
        showTakeoverView = false
        countdownSeconds = configuration.settings.justificationCountdownDuration
        stopCountdown()
        startCountdown()
    }

    private func startCountdown() {
        stopCountdown()

        countdownSeconds = configuration.settings.justificationCountdownDuration
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
            Task { @MainActor in
                isLoading = false
                aiResponse = "Time's up! Access denied."
                showDeniedMessage = true
                windowManager?.showOverlay()
                decisionEngine.closeCurrentAppOrTab()
                DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                    windowManager?.hideOverlay()
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
            .foregroundStyle(Color.white.opacity(0.9))
            .padding(.horizontal, 14)
            .frame(height: 36)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(configuration.isPressed ? 0.18 : 0.22),
                                Color.white.opacity(configuration.isPressed ? 0.10 : 0.14),
                                Color.clear
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        .opacity(0.7)
                    )
                    .background(.ultraThinMaterial.opacity(0.35))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .stroke(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(0.16),
                                Color.white.opacity(0.06),
                                Color.clear
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ),
                        lineWidth: 0.5
                    )
            )
            .scaleEffect(configuration.isPressed ? 0.96 : 1)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}


private struct ReliablePromptTextView: NSViewRepresentable {
    @Binding var text: String
    let placeholder: String
    let onSubmit: () -> Void
    let configuration: Configuration
    weak var windowManager: WindowManager?

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text, onSubmit: onSubmit, configuration: configuration, windowManager: windowManager)
    }

    func makeNSView(context: Context) -> NSView {
        let textView = PlaceholderTextView(configuration: configuration)
        textView.delegate = context.coordinator
        textView.font = NSFont.systemFont(ofSize: 13, weight: .regular)
        textView.textColor = NSColor(Color(hex: configuration.theme.colors.primary).opacity(0.9))
        textView.insertionPointColor = NSColor(Color(hex: configuration.theme.colors.primary))
        textView.backgroundColor = .clear
        textView.drawsBackground = false
        textView.textContainerInset = NSSize(width: 4, height: 4)
        textView.textContainer?.lineFragmentPadding = 0
        textView.textContainer?.widthTracksTextView = true
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.textContainer?.size.width = 280
        textView.string = text
        textView.placeholder = placeholder
        let endPosition = textView.string.count
        textView.setSelectedRange(NSRange(location: endPosition, length: 0))
        textView.needsDisplay = true

        context.coordinator.register(textView: textView)
        if let windowManager = windowManager {
            windowManager.registerOrbTextView(textView)
        }

        return textView
    }

    func updateNSView(_ nsView: NSView, context: Context) {
        guard let textView = nsView as? PlaceholderTextView else { return }

        if textView.placeholder != placeholder {
            textView.placeholder = placeholder
        }
        if textView.string != text {
            let isFirstResponder = textView.window?.firstResponder == textView
            let selectedRange = textView.selectedRange()
            textView.string = text
            if isFirstResponder {
                textView.setSelectedRange(selectedRange)
            } else {
                let endPosition = textView.string.count
                textView.setSelectedRange(NSRange(location: endPosition, length: 0))
            }
        }
        textView.needsDisplay = true
    }

    final class Coordinator: NSObject, NSTextViewDelegate {
        @Binding private var text: String
        private let onSubmit: () -> Void
        private weak var windowManager: WindowManager?
        private weak var registeredTextView: NSTextView?

        init(text: Binding<String>, onSubmit: @escaping () -> Void, configuration: Configuration, windowManager: WindowManager?) {
            _text = text
            self.onSubmit = onSubmit
            self.windowManager = windowManager
        }

        func register(textView: NSTextView) {
            registeredTextView = textView
            if let textView = textView.string as NSString? {
                text = textView as String
            }
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

            if commandSelector == #selector(NSResponder.cancelOperation(_:)) {
                return false
            }

            return false
        }

        func textDidEndEditing(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            text = textView.string
        }
    }
}

private final class PlaceholderTextView: NSTextView {
    var placeholder: String = ""
    var configuration: Configuration

    init(configuration: Configuration) {
        self.configuration = configuration
        super.init(frame: .zero, textContainer: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override var acceptsFirstResponder: Bool {
        return true
    }

    override func becomeFirstResponder() -> Bool {
        let result = super.becomeFirstResponder()
        print("PlaceholderTextView becomeFirstResponder -> \(result)")
        return result
    }

    override func mouseDown(with event: NSEvent) {
        print("PlaceholderTextView mouseDown")
        window?.makeKeyAndOrderFront(nil)
        window?.makeFirstResponder(self)
        super.mouseDown(with: event)
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

struct TypingTextView: View {
    let text: String
    let configuration: Configuration

    @State private var displayedText: String = ""
    @State private var currentIndex: Int = 0

    var body: some View {
        Text(displayedText)
            .font(.system(size: 14, weight: .medium, design: .rounded))
            .foregroundColor(Color.white.opacity(0.85))
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.horizontal, 4)
            .lineSpacing(3)
            .tracking(0.2)
            .onAppear {
                startTypingAnimation()
            }
            .onChange(of: text) { oldValue, newValue in
                if displayedText.isEmpty {
                    startTypingAnimation()
                }
            }
    }

    private func startTypingAnimation() {
        displayedText = ""
        currentIndex = 0
        let characters = Array(text)
        Timer.scheduledTimer(withTimeInterval: 0.02, repeats: true) { timer in
            if currentIndex < characters.count {
                displayedText.append(characters[currentIndex])
                currentIndex += 1
            } else {
                timer.invalidate()
            }
        }
    }
}