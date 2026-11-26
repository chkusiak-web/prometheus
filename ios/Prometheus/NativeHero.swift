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
    @State private var panel: Panel?

    private enum Panel: String, Identifiable {
        case mind = "Mind", body = "Body", soul = "Soul", quest = "Weekly Hero Quest", goals = "Goals", settings = "Settings"
        var id: Self { self }
    }

    private var dates: [String] { BodyDate.week(BodyDate.today) }
    private var monday: String { dates[0] }
    private var quests: [String: [String: Any]] { log.root["hero"] as? [String: [String: Any]] ?? [:] }
    private var quest: [String: Any] {
        quests[monday] ?? ["name": "", "spoil": "", "done": Array(repeating: false, count: 7), "swaps": 0]
    }
    private var goals: [[String: Any]] { log.root["goals"] as? [[String: Any]] ?? [] }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("HERO").font(.prometheusTitle).accessibilityAddTraits(.isHeader)
                Spacer()
                Button("Goals") { panel = .goals }
                    .buttonStyle(PrometheusPill(fill: Palette.paper, ink: Palette.ink))
                Button("Settings", systemImage: "gearshape") { panel = .settings }
                    .labelStyle(.iconOnly).buttonStyle(PrometheusPill(fill: Palette.paper, ink: Palette.ink))
            }
            dashboard
        }
        .sheet(item: $panel) { selected in
            NavigationStack {
                ScrollView {
                    Group {
                        switch selected {
                        case .quest: questEditor
                        case .goals: goalsPanel
                        case .settings: BackupView()
                        case .mind, .body, .soul: detail(selected)
                        }
                    }
                    .padding(16)
                }
                .background(Palette.bone.ignoresSafeArea())
                .navigationTitle(selected.rawValue)
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { panel = nil } } }
                .sheet(isPresented: $showingGoal) { goalEditor }
            }
            .tint(Palette.ink)
            .presentationDragIndicator(.visible)
        }
    }

    private var questEditor: some View {
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
        .onAppear {
            questName = quest["name"] as? String ?? ""
            reward = quest["spoil"] as? String ?? ""
        }
    }

    private var goalsPanel: some View {
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
    }

    private func scores(for dates: [String]) -> (mind: Double, body: Double, soul: Double, hero: Double) {
        let blocks = dates.flatMap { log.blocks($0) }.filter { $0["done"] as? Bool == true }
        let areas = HabitCatalog.current?.cats.flatMap(\.areas) ?? []
        let mind = areas.reduce(0.0) { sum, area in
            let count = blocks.filter { $0["area"] as? String == area.n }.count
            return sum + min(1, Double(count) / Double(area.goal))
        } / Double(max(1, areas.count))
        let soul = Double(dates.filter { date in log.blocks(date).contains {
            $0["pillar"] as? String == "soul" && $0["done"] as? Bool == true
        } }.count) / 7
        let plan = log.root["plan"] as? [String: Any]
        let target = max(1, plan?["workouts"] as? Int ?? 4)
        let lifts = min(1, Double(log.liftDays(in: dates)) / Double(target))
        let weights = log.root["weights"] as? [String: Double] ?? [:]
        let logged = dates.filter { weights[$0] != nil }.count + dates.filter { !(log.food[$0] ?? []).isEmpty }.count
        let body = 0.7 * lifts + 0.3 * min(1, Double(logged) / 12)
        let hero = Double((quests[dates[0]]?["done"] as? [Bool] ?? []).prefix(7).filter { $0 }.count) / 7
        return (mind, body, soul, hero)
    }

    private var dashboard: some View {
        let scores = scores(for: dates)
        let prior = self.scores(for: dates.map { BodyDate.add($0, days: -7) })
        let overall = (scores.mind + scores.body + scores.soul + scores.hero) / 4
        let before = (prior.mind + prior.body + prior.soul + prior.hero) / 4
        let delta = Int(((overall - before) * 100).rounded())
        return VStack(alignment: .leading, spacing: 12) {
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                scoreTile("Mind", fraction: scores.mind, color: Color(red: 0.18, green: 0.36, blue: 0.92), panel: .mind)
                scoreTile("Body", fraction: scores.body, color: Palette.ember, panel: .body)
                scoreTile("Soul", fraction: scores.soul, color: Color(red: 1, green: 0.69, blue: 0), panel: .soul)
                scoreTile("Hero", fraction: scores.hero, color: Color(red: 0.08, green: 0.63, blue: 0.44), panel: .quest)
            }
            VStack(alignment: .leading, spacing: 6) {
                HStack(alignment: .top, spacing: 10) {
                    Text(overall.formatted(.percent.precision(.fractionLength(0))))
                        .font(.system(.largeTitle, design: .default, weight: .black).width(.condensed))
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Overall").font(.prometheusLabel).foregroundStyle(Palette.stone)
                        Text("\(delta >= 0 ? "+" : "")\(delta)% vs last week")
                            .font(.caption.bold()).foregroundStyle(delta < 0 ? Palette.ember : Color(red: 0.35, green: 0.82, blue: 0.62))
                    }.padding(.top, 5)
                    Spacer()
                }
                flame(overall)
            }.prometheusCard(fill: Palette.ink).foregroundStyle(.white)
        }
    }

    private func scoreTile(_ name: String, fraction: Double, color: Color, panel: Panel) -> some View {
        Button { self.panel = panel } label: {
            ZStack(alignment: .leading) {
                GeometryReader { geometry in
                    color.frame(width: geometry.size.width * min(1, max(0, fraction)))
                }
                VStack(alignment: .leading, spacing: 7) {
                    Text(panel == .quest ? "\(Int((fraction * 7).rounded()))/7" : fraction.formatted(.percent.precision(.fractionLength(0))))
                        .font(.prometheusLabel)
                    Text(name.uppercased()).font(.system(.title, design: .default, weight: .black).width(.condensed))
                }
                .padding(12).foregroundStyle(name == "Soul" && fraction >= 0.65 ? Palette.ink : .white)
            }
            .frame(height: 94)
            .background(Palette.ink)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }.buttonStyle(.plain)
    }

    private func flame(_ overall: Double) -> some View {
        let width = 106 + 68 * overall
        let height = width * 528 / 432
        return TimelineView(.animation(minimumInterval: 0.1, paused: reduceMotion)) { tick in
            let index = reduceMotion ? 0 : Int(tick.date.timeIntervalSince1970 * 10) % 9
            Image("Flame").resizable().frame(width: width * 9, height: height)
                .offset(x: -CGFloat(index) * width)
                .frame(width: width, height: height, alignment: .leading).clipped()
        }
        .frame(maxWidth: .infinity)
        .frame(height: 214, alignment: .bottom)
        .accessibilityHidden(true)
    }

    private func detail(_ selected: Panel) -> some View {
        let current = scores(for: dates)
        let value = selected == .mind ? current.mind : selected == .body ? current.body : current.soul
        return VStack(alignment: .leading, spacing: 10) {
            LabeledContent("This week", value: value.formatted(.percent.precision(.fractionLength(0))))
            switch selected {
            case .mind:
                let blocks = dates.flatMap { log.blocks($0) }
                ForEach(HabitCatalog.current?.cats.flatMap(\.areas) ?? [], id: \.n) { area in
                    let done = blocks.filter { $0["area"] as? String == area.n && $0["done"] as? Bool == true }.count
                    LabeledContent(area.n, value: "\(done)/\(area.goal)")
                }
            case .body:
                LabeledContent("Lifting days", value: log.liftDays(in: dates).formatted())
                LabeledContent("Food logs", value: dates.filter { !(log.food[$0] ?? []).isEmpty }.count.formatted())
            case .soul:
                ForEach(HabitCatalog.current?.quests.keys.sorted() ?? [], id: \.self) { trait in
                    let count = dates.flatMap { log.blocks($0) }.filter { $0["trait"] as? String == trait && $0["done"] as? Bool == true }.count
                    LabeledContent(trait, value: count.formatted())
                }
            default: EmptyView()
            }
        }.prometheusCard()
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
