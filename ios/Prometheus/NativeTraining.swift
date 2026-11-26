import Foundation

struct ExerciseKind {
    var weighted: Bool
    var timed = false
    var distance = false
    var unit: String { timed ? "sec" : distance ? "m" : "reps" }
}

struct LiftPrescription {
    let name: String
    var count: Int
    var minimum: Int
    var maximum: Int
    var perSide: Bool
    var timed: Bool

    init(_ name: String, _ count: Int, _ minimum: Int, _ maximum: Int, perSide: Bool = false, timed: Bool = false) {
        self.name = name
        self.count = count
        self.minimum = minimum
        self.maximum = maximum
        self.perSide = perSide
        self.timed = timed
    }
}

enum TrainingDay {
    case lift(String, [LiftPrescription])
    case recovery(String, String)
    var name: String {
        switch self {
        case .lift(let name, _), .recovery(let name, _): name
        }
    }
}

struct NativeSet: Codable {
    var w: Double
    var r: Int
    var done = false
}

struct NativeExercise: Codable {
    var name: String
    var sets: [NativeSet]
    var restSeconds: Int?
    var perSide: Bool?
    var targetRange: [Int]?
}

struct NativeRun: Codable {
    var id: String
    var name: String
    var day: String
    var startedAt: Double
    var endedAt: Double?
    var ex: [NativeExercise]
    var cur: Int
    var bodySession: Int?
    var restUntil: Double?
}

enum NativeTraining {
    static let totalDays = 365

    static func dates(in root: [String: Any], today: String) -> [String] {
        var dates = root["bodyWeek"] as? [String] ?? []
        guard let first = dates.min() else { return (0..<totalDays).map { BodyDate.add(today, days: $0) } }
        var used = Set(dates)
        var offset = 7
        while dates.count < totalDays {
            let date = BodyDate.add(first, days: offset)
            if used.insert(date).inserted { dates.append(date) }
            offset += 1
        }
        return dates
    }

    static func session(_ index: Int) -> TrainingDay? {
        guard (0..<totalDays).contains(index) else { return nil }
        if index == totalDays - 1 { return .recovery("Year review", "Take an easy walk and review the year.") }
        let weekIndex = index / 7
        let base = week[index % 7]
        guard case .lift(let name, let lifts) = base else { return base }
        let phase: (main: [Int], accessory: [Int], extra: Int) = switch weekIndex {
        case 4..<16: ([6, 10], [10, 15], 1)
        case 16..<28: ([5, 8], [8, 12], 1)
        case 28..<40: ([8, 12], [12, 16], 1)
        default: ([6, 10], [10, 15], 0)
        }
        let lighter = weekIndex % 4 == 3
        return .lift(lighter ? "\(name) · lighter" : name, lifts.enumerated().map { position, lift in
            var next = lift
            let main = position < 2 && lift.count >= 3
            if weekIndex >= 4 && !lift.timed {
                let targets = main ? phase.main : phase.accessory
                next.minimum = targets[0]
                next.maximum = targets[1]
            }
            let count = lift.count + (main ? phase.extra : 0)
            next.count = lighter ? max(1, Int(Double(count) * 0.6)) : count
            return next
        })
    }

    static var now: Double { Date().timeIntervalSince1970 * 1000 }

    static func exercise(_ lift: LiftPrescription, prior: [NativeRun]) -> NativeExercise {
        let weight = prior.reversed().lazy.flatMap(\.ex).first {
            $0.name == lift.name && $0.sets.contains { $0.done && $0.r > 0 }
        }?.sets.last { $0.done && $0.r > 0 }?.w ?? 0
        return NativeExercise(name: lift.name, sets: Array(repeating: NativeSet(w: weight, r: lift.minimum), count: lift.count),
                              restSeconds: lift.count >= 3 ? 90 : 60, perSide: lift.perSide,
                              targetRange: [lift.minimum, lift.maximum])
    }

    static func encode(_ run: NativeRun) throws -> Any {
        try JSONSerialization.jsonObject(with: JSONEncoder().encode(run))
    }
}
