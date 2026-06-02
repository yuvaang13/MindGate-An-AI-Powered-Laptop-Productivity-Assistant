import Foundation
import OSLog

class OllamaService {
    private let session = URLSession.shared
    private let configuration: Configuration
    private let logger = Logger(subsystem: "com.mindgate.MindGate", category: "OllamaService")
    
    init(configuration: Configuration) {
        self.configuration = configuration
    }
    
    func generateResponse(prompt: String) async throws -> String {
        logger.info("Generating response for prompt...")
        guard let url = URL(string: configuration.settings.ollamaURL) else {
            logger.error("Invalid Ollama URL: \(self.configuration.settings.ollamaURL)")
            throw OllamaError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let requestBody: [String: Any] = [
            "model": configuration.settings.ollamaModel,
            "prompt": prompt,
            "stream": false
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            logger.error("Invalid response from Ollama server.")
            throw OllamaError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            logger.error("Ollama server returned status code: \(httpResponse.statusCode)")
            throw OllamaError.serverError(httpResponse.statusCode)
        }
        
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let responseText = json["response"] as? String else {
            logger.error("Failed to decode Ollama response JSON.")
            throw OllamaError.invalidResponseData
        }
        
        logger.info("Successfully received response from Ollama.")
        return responseText.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    func checkConnection() async -> Bool {
        logger.info("Checking Ollama connection...")
        guard let url = URL(string: configuration.settings.ollamaURL.replacingOccurrences(of: "/api/generate", with: "/api/tags")) else {
            logger.error("Invalid Ollama URL for connection check.")
            return false
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        
        do {
            let (_, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                logger.warning("Invalid response during connection check.")
                return false
            }
            
            let success = httpResponse.statusCode == 200
            if success {
                logger.info("Ollama connection successful.")
            } else {
                logger.warning("Ollama connection check failed with status code: \(httpResponse.statusCode)")
            }
            return success
        } catch {
            logger.error("Ollama connection check request failed: \(error.localizedDescription)")
            return false
        }
    }
}

enum OllamaError: LocalizedError {
    case invalidURL
    case invalidResponse
    case serverError(Int)
    case invalidResponseData
    case connectionFailed
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid Ollama URL"
        case .invalidResponse:
            return "Invalid response from Ollama"
        case .serverError(let code):
            return "Ollama server error: \(code)"
        case .invalidResponseData:
            return "Invalid response data from Ollama"
        case .connectionFailed:
            return "Failed to connect to Ollama. Make sure Ollama is running on localhost:11434"
        }
    }
}
