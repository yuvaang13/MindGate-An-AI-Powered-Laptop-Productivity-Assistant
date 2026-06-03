
import Foundation
import SwiftUI

struct AppSettings: Codable {
    var distractingApps: [String]
    var restrictedKeywords: [String]
    var monitoredBrowsers: [String]
    var ollamaURL: String
    var ollamaModel: String
    var accessDurations: [TimeInterval]
    var accessDurationLabels: [String]
    var productiveTasks: [String]
    var productiveApps: [String]
    var justificationCountdownDuration: Int

    init(
        distractingApps: [String],
        restrictedKeywords: [String],
        monitoredBrowsers: [String],
        ollamaURL: String,
        ollamaModel: String,
        accessDurations: [TimeInterval],
        accessDurationLabels: [String],
        productiveTasks: [String],
        productiveApps: [String],
        justificationCountdownDuration: Int
    ) {
        self.distractingApps = distractingApps
        self.restrictedKeywords = restrictedKeywords
        self.monitoredBrowsers = monitoredBrowsers
        self.ollamaURL = ollamaURL
        self.ollamaModel = ollamaModel
        self.accessDurations = accessDurations
        self.accessDurationLabels = accessDurationLabels
        self.productiveTasks = productiveTasks
        self.productiveApps = productiveApps
        self.justificationCountdownDuration = justificationCountdownDuration
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let defaults = Self.defaultSettings

        distractingApps = try container.decodeIfPresent([String].self, forKey: .distractingApps) ?? defaults.distractingApps
        restrictedKeywords = try container.decodeIfPresent([String].self, forKey: .restrictedKeywords) ?? defaults.restrictedKeywords
        monitoredBrowsers = try container.decodeIfPresent([String].self, forKey: .monitoredBrowsers) ?? defaults.monitoredBrowsers
        ollamaURL = try container.decodeIfPresent(String.self, forKey: .ollamaURL) ?? defaults.ollamaURL
        ollamaModel = try container.decodeIfPresent(String.self, forKey: .ollamaModel) ?? defaults.ollamaModel
        accessDurations = try container.decodeIfPresent([TimeInterval].self, forKey: .accessDurations) ?? defaults.accessDurations
        accessDurationLabels = try container.decodeIfPresent([String].self, forKey: .accessDurationLabels) ?? defaults.accessDurationLabels
        productiveTasks = try container.decodeIfPresent([String].self, forKey: .productiveTasks) ?? defaults.productiveTasks
        productiveApps = try container.decodeIfPresent([String].self, forKey: .productiveApps) ?? defaults.productiveApps
        justificationCountdownDuration = try container.decodeIfPresent(Int.self, forKey: .justificationCountdownDuration) ?? defaults.justificationCountdownDuration
    }

    static let defaultSettings = AppSettings(
        distractingApps: [
            "Discord", "Slack", "Twitter", "Telegram", "Reddit", "TikTok",
            "Instagram", "Facebook", "Netflix", "YouTube", "Twitch"
        ],
        restrictedKeywords: [
            "youtube", "twitter", "x.com", "facebook", "instagram", "tiktok", "reddit",
            "twitch", "netflix", "spotify", "discord", "linkedin", "pinterest", "snapchat",
            "whatsapp", "telegram", "medium", "buzzfeed", "hackernews", "producthunt",
            "dribbble", "behance", "imgur", "giphy", "9gag", "memes", "gaming", "espn",
            "bleacher", "cnn", "fox news", "msnbc", "bbc", "news", "weather", "stocks",
            "crypto", "bitcoin", "trading", "shopping", "amazon", "ebay", "etsy",
            "walmart", "target", "fashion", "celebrity", "gossip", "entertainment",
            "movies", "tv shows", "streaming", "video", "viral", "trending"
        ],
        monitoredBrowsers: [
            "Safari", "Google Chrome", "Microsoft Edge", "Firefox", "Brave"
        ],
        ollamaURL: "http://localhost:11434/api/generate",
        ollamaModel: "gemma3:1b",
        accessDurations: [300, 600, 900],
        accessDurationLabels: ["5 Mins", "10 Mins", "15 Mins"],
        productiveTasks: [
            "Review today's coding tasks",
            "Plan next steps for MindGate",
            "Learn a new Swift concept",
            "Organize project files",
            "Respond to important emails"
        ],
        productiveApps: [
            "Xcode",
            "Safari", // Can be used for productive research
            "Things", // Example task manager
            "Obsidian", // Example note-taking app
            "Terminal"
        ],
        justificationCountdownDuration: 15
    )
}

struct UITheme: Codable {
    struct Colors: Codable {
        let primary: String
        let secondary: String
        let accent: String
        let background: String
        let surface: String
        let text: String
        let textSecondary: String
    }

    struct Animation: Codable {
        let orbBreathingDuration: Double
        let orbTransitionDuration: Double
        let overlayFadeDuration: Double
    }

    struct Dimensions: Codable {
        let orbSize: CGFloat
        let orbExpandedWidth: CGFloat
        let orbExpandedHeight: CGFloat
        let chatCornerRadius: CGFloat
        let orbXOffset: CGFloat
        let orbYOffset: CGFloat
        let orbDistractionOffset: CGFloat
    }

    let colors: Colors
    let animation: Animation
    let dimensions: Dimensions

    static let defaultTheme = UITheme(
        colors: UITheme.Colors(
            primary: "FFFFFF",
            secondary: "FFFFFFB3",
            accent: "FFFFFF99",
            background: "000000",
            surface: "000000",
            text: "FFFFFF",
            textSecondary: "FFFFFFB3"
        ),
        animation: UITheme.Animation(
            orbBreathingDuration: 2.0,
            orbTransitionDuration: 0.3,
            overlayFadeDuration: 0.5
        ),
        dimensions: UITheme.Dimensions(
            orbSize: 60,
            orbExpandedWidth: 380,
            orbExpandedHeight: 380,
            chatCornerRadius: 180,
            orbXOffset: 12,
            orbYOffset: 12,
            orbDistractionOffset: 50
        )
    )
}

struct Configuration: Codable {
    var settings: AppSettings
    var theme: UITheme

    static let `default` = Configuration(
        settings: .defaultSettings,
        theme: .defaultTheme
    )
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
