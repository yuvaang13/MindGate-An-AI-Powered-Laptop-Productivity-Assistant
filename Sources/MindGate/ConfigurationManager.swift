
import Foundation

class ConfigurationManager: ObservableObject {
    @Published var configuration: Configuration

    private let fileURL: URL

    init() {
        let fileManager = FileManager.default
        guard let applicationSupportURL = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            fatalError("Unable to find application support directory.")
        }
        let appDirectoryURL = applicationSupportURL.appendingPathComponent("MindGate")
        self.fileURL = appDirectoryURL.appendingPathComponent("Configuration.json")
        
        if !fileManager.fileExists(atPath: appDirectoryURL.path) {
            do {
                try fileManager.createDirectory(at: appDirectoryURL, withIntermediateDirectories: true, attributes: nil)
            } catch {
                fatalError("Unable to create application directory: \(error.localizedDescription)")
            }
        }

        self.configuration = ConfigurationManager.loadConfiguration(from: fileURL)
    }

    private static func loadConfiguration(from url: URL) -> Configuration {
        let fileManager = FileManager.default
        if fileManager.fileExists(atPath: url.path) {
            do {
                let data = try Data(contentsOf: url)
                let decoder = JSONDecoder()
                let configuration = try decoder.decode(Configuration.self, from: data)
                return configuration
            } catch {
                print("Error decoding configuration: \(error.localizedDescription)")
                // If decoding fails, return default and try to save it.
                let defaultConfig = Configuration.default
                saveConfiguration(defaultConfig, to: url)
                return defaultConfig
            }
        } else {
            let defaultConfig = Configuration.default
            saveConfiguration(defaultConfig, to: url)
            return defaultConfig
        }
    }

    static func saveConfiguration(_ configuration: Configuration, to url: URL) {
        do {
            let encoder = JSONEncoder()
            encoder.outputFormatting = .prettyPrinted
            let data = try encoder.encode(configuration)
            try data.write(to: url, options: .atomic)
        } catch {
            print("Error saving configuration: \(error.localizedDescription)")
        }
    }

    func save() {
        ConfigurationManager.saveConfiguration(configuration, to: fileURL)
    }
}
