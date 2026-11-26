import Foundation
import Observation

@Observable
final class NativeLog {
    private(set) var root: [String: Any] = ["v": 1, "days": [:]]
    var error: String?
    private let storage: BackupStorage?

    init(storage: BackupStorage? = try? .appStorage()) {
        self.storage = storage
        reload()
    }

    func reload() {
        do {
            if let snapshot = try storage?.load(),
               let value = try JSONSerialization.jsonObject(with: snapshot.data) as? [String: Any] {
                root = value
            }
        } catch { self.error = error.localizedDescription }
    }

    @discardableResult
    func update(_ change: (inout [String: Any]) throws -> Void) -> Bool {
        do {
            guard let storage else { throw CocoaError(.fileWriteUnknown) }
            var next = root
            try change(&next)
            let data = try JSONSerialization.data(withJSONObject: next, options: [.sortedKeys])
            try storage.save(BackupSnapshot(data: data))
            root = next
            return true
        } catch {
            self.error = error.localizedDescription
            return false
        }
    }

    var food: [String: [[String: Any]]] { root["food"] as? [String: [[String: Any]]] ?? [:] }
    var workouts: [[String: Any]] { root["workouts"] as? [[String: Any]] ?? [] }
    var caloriesToday: Int {
        (food[BodyDate.today] ?? []).reduce(0) { $0 + ($1["kcal"] as? Int ?? 0) }
    }

    func addFood(_ entry: [String: Any]) -> Bool {
        update { data in
            var meals = food
            meals[BodyDate.today, default: []].append(entry)
            data["food"] = meals
        }
    }

    func decode<Value: Decodable>(_ value: Any?, as type: Value.Type) -> Value? {
        guard let value, JSONSerialization.isValidJSONObject(value),
              let data = try? JSONSerialization.data(withJSONObject: value) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }
}

enum BodyDate {
    static var today: String {
        let now = Date()
        let calendar = Calendar.current
        let day = calendar.component(.hour, from: now) < 4
            ? calendar.date(byAdding: .day, value: -1, to: now) ?? now : now
        return key(day)
    }

    static func key(_ date: Date) -> String {
        let parts = Calendar.current.dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
    }

    static func add(_ day: String, days: Int) -> String {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3,
              let date = Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2])),
              let result = Calendar.current.date(byAdding: .day, value: days, to: date)
        else { return day }
        return key(result)
    }
}
