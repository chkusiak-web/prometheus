import SwiftUI

struct NativeHeroView: View {
    let log: NativeLog
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var questName = ""
    @State private var reward = ""
    @State private var goalName = ""
    @State private var goalPillar = "body"
    @State private var goalFrequency = 3
    @State private var goalMinutes = 30
    @State private var editingGoal: String?
    @State private var showingGoal = false

    private var dates: [String] { BodyDate.week(BodyDate.today) }
    private var monday: String { dates[0] }
    private var quests: [String: [String: Any]] { log.root["hero"] as? [String: [String: Any]] ?? [:] }
    private var quest: [String: Any] {
        quests[monday] ?? ["name": "", "spoil": "", "done": Array(repeating: false, count: 7), "swaps": 0]
    }
    private var goals: [[String: Any]] { log.root["goals"] as? [[String: Any]] ?? [] }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("HERO").font(.prometheusTitle)
            progress
            VStack(alignment: .leading, spacing: 12) {
                Text("Weekly Hero Quest").font(.headline)
                TextField("Quest", text: $questName)
                TextField("Reward", text: $reward)
                Button("Save quest") {
                    updateQuest { q in q["name"] = questName; q["spoil"] = reward }
                }.buttonStyle(PrometheusPill()).disabled(questName.trimmingCharacters(in: .whitespaces).isEmpty)
                HStack(spacing: 5) {
                    ForEach(Array(["M", "T", "W", "T", "F", "S", "S"].enumerated()), id: \.offset) { index, letter in
                        let saved = quest["done"] as? [Bool] ?? []
                        let done = saved.indices.contains(index) && saved[index]
                        Button {
                            updateQuest { entry in
                                var states = Array((entry["done"] as? [Bool] ?? []).prefix(7))
                                while states.count < 7 { states.append(false) }
                                states[index].toggle()
                                entry["done"] = states
                            }
                        } label: {
                            Text(letter).frame(maxWidth: .infinity).frame(height: 44)
                                .background(done ? Palette.ember : Palette.bone, in: RoundedRectangle(cornerRadius: 8))
                        }.buttonStyle(.plain).accessibilityAddTraits(done ? .isSelected : [])
                            .disabled((quest["name"] as? String ?? "").isEmpty || dates[index] > BodyDate.today)
                    }
                }
            }.prometheusCard()
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text("Long-term goals").font(.headline)
                    Spacer()
                    Button("Add goal") { edit(nil) }.buttonStyle(PrometheusPill())
                }
                ForEach(Array(goals.enumerated()), id: \.offset) { _, item in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(item["name"] as? String ?? "Goal").bold()
                            Text("\(item["freq"] as? Int ?? 1) times a week").font(.caption)
                        }
                        Spacer()
                        Button("Plan", systemImage: "plus") { planGoal(item) }.labelStyle(.iconOnly)
                        Button("Edit") { edit(item) }
                    }.buttonStyle(.bordered)
                }
            }.prometheusCard()
            BackupView()
        }
        .onAppear {
            questName = quest["name"] as? String ?? ""
            reward = quest["spoil"] as? String ?? ""
        }
        .sheet(isPresented: $showingGoal) { goalEditor }
    }

    private var progress: some View {
        let blocks = dates.flatMap { log.blocks($0) }.filter { $0["done"] as? Bool == true }
        let areas = HabitCatalog.current?.cats.flatMap(\.areas) ?? []
        let mind = areas.reduce(0.0) { sum, area in
            let count = blocks.filter { $0["area"] as? String == area.n }.count
            return sum + min(1, Double(count) / Double(area.goal))
        } / Double(max(1, areas.count))
        let soul = Double(dates.filter { date in log.blocks(date).contains { $0["pillar"] as? String == "soul" && $0["done"] as? Bool == true } }.count) / 7
        let planned = max(1, (log.root["plan"] as? [String: Any])?["workouts"] as? Int ?? 4)
        let lifts = min(1, Double(log.liftDays(in: dates)) / Double(planned))
        let weights = log.root["weights"] as? [String: Double] ?? [:]
        let logged = dates.filter { weights[$0] != nil }.count + dates.filter { !(log.food[$0] ?? []).isEmpty }.count
        let body = 0.7 * lifts + 0.3 * min(1, Double(logged) / 12)
        let hero = Double((quest["done"] as? [Bool] ?? []).filter { $0 }.count) / 7
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("Overall this week").font(.prometheusLabel).foregroundStyle(Palette.stone)
                    Text(((mind + body + soul + hero) / 4).formatted(.percent.precision(.fractionLength(0))))
                        .font(.prometheusTitle)
                }
                Spacer()
                TimelineView(.animation(minimumInterval: 0.1, paused: reduceMotion)) { tick in
                    let index = reduceMotion ? 0 : Int(tick.date.timeIntervalSince1970 * 10) % 9
                    Image("Flame").resizable().frame(width: 576, height: 78)
                        .offset(x: -CGFloat(index) * 64)
                        .frame(width: 64, height: 78, alignment: .leading).clipped()
                }.accessibilityHidden(true)
            }
            ForEach([("Mind", mind), ("Body", body), ("Soul", soul), ("Hero", hero)], id: \.0) { name, fraction in
                LabeledContent(name, value: fraction.formatted(.percent.precision(.fractionLength(0))))
                ProgressView(value: min(1, fraction)).tint(Palette.ember)
            }
        }.prometheusCard(fill: Palette.ink).foregroundStyle(.white)
    }

    private var goalEditor: some View {
        NavigationStack {
            Form {
                TextField("Goal", text: $goalName)
                Picker("Pillar", selection: $goalPillar) {
                    ForEach(["mind", "body", "soul"], id: \.self) { Text($0.capitalized) }
                }
                Stepper("Times per week · \(goalFrequency)", value: $goalFrequency, in: 1...7)
                Stepper("Minutes · \(goalMinutes)", value: $goalMinutes, in: 5...180, step: 5)
                if let editingGoal {
                    Button("Remove goal", role: .destructive) {
                        if log.update({ $0["goals"] = goals.filter { $0["id"] as? String != editingGoal } }) { showingGoal = false }
                    }
                }
            }
            .navigationTitle("Goal")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showingGoal = false } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        let name = goalName.trimmingCharacters(in: .whitespaces)
                        guard !name.isEmpty else { return }
                        if log.update({ root in
                            var entries = goals
                            let record: [String: Any] = ["id": editingGoal ?? UUID().uuidString, "name": name, "pillar": goalPillar,
                                                         "len": goalMinutes, "freq": goalFrequency]
                            if let index = entries.firstIndex(where: { $0["id"] as? String == editingGoal }) { entries[index] = record }
                            else { entries.append(record) }
                            root["goals"] = entries
                        }) { showingGoal = false }
                    }
                }
            }.tint(Palette.ink)
        }
    }

    private func updateQuest(_ change: (inout [String: Any]) -> Void) {
        log.update { root in
            var entries = quests
            var next = quest
            change(&next)
            entries[monday] = next
            root["hero"] = entries
        }
    }

    private func edit(_ goal: [String: Any]?) {
        editingGoal = goal?["id"] as? String
        goalName = goal?["name"] as? String ?? ""
        goalPillar = goal?["pillar"] as? String ?? "body"
        goalFrequency = goal?["freq"] as? Int ?? 3
        goalMinutes = goal?["len"] as? Int ?? 30
        showingGoal = true
    }

    private func planGoal(_ item: [String: Any]) {
        guard let name = item["name"] as? String, let id = item["id"] as? String else { return }
        log.addHabit(name: name, pillar: item["pillar"] as? String ?? "body", minutes: item["len"] as? Int ?? 30,
                     tag: "goalId", value: id, done: false)
    }
}
