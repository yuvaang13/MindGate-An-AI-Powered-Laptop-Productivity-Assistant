import Foundation

class OllamaService {
    private let session = URLSession.shared
    private let baseURL: String
    private let model: String
    
    init(baseURL: String = Configuration.ollamaURL, model: String = Configuration.ollamaModel) {
        self.baseURL = baseURL
        self.model = model
    }
    
    func generateResponse(prompt: String) async throws -> String {
        guard let url = URL(string: baseURL) else {
            throw OllamaError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let requestBody: [String: Any] = [
            "model": model,
            "prompt": prompt,
            "stream": false
        ]
        
        request.httpBody = try JSONSerialization.data(withJSONObject: requestBody)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw OllamaError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            throw OllamaError.serverError(httpResponse.statusCode)
        }
        
        guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let responseText = json["response"] as? String else {
            throw OllamaError.invalidResponseData
        }
        
        return responseText.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    func checkConnection() async throws -> Bool {
        guard let url = URL(string: baseURL.replacingOccurrences(of: "/api/generate", with: "/api/tags")) else {
            throw OllamaError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        
        let (_, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw OllamaError.invalidResponse
        }
        
        return httpResponse.statusCode == 200
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
