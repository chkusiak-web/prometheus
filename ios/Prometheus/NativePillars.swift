import SwiftUI

private struct ActivitySheet: View {
    @Environment(\.dismiss) private var dismiss
    let log: NativeLog
    let name: String
    let pillar: String
    let templates: [(String, Int)]
    @State private var custom = ""

    private var key: String { pillar == "mind" ? "myTasks" : "myQuests" }
    private var tag: String { pillar == "mind" ? "area" : "trait" }
    private var items: [(String, Int)] {
        templates + ((log.root[key] as? [String: [String]])?[name] ?? []).map { ($0, 15) }
    }

    var body: some View {
        NavigationStack {
            List {
                ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                    HStack {
                        VStack(alignment: .leading) {
                            Text(item.0).foregroundStyle(Palette.ink)
                            Text("\(item.1) min").font(.caption).foregroundStyle(Palette.muted)
                        }
                        Spacer()
                        Button("Plan", systemImage: "plus") {
                            log.addHabit(name: item.0, pillar: pillar, minutes: item.1, tag: tag, value: name, done: false)
                        }.labelStyle(.iconOnly).accessibilityLabel("Plan \(item.0)")
                        Button("Done", systemImage: "checkmark") {
                            complete(item)
                        }.labelStyle(.iconOnly).accessibilityLabel("Complete \(item.0)")
                    }.buttonStyle(.bordered)
                }
                Section {
                    TextField("Add your own", text: $custom)
                    Button("Save activity") {
                        let nameText = custom.trimmingCharacters(in: .whitespacesAndNewlines)
                        if log.update({ root in
                            var values = root[key] as? [String: [String]] ?? [:]
                            if !(values[name] ?? []).contains(nameText) { values[name, default: []].append(nameText) }
                            root[key] = values
                        }) { custom = "" }
                    }.disabled(custom.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                }
            }
            .scrollContentBackground(.hidden).background(Palette.bone)
            .tint(Palette.ink).navigationTitle(name)
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Close") { dismiss() } } }
        }
        .presentationDragIndicator(.visible)
    }

    private func complete(_ item: (String, Int)) {
        let today = BodyDate.today
        if let index = log.blocks(today).firstIndex(where: {
            $0["name"] as? String == item.0 && $0[tag] as? String == name
        }) {
            log.updateBlocks(today) { blocks in
                blocks[index]["done"] = true
                blocks[index]["doneAt"] = NativeTraining.now
            }
        } else {
            log.addHabit(name: item.0, pillar: pillar, minutes: item.1, tag: tag, value: name, done: true)
        }
    }
}

struct NativeMindView: View {
    let log: NativeLog
    @State private var area: String?
    @State private var checkIn = false
    @State private var initialCorner: HabitCatalog.Corner?

    var body: some View {
        let currentWeek = BodyDate.week(BodyDate.today)
        let blocks = currentWeek.flatMap { log.blocks($0) }
        VStack(alignment: .leading, spacing: 12) {
            Text("MIND").font(.prometheusTitle).accessibilityAddTraits(.isHeader)
            let areas = (HabitCatalog.current?.cats ?? []).flatMap { category in
                category.areas.map { area in
                    let count = blocks.filter { $0["area"] as? String == area.n && $0["done"] as? Bool == true }.count
                    return WheelItem(name: area.n, color: Color(hex: category.color), count: count, goal: area.goal)
                }
            }
            MindWheel(areas: areas) { area = $0 }
                .frame(maxWidth: 306)
                .frame(maxWidth: .infinity)
            EmotionRing(log: log) { initialCorner = $0; checkIn = true }

        }
        .sheet(isPresented: Binding(get: { area != nil }, set: { if !$0 { area = nil } })) {
            if let area {
                let templates = (HabitCatalog.current?.tasks[area] ?? []).map { ($0.name, $0.minutes) }
                ActivitySheet(log: log, name: area, pillar: "mind", templates: templates)
            }
        }
        .sheet(isPresented: $checkIn) { EmotionCheckIn(log: log, initialCorner: initialCorner) }
    }
}

private struct EmotionCheckIn: View {
    @Environment(\.dismiss) private var dismiss
    let log: NativeLog
    @State private var corner: HabitCatalog.Corner?
    @State private var word: String?
    @State private var stress = 3
    @State private var drive = 3
    var initialCorner: HabitCatalog.Corner?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let corner {
                        Text("Pick a word").font(.prometheusTitle)
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 107))], alignment: .leading) {
                            ForEach(corner.words, id: \.self) { choice in
                                Button(choice) { word = choice }
                                    .buttonStyle(PrometheusPill(fill: word == choice ? Palette.ink : Color(hex: corner.color),
                                                                 ink: word == choice || corner.n == "Spent" ? .white : Palette.ink))
                                    .accessibilityAddTraits(word == choice ? .isSelected : [])
                            }
                        }
                        Stepper("Stress · \(stress)/5", value: $stress, in: 1...5)
                        Stepper("Drive · \(drive)/5", value: $drive, in: 1...5)
                        Button("Save check-in") {
                            guard let word else { return }
                            if log.update({ root in
                                var checkins = root["checkins"] as? [[String: Any]] ?? []
                                checkins.append(["ts": NativeTraining.now, "day": BodyDate.today,
                                                 "corner": corner.n, "word": word, "stress": stress, "drive": drive])
                                root["checkins"] = checkins
                            }) { dismiss() }
                        }.buttonStyle(PrometheusPill()).disabled(word == nil)
                        Button("Change quadrant") { self.corner = nil; word = nil }
                    } else {
                        Text("How do you feel?").font(.prometheusTitle)
                        ForEach(HabitCatalog.current?.corners ?? [], id: \.n) { item in
                            Button(item.n) { corner = item }
                                .buttonStyle(PrometheusPill(fill: Color(hex: item.color), ink: item.n == "Spent" ? .white : Palette.ink))
                        }
                    }
                }.prometheusCard().padding()
            }.background(Palette.bone).tint(Palette.ink).navigationTitle("Check in")
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
        }.onAppear { corner = initialCorner }
    }
}

private struct EmotionRing: View {
    let log: NativeLog
    let choose: (HabitCatalog.Corner?) -> Void

    var body: some View {
        let corners = HabitCatalog.current?.corners ?? []
        let entries = log.root["checkins"] as? [[String: Any]] ?? []
        let today = entries.filter { $0["day"] as? String == BodyDate.today }
        let dominant = corners.max { first, second in
            entries.filter { $0["corner"] as? String == first.n }.count <
                entries.filter { $0["corner"] as? String == second.n }.count
        }
        return VStack(spacing: 12) {
            ZStack {
                let green = Color(hex: "#13A06F"), blue = Color(hex: "#2F5BEA"), yellow = Color(hex: "#FFB000")
                Circle().strokeBorder(AngularGradient(
                    stops: [.init(color: Color(hex: "#8DBB2E"), location: 0), .init(color: green, location: 0.125),
                            .init(color: blue, location: 0.375), .init(color: Palette.ember, location: 0.625),
                            .init(color: yellow, location: 0.875), .init(color: Color(hex: "#8DBB2E"), location: 1)],
                    center: .center), lineWidth: 7)
                    .frame(width: 160, height: 160)
                Button("Check in", systemImage: "plus") { choose(nil) }
                    .buttonStyle(PrometheusPill(fill: entries.isEmpty ? Palette.stone : Color(hex: dominant?.color ?? "#D9D4CC").opacity(0.35), ink: Palette.ink))
                ForEach(Array(corners.enumerated()), id: \.offset) { i, corner in
                    let count = today.filter { $0["corner"] as? String == corner.n }.count
                    let left = i % 2 == 0
                    let top = i < 2
                    Button { choose(corner) } label: {
                        Circle().fill(Color(hex: corner.color)).frame(width: 12, height: 12)
                            .overlay(Circle().strokeBorder(Palette.bone, lineWidth: 2))
                            .frame(width: 44, height: 44)
                            .contentShape(Rectangle())
                    }.buttonStyle(.plain)
                        .accessibilityLabel(count == 0 ? corner.n : "\(corner.n), \(count) check-ins today")
                        .offset(x: left ? -54 : 54, y: top ? -54 : 54)
                    Text(count == 0 ? corner.n : "\(corner.n) \(count)")
                        .font(.caption.bold()).foregroundStyle(Palette.ink)
                        .offset(x: left ? -104 : 104, y: top ? -54 : 54)
                        .allowsHitTesting(false).accessibilityHidden(true)
                }
            }.frame(height: 184)
            if let word = entries.last?["word"] as? String {
                Text("Last check-in · " + word).font(.caption).foregroundStyle(Palette.muted)
            }
        }.frame(maxWidth: .infinity)
    }
}

struct NativeSoulView: View {
    let log: NativeLog
    @State private var trait: String?
    @State private var triangle = false

    var body: some View {
        let traits = ["Order", "Purpose", "Blessing others", "Discipline", "Courage", "Decisive action",
                      "Learning", "Self-awareness", "Mastery", "Connection", "Presence", "Creativity"]
        let date = BodyDate.today
        let recent = (0..<7).flatMap { log.blocks(BodyDate.add(date, days: -$0)) }
        let planned = log.blocks(date).filter { $0["pillar"] as? String == "soul" }
        VStack(alignment: .leading, spacing: 12) {
            Text("SOUL").font(.prometheusTitle).accessibilityAddTraits(.isHeader)
            let counts = traits.map { name in recent.filter { $0["trait"] as? String == name && $0["done"] as? Bool == true }.count }
            if !planned.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Today's quests").font(.prometheusLabel)
                    ForEach(planned.indices, id: \.self) { index in
                        let quest = planned[index]
                        let done = quest["done"] as? Bool == true
                        Button {
                            guard let id = quest["id"] as? String else { return }
                            log.updateBlocks(date) { blocks in
                                guard let match = blocks.firstIndex(where: { $0["id"] as? String == id }) else { return }
                                blocks[match]["done"] = !done
                                blocks[match]["doneAt"] = done ? nil : NativeTraining.now
                            }
                        } label: {
                            Label(quest["name"] as? String ?? "Quest", systemImage: done ? "checkmark.circle.fill" : "circle")
                        }.buttonStyle(.plain)
                    }
                }.prometheusCard()
            }
            if planned.isEmpty, let weakest = traits.indices.min(by: { counts[$0] < counts[$1] }),
               let suggestion = HabitCatalog.current?.quests[traits[weakest]]?.first?.last {
                Button { trait = traits[weakest] } label: {
                    VStack(alignment: .leading, spacing: 5) {
                        Text("Today’s quest · \(traits[weakest])").font(.prometheusLabel).foregroundStyle(Palette.muted)
                        Text(suggestion).font(.headline).foregroundStyle(Palette.ink)
                    }.prometheusCard()
                }.buttonStyle(.plain)
            }
            VStack(alignment: .leading, spacing: 0) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 2) {
                        let doneDays = (0..<7).filter { offset in
                            log.blocks(BodyDate.add(date, days: -offset)).contains {
                                $0["pillar"] as? String == "soul" && $0["done"] as? Bool == true
                            }
                        }.count
                        Text((Double(doneDays) / 7).formatted(.percent.precision(.fractionLength(0))))
                            .font(.prometheusTitle).foregroundStyle(.white)
                        Text("Soul").font(.prometheusLabel).foregroundStyle(Palette.stone)
                    }
                    Spacer()
                    Button("Triangle", systemImage: "triangle") { triangle = true }
                        .buttonStyle(PrometheusPill(fill: Palette.charcoal))
                }
                SoulSky(names: traits, selected: Set(log.dayMap[date]?["triangle"] as? [String] ?? []), counts: counts) {
                    trait = $0
                }
                .frame(maxWidth: 306).frame(maxWidth: .infinity)
            }.prometheusCard(fill: Palette.ink)

        }
        .sheet(isPresented: Binding(get: { trait != nil }, set: { if !$0 { trait = nil } })) {
            if let trait {
                let quests = (HabitCatalog.current?.quests[trait] ?? []).compactMap { row -> (String, Int)? in
                    guard row.count == 2 else { return nil }
                    return (row[1], ["S": 15, "M": 30, "L": 60][row[0]] ?? 15)
                }
                ActivitySheet(log: log, name: trait, pillar: "soul", templates: quests)
            }
        }
        .sheet(isPresented: $triangle) { CloseDayView(log: log, triangleOnly: true) }
    }
}

struct CloseDayView: View {
    @Environment(\.dismiss) private var dismiss
    let log: NativeLog
    var triangleOnly = false
    @State private var rating = 3
    @State private var traits: Set<String> = []
    @State private var carry = false

    var body: some View {
        NavigationStack {
            Form {
                if !triangleOnly {
                    Stepper("Day rating · \(rating)/5", value: $rating, in: 1...5)
                    Toggle("Move unfinished blocks to tomorrow", isOn: $carry)
                }
                Section("Choose up to three traits") {
                    ForEach(HabitCatalog.current?.quests.keys.sorted() ?? [], id: \.self) { name in
                        Button {
                            if traits.contains(name) { traits.remove(name) }
                            else if traits.count < 3 { traits.insert(name) }
                        } label: {
                            HStack {
                                Text(name)
                                Spacer()
                                if traits.contains(name) { Image(systemName: "checkmark") }
                            }
                        }.buttonStyle(.plain)
                    }
                }
            }
            .scrollContentBackground(.hidden).background(Palette.bone)
            .navigationTitle(triangleOnly ? "Soul triangle" : "Close day")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { save() } }
            }.tint(Palette.ink)
        }.onAppear {
            let day = log.dayMap[BodyDate.today]
            rating = min(5, max(1, day?["rating"] as? Int ?? 3))
            traits = Set(day?["triangle"] as? [String] ?? [])
        }
    }

    private func save() {
        let today = BodyDate.today
        if log.update({ root in
            var days = log.dayMap
            var day = days[today] ?? ["blocks": [[String: Any]]()]
            day["triangle"] = traits.sorted()
            if !triangleOnly {
                day["rating"] = rating
                day["closedAt"] = NativeTraining.now
                if carry {
                    let blocks = log.blocks(today)
                    let tomorrow = BodyDate.add(today, days: 1)
                    var next = days[tomorrow] ?? [:]
                    next["blocks"] = (log.blocks(tomorrow) + blocks.filter { $0["done"] as? Bool != true })
                        .sorted { ($0["start"] as? Int ?? 0) < ($1["start"] as? Int ?? 0) }
                    days[tomorrow] = next
                    day["blocks"] = blocks.filter { $0["done"] as? Bool == true }
                }
            }
            days[today] = day
            root["days"] = days
        }) { dismiss() }
    }
}

private extension Color {
    init(hex: String) {
        let value = UInt32(hex.dropFirst(), radix: 16) ?? 0
        self.init(red: Double((value >> 16) & 255) / 255, green: Double((value >> 8) & 255) / 255, blue: Double(value & 255) / 255)
    }
}


private struct WheelItem {
    let name: String
    let color: Color
    let count: Int
    let goal: Int
}

private struct Wedge: Shape {
    let index: Int
    let fraction: Double

    func path(in rect: CGRect) -> Path {
        let middle = CGPoint(x: rect.midX, y: rect.midY)
        let scale = min(rect.width, rect.height) / 292
        let inner = 36 * scale
        let outer = (36 + 94 * fraction) * scale
        let first = Double(index * 30 - 90) * .pi / 180
        let last = first + .pi / 6
        let gap = 7.6 * scale
        func point(_ radius: Double, _ angle: Double) -> CGPoint {
            CGPoint(x: middle.x + radius * cos(angle), y: middle.y + radius * sin(angle))
        }
        let i = gap / inner, o = gap / outer
        return Path { path in
            path.move(to: point(inner, first + i))
            path.addLine(to: point(outer, first + o))
            path.addArc(center: middle, radius: outer, startAngle: .radians(first + o), endAngle: .radians(last - o), clockwise: false)
            path.addLine(to: point(inner, last - i))
            path.closeSubpath()
        }
    }
}

private struct MindWheel: View {
    let areas: [WheelItem]
    let choose: (String) -> Void

    var body: some View {
        ZStack {
            ForEach(Array(areas.enumerated()), id: \.offset) { index, item in
                let shape = Wedge(index: index, fraction: 1)
                Button { choose(item.name) } label: {
                    ZStack {
                        let muted = item.color.opacity(0.20)
                        shape.fill(muted).overlay(shape.stroke(muted, style: StrokeStyle(lineWidth: 9, lineJoin: .round)))
                        if item.count > 0 {
                            let progress = Wedge(index: index, fraction: sqrt(min(1, Double(item.count) / Double(item.goal))))
                            progress.fill(item.color)
                                .overlay(progress.stroke(item.color, style: StrokeStyle(lineWidth: 9, lineJoin: .round)))
                        }
                    }.contentShape(shape)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("\(item.name), \(item.count) of \(item.goal)")
            }
        }.aspectRatio(1, contentMode: .fit)
    }
}

private struct SoulSky: View {
    let names: [String]
    let selected: Set<String>
    let counts: [Int]
    let choose: (String) -> Void
    private let gold = Color(hex: "#FFB000")

    var body: some View {
        GeometryReader { proxy in
            let dimension = min(proxy.size.width, proxy.size.height)
            let center = CGPoint(x: proxy.size.width / 2, y: proxy.size.height / 2)
            let points = names.indices.map { i in
                let angle = Double(i * 30 - 75) * .pi / 180
                return CGPoint(x: center.x + cos(angle) * dimension * 0.34,
                               y: center.y + sin(angle) * dimension * 0.34)
            }
            let archetypes = ["King", "Warrior", "Magician", "Lover"]
            ForEach(archetypes.indices, id: \.self) { i in
                let mid = Double(i * 90 - 45) * .pi / 180
                Path { path in
                    path.addArc(center: center, radius: dimension * 0.46, startAngle: .degrees(Double(i * 90 - 82)),
                                endAngle: .degrees(Double(i * 90 - 8)), clockwise: false)
                }.stroke(Palette.charcoal, lineWidth: 1)
                Text(archetypes[i].uppercased()).font(.system(size: 8, weight: .bold))
                    .tracking(0.5).foregroundStyle(gold)
                    .position(x: center.x + cos(mid) * dimension * 0.47,
                              y: center.y + sin(mid) * dimension * 0.47)
            }
            let progress = points.enumerated().map { i, p in
                let scale = 0.15 + 0.85 * min(1, Double(counts[i]) / 3)
                return CGPoint(x: center.x + (p.x - center.x) * scale, y: center.y + (p.y - center.y) * scale)
            }
            Path { path in path.addLines(progress); path.closeSubpath() }
                .fill(gold.opacity(0.10)).allowsHitTesting(false)
            Path { path in path.addLines(progress); path.closeSubpath() }
                .stroke(gold.opacity(0.3), lineWidth: 4).blur(radius: 3).allowsHitTesting(false)
            Path { path in path.addLines(progress); path.closeSubpath() }
                .stroke(gold, lineWidth: 1.4).allowsHitTesting(false)
            let triangle = names.indices.filter { selected.contains(names[$0]) }.map { points[$0] }
            if triangle.count > 1 {
                Path { path in path.addLines(triangle); path.closeSubpath() }
                    .stroke(gold.opacity(0.55), style: StrokeStyle(lineWidth: 1.4, dash: [3, 3]))
                    .allowsHitTesting(false)
            }
            ForEach(names.indices, id: \.self) { index in
                let name = names[index]
                Button { choose(name) } label: {
                    VStack(spacing: 3) {
                        Circle().fill(counts[index] > 0 || selected.contains(name) ? gold : Palette.stone)
                            .frame(width: counts[index] > 0 ? 11 : 7, height: counts[index] > 0 ? 11 : 7)
                        Text(["Blessing others": "Blessing", "Decisive action": "Decisive", "Self-awareness": "Self-aware"][name] ?? name).font(.system(size: 9, weight: .medium))
                            .lineLimit(1).foregroundStyle(.white)
                    }.frame(width: 55, height: 44).contentShape(Rectangle())
                }
                .buttonStyle(.plain).position(points[index])
                .accessibilityLabel(name)
            }
        }.aspectRatio(1, contentMode: .fit)
    }
}
