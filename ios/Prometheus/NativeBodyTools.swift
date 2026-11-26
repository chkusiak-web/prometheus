import SwiftUI
import Charts

enum BodyTool: String, Identifiable {
    case weight = "Weight plan"
    case sleep = "Log sleep"
    case steps = "Log steps"
    case review = "Sunday review"
    case history = "Lifting history"
    var id: Self { self }
}

struct BodyToolView: View {
    @Environment(\.dismiss) private var dismiss
    let log: NativeLog
    let tool: BodyTool
    @State private var day = Date()
    @State private var number = ""
    @State private var goal = ""
    @State private var pace = ""
    @State private var maintenance = ""
    @State private var calorieFloor = ""
    @State private var workouts = 5
    @State private var smallReward = ""
    @State private var bigReward = ""
    @State private var tasks = ""
    @State private var bedtime = Date()
    @State private var wake = Date()
    @State private var quality = 3
    @State private var knee = ""
    @State private var notes = ""

    private var today: String { BodyDate.today }
    private var key: String { BodyDate.key(day) }
    private var days: [String] { BodyDate.week(today) }
    private var sunday: String { BodyDate.reviewSunday(today) }

    var body: some View {
        NavigationStack {
            Form {
                switch tool {
                case .weight: weightForm
                case .sleep: sleepForm
                case .steps: stepsForm
                case .review: reviewForm
                case .history: history
                }
            }
            .scrollContentBackground(.hidden)
            .background(Palette.bone)
            .tint(Palette.ink)
            .navigationTitle(tool.rawValue)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { dismiss() } } }
        }
        .presentationDragIndicator(.visible)
        .onAppear {
            day = BodyDate.date(today) ?? Date()
            loadFields()
        }
    }

    private var weightForm: some View {
        let weights = log.root["weights"] as? [String: Double] ?? [:]
        let points = weights.keys.sorted().suffix(42).compactMap { key in
            BodyDate.date(key).flatMap { date in weights[key].map { (date, $0) } }
        }
        let recent = (0..<7).compactMap { weights[BodyDate.add(today, days: -$0)] }
        let previous = (7..<14).compactMap { weights[BodyDate.add(today, days: -$0)] }
        let plan = log.root["plan"] as? [String: Any] ?? [:]
        let target = plan["goal"] as? Double ?? 200
        let weeklyPace = plan["pace"] as? Double ?? 1.5
        let average = recent.isEmpty ? nil : recent.reduce(0, +) / Double(recent.count)
        let change = previous.isEmpty ? nil : average.map { previous.reduce(0, +) / Double(previous.count) - $0 }
        let loggingDays = days.filter { day in weights[day] != nil }.count
        let foodDays = days.filter { day in (log.food[day] ?? []).contains { ($0["kcal"] as? Double ?? 0) > 0 } }.count
        let targetLifts = plan["workouts"] as? Int ?? 4
        return Group {
            if !points.isEmpty {
                Section("Trend") {
                    Chart(points.indices, id: \.self) { i in
                        LineMark(x: .value("Date", points[i].0), y: .value("Weight", points[i].1))
                        PointMark(x: .value("Date", points[i].0), y: .value("Weight", points[i].1))
                    }.foregroundStyle(Palette.ember).chartYScale(domain: .automatic(includesZero: false)).frame(height: 160)
                    if let average {
                        LabeledContent("7-day average", value: "\(average.formatted(.number.precision(.fractionLength(1)))) lb")
                        LabeledContent("To goal", value: "\(max(0, average - target).formatted(.number.precision(.fractionLength(1)))) lb")
                        if weeklyPace > 0, average > target {
                            let remaining = (average - target) / weeklyPace * 7
                            if remaining.isFinite && remaining <= 36_500,
                               let date = BodyDate.date(BodyDate.add(today, days: Int(remaining.rounded(.up)))) {
                                LabeledContent("At planned pace", value: date.formatted(date: .abbreviated, time: .omitted))
                            }
                        }
                    }
                    if let change {
                        LabeledContent("Weekly pace", value: change >= weeklyPace - 0.25 ? "On pace" : change >= weeklyPace * 0.6 ? "Close" : "Behind")
                    }
                }
            }
            Section("Weigh in") {
                datePicker
                TextField("Weight in pounds", text: $number).keyboardType(.decimalPad)
                Button("Save weigh-in") {
                    if let value = decimal(number), log.setNumber(value, field: "weights", on: key) { dismiss() }
                }.disabled(decimal(number).map { $0 <= 0 || $0 > 1500 } ?? true)
            }
            Section("This week") {
                LabeledContent("Weigh-ins", value: "\(loggingDays)/6")
                LabeledContent("Food logged", value: "\(foodDays)/6")
                LabeledContent("Lifting days", value: "\(log.liftDays(in: days))/\(targetLifts)")
                LabeledContent(plan["small"] as? String ?? "Coffee treat",
                               value: loggingDays >= 6 && foodDays >= 6 && log.liftDays(in: days) >= targetLifts ? "Earned" : "In progress")
                LabeledContent(plan["big"] as? String ?? "$25 to the gear fund",
                               value: change.map { $0 >= weeklyPace - 0.25 } == true ? "On pace" : "In progress")
            }
            Section("Target") {
                TextField("Goal weight (lb)", text: $goal).keyboardType(.decimalPad)
                TextField("Weekly pace (lb)", text: $pace).keyboardType(.decimalPad)
                Stepper("Weekly lifting goal · \(workouts)", value: $workouts, in: 1...7)
                TextField("Maintenance calories", text: $maintenance).keyboardType(.numberPad)
                TextField("Minimum daily calories", text: $calorieFloor).keyboardType(.numberPad)
                TextField("Weekly habit reward", text: $smallReward)
                TextField("Pace reward", text: $bigReward)
                TextField("Missed-log tasks · one per line", text: $tasks, axis: .vertical)
                Button("Save weight plan") {
                    guard let target = decimal(goal), let speed = decimal(pace),
                          let maint = Int(maintenance), let floor = Int(calorieFloor),
                          (1...100_000).contains(maint), (1...maint).contains(floor) else { return }
                    if log.update({ root in
                        var plan = root["plan"] as? [String: Any] ?? [
                            "maint": 3150, "floor": 1800, "workouts": 5, "small": "Coffee treat",
                            "big": "$25 to the gear fund", "wh": ["Take a walk", "Tidy your desk", "Do the dishes"]]
                        plan["goal"] = target
                        plan["pace"] = speed
                        plan["workouts"] = workouts
                        plan["maint"] = maint
                        plan["floor"] = floor
                        plan["small"] = smallReward
                        plan["big"] = bigReward
                        plan["wh"] = tasks.split(whereSeparator: \.isNewline).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
                        root["plan"] = plan
                    }) { dismiss() }
                }.disabled(!(decimal(goal).map { $0 > 0 && $0 <= 1500 } ?? false) || !(decimal(pace).map { $0 >= 0 && $0 <= 10 } ?? false))
            }
        }
    }

    private var sleepForm: some View {
        Section {
            datePicker
            DatePicker("Bedtime", selection: $bedtime, displayedComponents: .hourAndMinute)
            DatePicker("Wake time", selection: $wake, displayedComponents: .hourAndMinute)
            Stepper("Quality · \(quality)/5", value: $quality, in: 1...5)
            Button("Save sleep") {
                if log.updateDay(key, { $0["sleep"] = ["bed": BodyDate.minutes(bedtime), "wake": BodyDate.minutes(wake), "quality": quality] }) { dismiss() }
            }
        }
    }

    private var stepsForm: some View {
        Section {
            datePicker
            if let target = log.currentTarget(key) { LabeledContent("Target", value: target.formatted()) }
            TextField("Steps", text: $number).keyboardType(.numberPad)
            Button("Save steps") {
                if let value = Int(number), log.setNumber(Double(value), field: "steps", on: key) { dismiss() }
            }.disabled(!(Int(number).map { (0...100_000).contains($0) } ?? false))
            if (log.root["steps"] as? [String: Double])?[key] != nil {
                Button("Clear entry", role: .destructive) {
                    if log.setNumber(nil, field: "steps", on: key) { dismiss() }
                }
            }
        }
    }

    private var reviewForm: some View {
        let metrics = log.report(sunday: sunday)
        let names = [
            ("Average weight", "averageWeight", "weighInDays"), ("Average steps", "averageSteps", "stepDays"),
            ("Average calories", "averageCalories", "foodDays"), ("Average protein", "averageProtein", "proteinDays"),
        ]
        return Group {
            Section("\(BodyDate.add(sunday, days: -7)) through \(BodyDate.add(sunday, days: -1))") {
                LabeledContent("Lifting days", value: "\(metrics["liftingDays"] as? Int ?? 0)")
                ForEach(names, id: \.1) { name, average, coverage in
                    let value = (metrics[average] as? Double)?.formatted(.number.precision(.fractionLength(0...1))) ?? "–"
                    LabeledContent(name, value: "\(value) · \(metrics[coverage] as? Int ?? 0)/7")
                }
            }
            Section("Next week") {
                Picker("Knee response", selection: $knee) {
                    Text("Choose").tag("")
                    Text("Felt fine").tag("fine")
                    Text("Some discomfort").tag("some")
                    Text("Limited activity").tag("limited")
                }
                TextField("Notes", text: $notes, axis: .vertical)
                TextField("Daily step target (optional)", text: $number).keyboardType(.numberPad)
                Button("Save review") {
                    let target = Int(number)
                    let from = max(BodyDate.add(sunday, days: 1), BodyDate.add(today, days: 1))
                    if log.update({ root in
                        var reviews = root["bodyReviews"] as? [String: [String: Any]] ?? [:]
                        var review = reviews[sunday] ?? [:]
                        review["metrics"] = metrics
                        review["knee"] = knee
                        review["notes"] = notes
                        if let target, target != review["stepTarget"] as? Int {
                            var targets = root["stepTargets"] as? [String: Int] ?? [:]
                            targets[from] = target
                            review["stepTarget"] = target
                            review["targetStarts"] = from
                            root["stepTargets"] = targets
                        }
                        reviews[sunday] = review
                        root["bodyReviews"] = reviews
                    }) { dismiss() }
                }.disabled(!number.isEmpty && !(Int(number).map { (1...100_000).contains($0) } ?? false))
            }
        }
    }

    private var history: some View {
        Section {
            LabeledContent("Lifting days this week", value: "\(log.liftDays(in: days))")
            ForEach(Array(log.workouts.reversed().enumerated()), id: \.offset) { _, raw in
                if let run = log.decode(raw, as: NativeRun.self), run.endedAt != nil {
                    DisclosureGroup {
                        ForEach(Array(run.ex.enumerated()), id: \.offset) { _, exercise in
                            LabeledContent(exercise.name, value: exercise.sets.filter(\.done).map { "\($0.w.formatted()) × \($0.r)" }.joined(separator: ", "))
                        }
                    } label: {
                        VStack(alignment: .leading) {
                            Text(run.name)
                            Text(run.day).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }
            }
        }
    }

    private var datePicker: some View {
        DatePicker("Date", selection: $day, in: ...Date(), displayedComponents: .date)
            .onChange(of: day) { _, _ in loadFields() }
    }

    private func decimal(_ value: String) -> Double? {
        guard let parsed = Double(value.replacingOccurrences(of: ",", with: ".")), parsed.isFinite else { return nil }
        return parsed
    }

    private func loadFields() {
        switch tool {
        case .weight:
            number = ((log.root["weights"] as? [String: Double])?[key]).map { String($0) } ?? ""
            let plan = log.root["plan"] as? [String: Any]
            goal = (plan?["goal"] as? Double).map { String($0) } ?? "200"
            pace = (plan?["pace"] as? Double).map { String($0) } ?? "1.5"
            workouts = min(7, max(1, plan?["workouts"] as? Int ?? 4))
            maintenance = String(plan?["maint"] as? Int ?? 3150)
            calorieFloor = String(plan?["floor"] as? Int ?? 1800)
            smallReward = plan?["small"] as? String ?? "Coffee treat"
            bigReward = plan?["big"] as? String ?? "$25 to the gear fund"
            tasks = (plan?["wh"] as? [String] ?? ["Take a walk", "Tidy your desk", "Do the dishes"]).joined(separator: "\n")
        case .sleep:
            let old = log.dayMap[key]?["sleep"] as? [String: Int]
            bedtime = Calendar.current.startOfDay(for: day).addingTimeInterval(Double(old?["bed"] ?? 1320) * 60)
            wake = Calendar.current.startOfDay(for: day).addingTimeInterval(Double(old?["wake"] ?? 420) * 60)
            quality = min(5, max(1, old?["quality"] ?? 3))
        case .steps: number = ((log.root["steps"] as? [String: Int])?[key]).map { String($0) } ?? ""
        case .review:
            let saved = (log.root["bodyReviews"] as? [String: [String: Any]])?[sunday]
            number = (saved?["stepTarget"] as? Int).map { String($0) } ?? ""
            knee = saved?["knee"] as? String ?? ""
            notes = saved?["notes"] as? String ?? ""
        case .history: break
        }
    }
}
