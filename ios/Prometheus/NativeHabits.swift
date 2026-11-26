import Foundation

struct HabitCatalog: Decodable {
    struct Category: Decodable { let n: String; let color: String; let areas: [Area] }
    struct Area: Decodable { let n: String; let goal: Int }
    struct Corner: Decodable { let n: String; let color: String; let ink: Bool; let words: [String] }
    struct Task: Decodable {
        let name: String
        let minutes: Int
        init(from decoder: Decoder) throws {
            var row = try decoder.unkeyedContainer()
            name = try row.decode(String.self)
            minutes = max(1, Int((try row.decode(Double.self) * 60).rounded()))
        }
    }
    let cats: [Category]
    let tasks: [String: [Task]]
    let corners: [Corner]
    let quests: [String: [[String]]]

    static let current: Self? = {
        guard let url = Bundle.main.url(forResource: "HabitCatalog", withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(Self.self, from: data)
    }()
}

extension BodyDate {
    static func date(_ key: String) -> Date? {
        let parts = key.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    static func week(_ key: String) -> [String] {
        let weekday = date(key).map { Calendar.current.component(.weekday, from: $0) } ?? 2
        let offset = (weekday + 5) % 7
        return (0..<7).map { add(key, days: $0 - offset) }
    }

    static func reviewSunday(_ key: String) -> String {
        let sunday = week(key)[6]
        return sunday <= key ? sunday : add(sunday, days: -7)
    }

    static func minutes(_ date: Date) -> Int {
        let parts = Calendar.current.dateComponents([.hour, .minute], from: date)
        return (parts.hour ?? 0) * 60 + (parts.minute ?? 0)
    }
}

extension NativeLog {
    var dayMap: [String: [String: Any]] { root["days"] as? [String: [String: Any]] ?? [:] }
    func blocks(_ day: String) -> [[String: Any]] { dayMap[day]?["blocks"] as? [[String: Any]] ?? [] }

    @discardableResult
    func updateDay(_ date: String, _ change: (inout [String: Any]) -> Void) -> Bool {
        update { data in
            var days = dayMap
            var day = days[date] ?? ["blocks": [[String: Any]]()]
            change(&day)
            days[date] = day
            data["days"] = days
        }
    }

    @discardableResult
    func updateBlocks(_ date: String, _ change: (inout [[String: Any]]) -> Void) -> Bool {
        updateDay(date) { day in
            var entries = blocks(date)
            change(&entries)
            day["blocks"] = entries.sorted { ($0["start"] as? Int ?? 0) < ($1["start"] as? Int ?? 0) }
        }
    }

    func addHabit(name: String, pillar: String, minutes: Int, tag: String, value: String, done: Bool) {
        let today = BodyDate.today
        let now = BodyDate.minutes(Date())
        let start = ((now + (now < 240 ? 1440 : 0) + 14) / 15) * 15
        updateBlocks(today) { entries in
            var block: [String: Any] = ["id": UUID().uuidString, "name": name, "pillar": pillar,
                                         "start": start, "len": minutes, "done": done, tag: value]
            if done { block["doneAt"] = NativeTraining.now }
            entries.append(block)
        }
    }

    func setNumber(_ value: Double?, field: String, on day: String) -> Bool {
        update { data in
            var values = data[field] as? [String: Double] ?? [:]
            values[day] = value
            data[field] = values
        }
    }

    func currentTarget(_ key: String = BodyDate.today) -> Double? {
        let targets = root["stepTargets"] as? [String: Double] ?? [:]
        return targets.keys.filter { $0 <= key }.max().flatMap { targets[$0] }
    }

    func liftDays(in dates: [String]) -> Int {
        Set(workouts.compactMap { raw -> String? in
            guard let workout = decode(raw, as: NativeRun.self), workout.endedAt != nil, dates.contains(workout.day),
                  workout.ex.contains(where: { $0.sets.contains { $0.done && $0.r > 0 } }) else { return nil }
            return workout.day
        }).count
    }

    func report(sunday: String) -> [String: Any] {
        let dates = (-7 ..< 0).map { BodyDate.add(sunday, days: $0) }
        let steps = root["steps"] as? [String: Double] ?? [:]
        let weights = root["weights"] as? [String: Double] ?? [:]
        let meals = dates.compactMap { food[$0] }.filter { !$0.isEmpty }
        var result: [String: Any] = ["liftingDays": liftDays(in: dates)]
        func average(_ values: [Double], key: String, days: String) {
            result[days] = values.count
            if !values.isEmpty { result[key] = values.reduce(0, +) / Double(values.count) }
        }
        average(dates.compactMap { steps[$0] }, key: "averageSteps", days: "stepDays")
        average(dates.compactMap { weights[$0] }, key: "averageWeight", days: "weighInDays")
        average(meals.map { $0.reduce(0) { $0 + ($1["kcal"] as? Double ?? 0) } }, key: "averageCalories", days: "foodDays")
        average(meals.filter { $0.allSatisfy { $0["p"] is Double } }
            .map { $0.reduce(0) { $0 + ($1["p"] as? Double ?? 0) } }, key: "averageProtein", days: "proteinDays")
        return result
    }
}
