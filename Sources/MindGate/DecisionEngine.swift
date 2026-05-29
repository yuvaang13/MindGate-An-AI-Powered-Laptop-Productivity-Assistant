import Foundation
import AppKit

struct DecisionResult {
    let isApproved: Bool
    let message: String
}

class DecisionEngine {
    static let shared = DecisionEngine()
    
    private let ollamaService: OllamaService
    private var currentApp: NSRunningApplication?
    private var accessTimer: Timer?
    
    init(ollamaService: OllamaService? = nil) {
        self.ollamaService = ollamaService ?? OllamaService()
    }
    
    func setCurrentApp(_ app: NSRunningApplication) {
        self.currentApp = app
    }
    
    func evaluateRequest(userInput: String) async throws -> DecisionResult {
        let systemPrompt = """
        You are a highly advanced, strict productivity mentor. The user is trying to access a distracting app. Their reason is: '\(userInput)'. 
        If this is genuinely essential for immediate work, task tracking, or safety, respond only with the word 'YES'. 
        If it is an excuse, mindless scrolling, or procrastination, reply only with the word 'NO'.
        """
        
        do {
            let response = try await ollamaService.generateResponse(prompt: systemPrompt)
            
            if response.uppercased() == "YES" {
                return DecisionResult(isApproved: true, message: "Access approved. Please select a duration.")
            } else {
                return DecisionResult(isApproved: false, message: "Access denied. Stay focused on your work.")
            }
        } catch {
            // If Ollama fails, default to denying access for safety
            return DecisionResult(isApproved: false, message: "AI service unavailable. Access denied.")
        }
    }
    
    func grantAccess(for duration: TimeInterval) {
        // Start a timer to revoke access after the duration
        accessTimer?.invalidate()
        
        accessTimer = Timer.scheduledTimer(withTimeInterval: duration, repeats: false) { [weak self] _ in
            self?.revokeAccess()
        }
        
        print("Access granted for \(duration) seconds")
    }
    
    private func revokeAccess() {
        // Hide the current app when time expires
        if let app = currentApp {
            app.hide()
        }
        
        accessTimer?.invalidate()
        accessTimer = nil
    }
    
    func hideCurrentApp() {
        if let app = currentApp {
            app.hide()
        }
    }
    
    func cancelAccessTimer() {
        accessTimer?.invalidate()
        accessTimer = nil
    }
}
