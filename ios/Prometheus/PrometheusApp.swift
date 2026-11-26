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
    @State private var showPlan = false
    @State private var showAdd = false
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
                    default:
                        Text(selection.rawValue.uppercased())
                            .font(.prometheusTitle)
                            .accessibilityAddTraits(.isHeader)
                        if selection == .hero { BackupView() }
                        else { Text(selection.description).foregroundStyle(Palette.muted).prometheusCard() }
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
            .sheet(isPresented: $showPlan) { TrainingSchedule(log: log, today: BodyDate.today) }
            .sheet(isPresented: $showAdd) { addBlockSheet }
            .alert("Could not save or load data", isPresented: Binding(get: { log.error != nil }, set: { if !$0 { log.error = nil } })) {
                Button("OK") { log.error = nil }
            } message: { Text(log.error ?? "") }
        }
        .preferredColorScheme(.light)
    }

    @State private var back = false

    private var days: [String: [String: Any]] { log.root["days"] as? [String: [String: Any]] ?? [:] }
    private var blocks: [[String: Any]] { days[BodyDate.today]?["blocks"] as? [[String: Any]] ?? [] }

    private var todayScreen: some View {
        let next = blocks.first { $0["done"] as? Bool != true }
        return Group {
            VStack(alignment: .leading, spacing: 10) {
                Text(Date.now, format: .dateTime.weekday(.abbreviated).day().month(.abbreviated))
                    .font(.prometheusTitle).textCase(.uppercase)
                    .accessibilityAddTraits(.isHeader)
                weekStrip
            }
            .prometheusCard(fill: Palette.ink)
            .foregroundStyle(.white)

            quickActions

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
                        Text(block["name"] as? String ?? "Block").font(.subheadline.weight(.semibold))
                        Spacer()
                        if block["done"] as? Bool == true { Image(systemName: "checkmark") }
                    }
                    .padding(10)
                    .background(Palette.bone, in: RoundedRectangle(cornerRadius: 12))
                }
            }.prometheusCard()
        }
    }

    private var weekStrip: some View {
        let weekday = Calendar.current.component(.weekday, from: Date())
        let offset = (weekday + 5) % 7
        return HStack(spacing: 5) {
            ForEach(Array(["M", "T", "W", "T", "F", "S", "S"].enumerated()), id: \.offset) { index, label in
                Text(label).font(.caption.weight(.bold))
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
        let weekly = Set(log.workouts.compactMap { entry -> String? in
            guard let run = log.decode(entry, as: NativeRun.self), run.endedAt != nil,
                  run.day >= BodyDate.add(BodyDate.today, days: -6), run.day <= BodyDate.today,
                  run.ex.contains(where: { $0.sets.contains { $0.done && $0.r > 0 } }) else { return nil }
            return run.day
        })
        let plan = log.root["plan"] as? [String: Any]
        let liftingTarget = plan?["workouts"] as? Int ?? (log.root["bodyWeek"] == nil ? 4 : 5)
        return Group {
            Text("BODY").font(.prometheusTitle).accessibilityAddTraits(.isHeader)
            HStack(spacing: 10) {
                stat("Weight", weight.map { $0.formatted() + " lb" } ?? "–")
                Divider()
                stat("Sleep", sleepLabel(sleep))
                Divider()
                stat("Lifting days", "\(weekly.count)/\(liftingTarget)")
            }.prometheusCard()
            quickActions
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Body plan").font(.prometheusLabel)
                    Text("365 days").font(.headline)
                }
                Spacer()
                Button("Show plan") { showPlan = true }.buttonStyle(PrometheusPill())
            }.prometheusCard()
            VStack(alignment: .leading, spacing: 10) {
                Picker("Muscle map", selection: $back) {
                    Text("Front").tag(false)
                    Text("Back").tag(true)
                }.pickerStyle(.segmented)
                Image(back ? "MuscleBack" : "MuscleFront")
                    .resizable().scaledToFit().frame(height: 300)
                    .frame(maxWidth: .infinity)
                    .accessibilityLabel(back ? "Back muscle illustration" : "Front muscle illustration")
            }.prometheusCard()
            Text("\(log.caloriesToday) kcal logged today").font(.subheadline).foregroundStyle(Palette.muted)
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
