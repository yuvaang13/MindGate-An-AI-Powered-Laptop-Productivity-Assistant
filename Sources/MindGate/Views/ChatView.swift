import SwiftUI
import AppKit

struct ChatView: View {
    weak var windowManager: WindowManager?
    let decisionEngine: DecisionEngine

    @State private var userInput: String = ""
    @State private var isLoading: Bool = false
    @State private var aiResponse: String = ""
    @State private var showDurationSelection: Bool = false
    @State private var showDeniedMessage: Bool = false

    var body: some View {
        ZStack(alignment: .topTrailing) {
            PremiumCircleTexture()

            VStack(spacing: 14) {
                Spacer(minLength: 34)

                Text(headlineText)
                    .font(.system(size: 26, weight: .semibold, design: .rounded))
                    .foregroundColor(.black.opacity(0.84))
                    .multilineTextAlignment(.center)

                Text("Explain the work reason. I’ll decide fast.")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundColor(.black.opacity(0.48))
                    .multilineTextAlignment(.center)
                    .opacity(showDurationSelection || showDeniedMessage || isLoading ? 0 : 1)

                contentView
                    .frame(maxWidth: .infinity)

                Spacer(minLength: 30)
            }
            .padding(.horizontal, 34)
            .padding(.vertical, 18)

            closeButton
        }
        .clipShape(Circle())
        .contentShape(Circle())
        .overlay(
            Circle()
                .stroke(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.82),
                            Configuration.Colors.accent.opacity(0.38),
                            Configuration.Colors.primary.opacity(0.3)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1.4
                )
        )
        .shadow(color: Configuration.Colors.primary.opacity(0.2), radius: 28, x: 0, y: 12)
        .shadow(color: Color.black.opacity(0.12), radius: 20, x: 0, y: 10)
    }

    @ViewBuilder
    private var contentView: some View {
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
    }

    private var headlineText: String {
        if showDurationSelection {
            return "Access granted"
        }

        if showDeniedMessage {
            return "Access denied"
        }

        if isLoading {
            return "Checking with Llama"
        }

        return "Why are you here?"
    }

    private var closeButton: some View {
        Button(action: {
            withAnimation(.easeInOut(duration: Configuration.Animation.orbTransitionDuration)) {
                windowManager?.collapseOrb()
            }
        }) {
            Image(systemName: "xmark")
                .font(.system(size: 13, weight: .semibold))
                .foregroundColor(.black.opacity(0.58))
                .frame(width: 30, height: 30)
                .background(Circle().fill(Color.white.opacity(0.58)))
                .overlay(Circle().stroke(Color.white.opacity(0.78), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .padding(.top, 42)
        .padding(.trailing, 48)
    }

    private var inputView: some View {
        VStack(spacing: 10) {
            promptBox
        }
        .padding(.horizontal, 2)
    }

    private var loadingView: some View {
        VStack(spacing: 12) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: Configuration.Colors.accent))
                .scaleEffect(1.1)

            Text("AI is thinking...")
                .font(.system(size: 13, weight: .medium))
                .foregroundColor(.black.opacity(0.58))
        }
        .padding(.top, 10)
    }

    private var responseView: some View {
        VStack(spacing: 14) {
            Text(aiResponse)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.black.opacity(0.72))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.horizontal, 6)

            Button(action: {
                windowManager?.collapseOrb()
                resetState()
            }) {
                Label("Close", systemImage: "checkmark")
                    .font(.system(size: 13, weight: .semibold))
            }
            .buttonStyle(MinimalActionButtonStyle())
        }
        .padding(.horizontal, 6)
    }

    private var durationSelectionView: some View {
        VStack(spacing: 14) {
            Text("Choose duration:")
                .font(.system(size: 13))
                .foregroundColor(.black.opacity(0.52))

            HStack(spacing: 8) {
                ForEach(0..<Configuration.accessDurationLabels.count, id: \.self) { index in
                    Button(action: {
                        selectDuration(index: index)
                    }) {
                        Text(Configuration.accessDurationLabels[index])
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(MinimalActionButtonStyle())
                }
            }
        }
        .padding(.horizontal, 6)
    }

    private var deniedMessageView: some View {
        VStack(spacing: 12) {
            Image(systemName: "xmark.shield.fill")
                .font(.system(size: 34))
                .foregroundColor(.red)

            Text("Stay focused and return to work.")
                .font(.system(size: 13))
                .foregroundColor(.black.opacity(0.52))
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, 6)
    }

    private var promptBox: some View {
        HStack(alignment: .bottom, spacing: 10) {
            ReliablePromptTextView(
                text: $userInput,
                placeholder: "I need this because...",
                onSubmit: submitRequest
            )
            .frame(height: 76)

            Button(action: submitRequest) {
                Image(systemName: "arrow.up")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
                    .frame(width: 34, height: 34)
                    .background(
                        Circle()
                            .fill(canSubmit ? Configuration.Colors.primary : Color.black.opacity(0.16))
                    )
                    .overlay(Circle().stroke(Color.white.opacity(canSubmit ? 0.58 : 0.24), lineWidth: 1))
            }
            .buttonStyle(.plain)
            .disabled(!canSubmit)
            .help("Submit")
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color.white.opacity(0.74))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(
                    LinearGradient(
                        colors: [
                            Color.white.opacity(0.92),
                            Configuration.Colors.accent.opacity(0.22),
                            Configuration.Colors.primary.opacity(0.18)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 1
                )
        )
        .shadow(color: Color.black.opacity(0.1), radius: 16, x: 0, y: 9)
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
                    showDeniedMessage = true

                    // Trigger overlay and app hiding after delay
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        windowManager?.showOverlay()
                        decisionEngine.hideCurrentApp()

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
    }
}

private struct MinimalActionButtonStyle: ButtonStyle {
    func makeBody(configuration: Self.Configuration) -> some View {
        configuration.label
            .font(.system(size: 13, weight: .semibold))
            .foregroundColor(.black.opacity(0.76))
            .padding(.horizontal, 13)
            .frame(height: 36)
            .background(
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.white.opacity(configuration.isPressed ? 0.62 : 0.82),
                                AppThemeColors.accent.opacity(configuration.isPressed ? 0.22 : 0.34)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .stroke(Color.white.opacity(0.82), lineWidth: 1)
            )
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
    }
}

private typealias AppThemeColors = Configuration.Colors

private struct PremiumCircleTexture: View {
    var body: some View {
        TimelineView(.animation) { timeline in
            let time = timeline.date.timeIntervalSinceReferenceDate

            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [
                                Color(red: 0.98, green: 1.0, blue: 0.98),
                                Color(red: 0.86, green: 0.97, blue: 1.0),
                                Color(red: 0.96, green: 0.9, blue: 1.0)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )

                movingBlob(
                    color: Configuration.Colors.accent.opacity(0.34),
                    size: 230,
                    x: CGFloat(sin(time * 0.7)) * 54,
                    y: CGFloat(cos(time * 0.58)) * 42
                )

                movingBlob(
                    color: Configuration.Colors.primary.opacity(0.3),
                    size: 260,
                    x: CGFloat(cos(time * 0.48)) * 62,
                    y: CGFloat(sin(time * 0.64)) * 52
                )

                movingBlob(
                    color: Color(red: 1.0, green: 0.42, blue: 0.74).opacity(0.24),
                    size: 210,
                    x: CGFloat(sin(time * 0.52 + 1.2)) * 76,
                    y: CGFloat(cos(time * 0.44 + 0.8)) * 56
                )

                Circle()
                    .stroke(Color.white.opacity(0.62), lineWidth: 18)
                    .blur(radius: 18)
                    .scaleEffect(0.9 + CGFloat(sin(time * 0.6)) * 0.025)

                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                Color.white.opacity(0.42),
                                Color.white.opacity(0.16),
                                Color.clear
                            ],
                            center: .topLeading,
                            startRadius: 10,
                            endRadius: 220
                        )
                    )
            }
        }
    }

    private func movingBlob(color: Color, size: CGFloat, x: CGFloat, y: CGFloat) -> some View {
        Circle()
            .fill(color)
            .frame(width: size, height: size)
            .blur(radius: 34)
            .offset(x: x, y: y)
            .blendMode(.multiply)
    }
}

private struct ReliablePromptTextView: NSViewRepresentable {
    @Binding var text: String
    let placeholder: String
    let onSubmit: () -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(text: $text, onSubmit: onSubmit)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        scrollView.drawsBackground = false
        scrollView.hasVerticalScroller = false
        scrollView.hasHorizontalScroller = false
        scrollView.borderType = .noBorder

        let textView = PlaceholderTextView()
        textView.placeholder = placeholder
        textView.delegate = context.coordinator
        textView.isRichText = false
        textView.importsGraphics = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticTextReplacementEnabled = false
        textView.allowsUndo = true
        textView.font = NSFont.systemFont(ofSize: 14, weight: .regular)
        textView.textColor = NSColor.black.withAlphaComponent(0.78)
        textView.insertionPointColor = NSColor.black
        textView.backgroundColor = .clear
        textView.drawsBackground = false
        textView.textContainerInset = NSSize(width: 0, height: 7)
        textView.textContainer?.lineFragmentPadding = 0
        textView.textContainer?.widthTracksTextView = true
        textView.textContainer?.containerSize = NSSize(width: scrollView.contentSize.width, height: .greatestFiniteMagnitude)
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.minSize = NSSize(width: 0, height: 0)
        textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
        textView.frame = NSRect(x: 0, y: 0, width: 240, height: 82)
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

        DispatchQueue.main.async {
            if textView.window?.firstResponder !== textView {
                textView.window?.makeFirstResponder(textView)
            }
        }
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

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)

        guard string.isEmpty else { return }

        let attributes: [NSAttributedString.Key: Any] = [
            .foregroundColor: NSColor.black.withAlphaComponent(0.42),
            .font: NSFont.systemFont(ofSize: 14, weight: .regular)
        ]
        placeholder.draw(
            at: NSPoint(x: textContainerInset.width, y: textContainerInset.height),
            withAttributes: attributes
        )
    }
}
