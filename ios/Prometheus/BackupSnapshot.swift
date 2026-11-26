import Foundation
import CoreFoundation

struct BackupSnapshot {
    let data: Data
    let counts: [(label: String, count: Int)]

    init(data: Data) throws {
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any],
              let version = root["v"] as? NSNumber,
              CFGetTypeID(version) != CFBooleanGetTypeID(),
              version.doubleValue == 1,
              let days = root["days"] as? [String: [String: Any]],
              days.values.allSatisfy({ $0["blocks"] is [[String: Any]] })
        else { throw BackupError.invalid }

        let workouts = try Self.read("workouts", from: root, fallback: [[String: Any]]())
        let foods = try Self.read("food", from: root, fallback: [String: [[String: Any]]]())
        let stepDays = try Self.read("steps", from: root, fallback: [String: Double]())
        let weights = try Self.read("weights", from: root, fallback: [String: Double]())
        let reviews = try Self.read("bodyReviews", from: root, fallback: [String: [String: Any]]())
        let assignments = try Self.read("bodyWeek", from: root, fallback: [String]())
        let dateFormatter = ISO8601DateFormatter()
        guard assignments.count <= 365, Set(assignments).count == assignments.count,
              assignments.allSatisfy({ day in
                  day.count == 10 && day.range(of: #"^[0-9]{4}-[0-9]{2}-[0-9]{2}$"#, options: .regularExpression) != nil
                  && dateFormatter.date(from: day + "T12:00:00Z") != nil
              })
        else { throw BackupError.invalid }
        let moods = try Self.read("checkins", from: root, fallback: [[String: Any]]())
        let hero = try Self.read("hero", from: root, fallback: [String: [String: Any]]())
        self.data = data
        counts = [
            ("Agenda days", days.count),
            ("Workouts", workouts.count),
            ("Food entries", foods.values.reduce(0) { $0 + $1.count }),
            ("Weigh-ins", weights.count),
            ("Step entries", stepDays.count),
            ("Body plan dates", assignments.count),
            ("Sunday reviews", reviews.count),
            ("Mind check-ins", moods.count),
            ("Hero weeks", hero.count),
        ]
    }

    private static func read<Value>(_ key: String, from root: [String: Any], fallback: Value) throws -> Value {
        guard let raw = root[key] else { return fallback }
        guard let result = raw as? Value else { throw BackupError.invalid }
        return result
    }
}

enum BackupError: LocalizedError {
    case invalid

    var errorDescription: String? { "Choose a valid Prometheus version 1 backup." }
}

struct BackupStorage {
    let directory: URL
    private var file: URL { directory.appendingPathComponent("backup-v1.json") }

    func load() throws -> BackupSnapshot? {
        do {
            return try BackupSnapshot(data: Data(contentsOf: file))
        } catch let error as CocoaError where error.code == .fileReadNoSuchFile {
            return nil
        }
    }

    func save(_ backup: BackupSnapshot) throws {
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try backup.data.write(to: file, options: .atomic)
    }

    static func appStorage() throws -> Self {
        let support = try FileManager.default.url(for: .applicationSupportDirectory,
            in: .userDomainMask, appropriateFor: nil, create: true)
        return Self(directory: support.appendingPathComponent("Prometheus", isDirectory: true))
    }
}
