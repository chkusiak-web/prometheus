import SwiftUI

@main
struct PrometheusApp: App {
    var body: some Scene {
        WindowGroup {
            PrometheusRootView()
        }
    }
}

private enum PrometheusTab: String, CaseIterable, Identifiable {
    case today = "Today"
    case mind = "Mind"
    case body = "Body"
    case soul = "Soul"
    case hero = "Hero"

    var id: Self { self }

    var description: String {
        switch self {
        case .today: "Your daily agenda will live here."
        case .mind: "Your activities and emotional check-ins will live here."
        case .body: "Your workouts, food log, and steps will live here."
        case .soul: "Your quests and reflections will live here."
        case .hero: "Your goals and weekly progress will live here."
        }
    }
}

enum Palette {
    static let bone = Color(red: 236 / 255, green: 232 / 255, blue: 225 / 255)
    static let paper = Color(red: 251 / 255, green: 250 / 255, blue: 247 / 255)
    static let ink = Color(red: 23 / 255, green: 23 / 255, blue: 26 / 255)
    static let charcoal = Color(red: 42 / 255, green: 42 / 255, blue: 46 / 255)
    static let muted = Color(red: 111 / 255, green: 106 / 255, blue: 99 / 255)
    static let stone = Color(red: 217 / 255, green: 212 / 255, blue: 204 / 255)
    static let ember = Color(red: 255 / 255, green: 74 / 255, blue: 28 / 255)
}

private struct PrometheusRootView: View {
    @State private var log = NativeLog()
    @State private var selection: PrometheusTab = .today
    @State private var showAdd = false
    @State private var bodyTool: BodyTool?
    @State private var editingBlock: AgendaBlock?
    @State private var closeDay = false
    @State private var blockName = ""
    @State private var blockPillar = "body"
    @State private var blockTime = Date()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    switch selection {
                    case .today: todayScreen
                    case .body: bodyScreen
                    case .mind: NativeMindView(log: log)
                    case .soul: NativeSoulView(log: log)
                    case .hero: NativeHeroView(log: log)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .frame(maxWidth: 520)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .frame(maxWidth: .infinity)
            }
            .foregroundStyle(Palette.ink)
            .background(Palette.bone.ignoresSafeArea())
            .safeAreaInset(edge: .bottom, spacing: 0) { tabBar }
            .toolbar(.hidden, for: .navigationBar)
            .onChange(of: selection) { _, _ in log.reload() }
            .sheet(isPresented: $showAdd) { addBlockSheet }
            .sheet(item: $bodyTool) { BodyToolView(log: log, tool: $0) }
            .sheet(item: $editingBlock) { AgendaEdit(log: log, block: $0, source: BodyDate.today) }
            .sheet(isPresented: $closeDay) { CloseDayView(log: log) }
            .alert("Could not save or load data", isPresented: Binding(get: { log.error != nil }, set: { if !$0 { log.error = nil } })) {
                Button("OK") { log.error = nil }
            } message: { Text(log.error ?? "") }
        }
        .preferredColorScheme(.light)
    }

    @State private var back = false

    private var days: [String: [String: Any]] { log.dayMap }
    private var blocks: [[String: Any]] { days[BodyDate.today]?["blocks"] as? [[String: Any]] ?? [] }

    private var todayScreen: some View {
        let next = blocks.first { $0["done"] as? Bool != true }
        return Group {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(BodyDate.date(BodyDate.today) ?? Date(), format: .dateTime.weekday(.abbreviated).day().month(.abbreviated))
                        .font(.prometheusTitle).textCase(.uppercase).accessibilityAddTraits(.isHeader)
                    Spacer()
                    Button(days[BodyDate.today]?["closedAt"] == nil ? "Close day" : "Closed") { closeDay = true }
                        .buttonStyle(PrometheusPill(fill: Palette.paper, ink: Palette.ink))
                }
                weekStrip
                heroStrip
            }
            .prometheusCard(fill: Palette.ink)
            .foregroundStyle(.white)

            quickActions
            missedLogCard
            if BodyDate.today == BodyDate.reviewSunday(BodyDate.today),
               (log.root["bodyReviews"] as? [String: Any])?[BodyDate.today] == nil {
                Button("Sunday review due") { bodyTool = .review }.buttonStyle(PrometheusPill())
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Up next").font(.prometheusLabel)
                Text(next?["name"] as? String ?? (blocks.isEmpty ? "Nothing planned" : "All done"))
                    .font(.prometheusTitle).textCase(.uppercase)
                if blocks.isEmpty {
                    Button("Plan today") { showAdd = true }.buttonStyle(PrometheusPill())
                }
            }
            .prometheusCard(fill: Palette.stone)

            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Text("Agenda").font(.prometheusLabel)
                    Spacer()
                    if !blocks.isEmpty { Button("Add block") { showAdd = true }.buttonStyle(PrometheusPill()) }
                }
                if blocks.isEmpty {
                    Text("Your planned blocks will appear here.").font(.subheadline).foregroundStyle(Palette.muted)
                }
                ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                    HStack {
                        Text(blockTimeLabel(block["start"] as? Int ?? 0)).font(.caption.monospacedDigit())
                            .foregroundStyle(Palette.muted).frame(minWidth: 52, alignment: .leading)
                        Button(block["name"] as? String ?? "Block") { editingBlock = AgendaBlock(block) }
                            .buttonStyle(.plain).font(.subheadline.weight(.semibold))
                        Spacer()
                        let done = block["done"] as? Bool == true
                        Button(done ? "Mark incomplete" : "Mark complete", systemImage: done ? "checkmark.circle.fill" : "circle") {
                            log.updateBlocks(BodyDate.today) { entries in
                                guard let id = block["id"] as? String,
                                      let i = entries.firstIndex(where: { $0["id"] as? String == id }) else { return }
                                entries[i]["done"] = !done
                                entries[i]["doneAt"] = done ? nil : NativeTraining.now
                            }
                        }.labelStyle(.iconOnly).buttonStyle(.plain)
                            .frame(minWidth: 44, minHeight: 44)
                    }
                    .padding(10)
                    .background(Palette.bone, in: RoundedRectangle(cornerRadius: 12))
                }
            }.prometheusCard()
        }
    }

    @ViewBuilder
    private var heroStrip: some View {
        let date = BodyDate.today
        let week = BodyDate.week(date)
        if var quests = log.root["hero"] as? [String: [String: Any]],
           var quest = quests[week[0]], let name = quest["name"] as? String, !name.isEmpty,
           let i = week.firstIndex(of: date) {
            let saved = quest["done"] as? [Bool] ?? []
            let done = saved.indices.contains(i) && saved[i]
            Button {
                var next = Array(saved.prefix(7))
                while next.count < 7 { next.append(false) }
                next[i] = !done
                quest["done"] = next
                quests[week[0]] = quest
                log.update { $0["hero"] = quests }
            } label: {
                HStack {
                    Image(systemName: done ? "checkmark.circle.fill" : "circle")
                    Text(name).font(.subheadline.bold())
                    Spacer()
                    Text("\(saved.prefix(7).filter { $0 }.count)/7").font(.caption)
                }.padding(8).background(Palette.charcoal, in: RoundedRectangle(cornerRadius: 10))
            }.buttonStyle(.plain).accessibilityAddTraits(done ? .isSelected : [])
        }
    }

    @ViewBuilder
    private var missedLogCard: some View {
        let yesterday = BodyDate.add(BodyDate.today, days: -1)
        let saved = (log.root["withholds"] as? [String: [String: Any]])?[yesterday]
        if let since = log.root["since"] as? String, since <= yesterday,
           saved?["done"] as? Bool != true {
            let missing = [
                (log.root["weights"] as? [String: Double])?[yesterday] == nil ? "weigh-in" : nil,
                (log.food[yesterday] ?? []).contains { ($0["kcal"] as? Double ?? 0) > 0 } ? nil : "calories",
            ].compactMap { $0 }
            if !missing.isEmpty || saved != nil {
                let plan = log.root["plan"] as? [String: Any]
                let tasks = (plan?["wh"] as? [String] ?? ["Take a 20-minute walk", "Tidy your desk", "Do the dishes"]).filter { !$0.isEmpty }
                let task = saved?["task"] as? String ?? tasks.first ?? "Tidy your desk"
                let recorded = saved?["missed"] as? [String] ?? missing
                VStack(alignment: .leading, spacing: 8) {
                    Text("Missed yesterday’s " + recorded.joined(separator: " and ")).font(.prometheusLabel)
                    Text("Do it now: " + task).font(.headline)
                    HStack(spacing: 8) {
                        Button("Done") { saveMissed(yesterday, recorded: recorded, task: task, done: true) }
                            .buttonStyle(PrometheusPill(fill: Palette.paper, ink: Palette.ink))
                        if let next = tasks.first(where: { $0 != task }) {
                            Button("Swap") { saveMissed(yesterday, recorded: recorded, task: next, done: false) }
                                .buttonStyle(PrometheusPill())
                        }
                    }
                }.prometheusCard(fill: Palette.ember).foregroundStyle(Palette.ink)
            }
        }
    }

    private func saveMissed(_ date: String, recorded: [String], task: String, done: Bool) {
        log.update { root in
            var missed = root["withholds"] as? [String: [String: Any]] ?? [:]
            missed[date] = ["missed": recorded, "task": task, "done": done]
            root["withholds"] = missed
        }
    }

    private var weekStrip: some View {
        let dates = BodyDate.week(BodyDate.today)
        let offset = dates.firstIndex(of: BodyDate.today) ?? 0
        return HStack(spacing: 5) {
            ForEach(Array(["M", "T", "W", "T", "F", "S", "S"].enumerated()), id: \.offset) { index, label in
                let done = log.blocks(dates[index]).filter { $0["done"] as? Bool == true }
                let pillars = Set(done.compactMap { $0["pillar"] as? String })
                let won = done.count >= 3 && pillars.isSuperset(of: ["mind", "body", "soul"])
                Text(won ? "✓" : label).font(.caption.weight(.bold))
                    .frame(maxWidth: .infinity).padding(.vertical, 8)
                    .foregroundStyle(index == offset ? Palette.ink : Palette.stone)
                    .background(index == offset ? Palette.paper : Palette.charcoal, in: RoundedRectangle(cornerRadius: 8))
                    .accessibilityHidden(true)
            }
        }
    }

    private var quickActions: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 8) { workoutLink; foodLink }
            VStack(spacing: 8) { workoutLink; foodLink }
        }
    }

    private var workoutLink: some View {
        NavigationLink { NativeWorkoutView(log: log) } label: {
            Label("Start workout", systemImage: "dumbbell")
                .frame(maxWidth: .infinity)
        }.buttonStyle(PrometheusPill())
    }

    private var foodLink: some View {
        NavigationLink { NativeFoodView(log: log) } label: {
            Label("Log food", systemImage: "fork.knife")
                .frame(maxWidth: .infinity)
        }.buttonStyle(PrometheusPill(fill: Palette.paper, ink: Palette.ink))
    }

    private var bodyScreen: some View {
        let weights = log.root["weights"] as? [String: Double] ?? [:]
        let weight = weights.keys.sorted().last.flatMap { weights[$0] }
        let sleep = days[BodyDate.today]?["sleep"] as? [String: Int]
        let weekly = log.liftDays(in: BodyDate.week(BodyDate.today))
        let plan = log.root["plan"] as? [String: Any]
        let liftingTarget = plan?["workouts"] as? Int ?? (log.root["bodyWeek"] == nil ? 4 : 5)
        return Group {
            Text("BODY").font(.prometheusTitle).accessibilityAddTraits(.isHeader)
            HStack(spacing: 10) {
                Button { bodyTool = .weight } label: { stat("Weight", weight.map { $0.formatted() + " lb" } ?? "–") }.buttonStyle(.plain)
                Divider()
                Button { bodyTool = .sleep } label: { stat("Sleep", sleepLabel(sleep)) }.buttonStyle(.plain)
                Divider()
                Button { bodyTool = .history } label: { stat("Lifting days", "\(weekly)/\(liftingTarget)") }.buttonStyle(.plain)
            }.prometheusCard()
            quickActions
            ZStack(alignment: .topLeading) {
                Image(back ? "MuscleBack" : "MuscleFront")
                    .resizable().scaledToFit().frame(height: 380)
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel(back ? "Back muscle illustration" : "Front muscle illustration")
                HStack(spacing: 0) {
                    ForEach([false, true], id: \.self) { side in
                        Button(side ? "Back" : "Front") { back = side }
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(back == side ? .white : Palette.muted)
                            .padding(.horizontal, 9).padding(.vertical, 6)
                            .background(back == side ? Palette.ink : .clear, in: Capsule())
                            .frame(minHeight: 44)
                            .accessibilityAddTraits(back == side ? .isSelected : [])
                    }
                }.buttonStyle(.plain)
            }
            HStack(spacing: 8) {
                Button("Steps") { bodyTool = .steps }.buttonStyle(PrometheusPill(fill: Palette.paper, ink: Palette.ink))
                Button("Sunday review") { bodyTool = .review }.buttonStyle(PrometheusPill(fill: Palette.paper, ink: Palette.ink))
                Spacer()
                Button("Water", systemImage: "drop") {
                    log.updateDay(BodyDate.today) { day in
                        let count = day["water"] as? Int ?? 0
                        day["water"] = count >= 8 ? 0 : count + 1
                    }
                }.buttonStyle(PrometheusPill(fill: Palette.paper, ink: Palette.ink))
                 .accessibilityLabel("Water, \(days[BodyDate.today]?["water"] as? Int ?? 0) of 8 glasses. Add a glass.")
            }
            if let water = days[BodyDate.today]?["water"] as? Int {
                Text("\(water)/8 glasses").font(.caption).foregroundStyle(Palette.muted)
            }
        }
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(spacing: 6) {
            Text(label).font(.prometheusLabel).foregroundStyle(Palette.muted)
            Text(value).font(.title3.monospacedDigit())
        }.frame(maxWidth: .infinity)
    }

    private func sleepLabel(_ sleep: [String: Int]?) -> String {
        guard let bed = sleep?["bed"], let wake = sleep?["wake"] else { return "–" }
        let minutes = (wake - bed + 1440) % 1440
        return String(format: "%dh %02dm", minutes / 60, minutes % 60)
    }

    private func blockTimeLabel(_ minutes: Int) -> String {
        let date = Calendar.current.startOfDay(for: Date()).addingTimeInterval(Double(minutes % 1440) * 60)
        return date.formatted(.dateTime.hour().minute())
    }

    private var addBlockSheet: some View {
        NavigationStack {
            Form {
                TextField("Block name", text: $blockName)
                Picker("Pillar", selection: $blockPillar) {
                    ForEach(["mind", "body", "soul", "todo"], id: \.self) { Text($0.capitalized) }
                }
                DatePicker("Time", selection: $blockTime, displayedComponents: .hourAndMinute)
            }
            .navigationTitle("Plan today")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { showAdd = false } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Add") {
                        let name = blockName.trimmingCharacters(in: .whitespacesAndNewlines)
                        guard !name.isEmpty else { return }
                        let parts = Calendar.current.dateComponents([.hour, .minute], from: blockTime)
                        let hour = parts.hour ?? 0
                        let start = (hour < 4 ? hour + 24 : hour) * 60 + (parts.minute ?? 0)
                        var dayMap = days
                        var day = dayMap[BodyDate.today] ?? [:]
                        var next = blocks
                        next.append(["id": UUID().uuidString, "name": name, "pillar": blockPillar,
                                     "start": start, "len": 30, "done": false])
                        day["blocks"] = next.sorted { ($0["start"] as? Int ?? 0) < ($1["start"] as? Int ?? 0) }
                        dayMap[BodyDate.today] = day
                        if log.update({ $0["days"] = dayMap }) { blockName = ""; showAdd = false }
                    }
                    .disabled(blockName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
        }
    }

    private var tabBar: some View {
        HStack(spacing: 0) {
            ForEach(PrometheusTab.allCases) { tab in
                Button {
                    selection = tab
                } label: {
                    TabGlyph(tab: tab)
                        .strokeBorder(selection == tab ? .white : Palette.stone, lineWidth: 1.8)
                        .frame(width: 24, height: 24)
                        .frame(width: 48, height: 44)
                        .background(selection == tab ? Palette.ember : .clear, in: Capsule())
                        .frame(maxWidth: .infinity, minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.rawValue)
                .accessibilityAddTraits(selection == tab ? .isSelected : [])
            }
        }
        .padding(6)
        .background(selection == .hero || selection == .soul ? Palette.charcoal : Palette.ink, in: Capsule())
        .frame(maxWidth: 488)
        .padding(.horizontal, 16)
        .padding(.bottom, 4)
        .frame(maxWidth: .infinity)
        .background(Palette.bone)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Tabs")
    }
}

private struct TabGlyph: InsettableShape {
    let tab: PrometheusTab
    var insetAmount: CGFloat = 0

    func path(in rect: CGRect) -> Path {
        let box = rect.insetBy(dx: insetAmount, dy: insetAmount)
        func point(_ x: CGFloat, _ y: CGFloat) -> CGPoint {
            CGPoint(x: box.minX + box.width * x / 24, y: box.minY + box.height * y / 24)
        }

        switch tab {
        case .mind:
            return Path(ellipseIn: CGRect(origin: point(4.5, 4.5), size: CGSize(width: box.width * 15 / 24, height: box.height * 15 / 24)))
        case .body:
            return Path(CGRect(origin: point(5, 5), size: CGSize(width: box.width * 14 / 24, height: box.height * 14 / 24)))
        case .today:
            return polygon([point(4, 6), point(20, 6), point(12, 20)])
        case .soul:
            return polygon([point(12, 3.5), point(20.5, 12), point(12, 20.5), point(3.5, 12)])
        case .hero:
            return polygon([point(12, 4), point(20.5, 19), point(3.5, 19)])
        }
    }

    func inset(by amount: CGFloat) -> Self {
        var copy = self
        copy.insetAmount += amount
        return copy
    }

    private func polygon(_ points: [CGPoint]) -> Path {
        Path { path in
            path.addLines(points)
            path.closeSubpath()
        }
    }
}

extension Font {
    static let prometheusTitle = Font.system(.largeTitle, design: .default, weight: .black).width(.condensed)
    static let prometheusLabel = Font.caption.weight(.bold).smallCaps()
}

extension View {
    func prometheusCard(fill: Color = Palette.paper) -> some View {
        self.frame(maxWidth: .infinity, alignment: .leading)
            .padding(14)
            .background(fill, in: RoundedRectangle(cornerRadius: 18))
    }
}

struct PrometheusPill: ButtonStyle {
    var fill = Palette.ink
    var ink = Color.white

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.bold))
            .foregroundStyle(ink)
            .padding(.horizontal, 14)
            .frame(minHeight: 44)
            .background(fill.opacity(configuration.isPressed ? 0.8 : 1), in: Capsule())
    }
}
