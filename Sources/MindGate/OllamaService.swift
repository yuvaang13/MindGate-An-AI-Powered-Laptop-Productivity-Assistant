import Foundation
import OSLog

class OllamaService {
    private let session = URLSession.shared
    private let configurationManager: ConfigurationManager
    private let logger = Logger(subsystem: "com.mindgate.MindGate", category: "OllamaService")
    
    init(configurationManager: ConfigurationManager) {
        self.configurationManager = configurationManager
    }
    
    func generateResponse(prompt: String) async throws -> String {
        logger.info("Generating response for prompt...")
        
        // Validate and sanitize the URL
        let rawURL = configurationManager.configuration.settings.ollamaURL
        guard let url = URL(string: rawURL) else {
            logger.error("Invalid Ollama URL: \(rawURL)")
            throw OllamaError.invalidURL
        }
        
        // Validate model name
        let modelName = configurationManager.configuration.settings.ollamaModel.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !modelName.isEmpty else {
            logger.error("Ollama model name is empty")
            throw OllamaError.invalidResponse
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30 // Add timeout
        
        let requestBody: [String: Any] = [
            "model": modelName,
            "prompt": prompt,
            "stream": false,
            "options": [
                "temperature": 0.7,
                "top_p": 0.9
            ]
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        do {
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                logger.error("Invalid response from Ollama server.")
                throw OllamaError.invalidResponse
            }
            
            guard httpResponse.statusCode == 200 else {
                logger.error("Ollama server returned status code: \(httpResponse.statusCode)")
                if let responseString = String(data: data, encoding: .utf8) {
                    logger.error("Response body: \(responseString)")
                }
                throw OllamaError.serverError(httpResponse.statusCode)
            }
            
            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let responseText = json["response"] as? String else {
                logger.error("Failed to decode Ollama response JSON. Data: \(String(data: data, encoding: .utf8) ?? "nil")")
                throw OllamaError.invalidResponseData
            }
            
            logger.info("Successfully received response from Ollama.")
            return responseText.trimmingCharacters(in: .whitespacesAndNewlines)
        } catch let error as OllamaError {
            throw error
        } catch {
            logger.error("Network error calling Ollama: \(error.localizedDescription)")
            throw OllamaError.connectionFailed
        }
    }
    
    func checkConnection() async -> Bool {
        logger.info("Checking Ollama connection...")
        guard let url = URL(string: configurationManager.configuration.settings.ollamaURL.replacingOccurrences(of: "/api/generate", with: "/api/tags")) else {
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
