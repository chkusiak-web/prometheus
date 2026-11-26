import SwiftUI

struct NativeWorkoutView: View {
    @Environment(\.dismiss) private var dismiss
    let log: NativeLog
    @State private var run: NativeRun?
    @State private var swapIndex: Int?
    @State private var swapSearch = ""
    @State private var discard = false
    @State private var showingSchedule = false

    private let today = BodyDate.today
    private var dates: [String] { NativeTraining.dates(in: log.root, today: today) }
    private var index: Int? { dates.firstIndex(of: today) }
    private var prior: [NativeRun] { log.workouts.compactMap { log.decode($0, as: NativeRun.self) } }
    private var completed: Bool {
        prior.contains { workout in
            workout.bodySession != nil && (workout.bodySession == index || workout.day == today) &&
                workout.endedAt != nil && workout.ex.contains { $0.sets.contains { $0.done && $0.r > 0 } }
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button("Back") { dismiss() }
                    .buttonStyle(PrometheusPill(fill: Palette.paper, ink: Palette.ink))
                Spacer()
                Button("Schedule", systemImage: "calendar") { showingSchedule = true }
                    .buttonStyle(PrometheusPill(fill: Palette.paper, ink: Palette.ink))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)

            if let run {
                List { runner(run) }
                    .listStyle(.insetGrouped)
                    .scrollContentBackground(.hidden)
                    .tint(Palette.ink)
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if completed {
                            ContentUnavailableView("Lift saved", systemImage: "checkmark.circle")
                        } else if let index, let session = NativeTraining.session(index) {
                            switch session {
                            case .lift(let name, let lifts):
                                workoutPreview(name, lifts: lifts, index: index)
                            case .recovery(let name, let text):
                                ContentUnavailableView(name, systemImage: "figure.walk", description: Text(text))
                            }
                        } else {
                            ContentUnavailableView("No scheduled workout", systemImage: "calendar")
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .frame(maxWidth: 520)
                    .padding(16)
                    .frame(maxWidth: .infinity)
                }
            }
        }
        .foregroundStyle(Palette.ink)
        .background(Palette.bone.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .sheet(isPresented: $showingSchedule) { TrainingSchedule(log: log, today: today) }
        .onAppear { run = log.decode(log.root["run"], as: NativeRun.self) }
        .confirmationDialog("Discard this workout?", isPresented: $discard) {
            Button("Discard workout", role: .destructive) {
                if log.update({ $0["run"] = NSNull() }) { run = nil }
            }
        }
        .sheet(isPresented: Binding(get: { swapIndex != nil }, set: { if !$0 { swapIndex = nil } })) {
            NavigationStack {
                List(NativeTraining.library.keys.sorted().filter { swapSearch.isEmpty || $0.localizedCaseInsensitiveContains(swapSearch) }, id: \.self) { name in
                    Button(name) { swap(name) }
                }
                .searchable(text: $swapSearch)
                .navigationTitle("Swap exercise")
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { swapIndex = nil } } }
            }
        }
    }

    private func workoutPreview(_ name: String, lifts: [LiftPrescription], index: Int) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Suggested workout").font(.prometheusLabel).foregroundStyle(Palette.muted)
            Text(name)
                .font(.subheadline.bold())
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .frame(minHeight: 44)
                .background(Palette.ember, in: Capsule())
                .accessibilityAddTraits(.isSelected)
            Text(name.uppercased()).font(.prometheusTitle).accessibilityAddTraits(.isHeader)
            ForEach(lifts.indices, id: \.self) { i in
                let lift = lifts[i]
                VStack(alignment: .leading, spacing: 4) {
                    Text(lift.name).font(.headline)
                    Text("\(lift.count) × \(lift.minimum)–\(lift.maximum) \(lift.timed ? "sec" : "reps")\(lift.perSide ? " per side" : "")")
                        .font(.subheadline).foregroundStyle(Palette.muted)
                }.prometheusCard(fill: Palette.stone)
            }
            Button {
                start(name, lifts: lifts, index: index)
            } label: {
                Text("Start workout").frame(maxWidth: .infinity)
            }
            .buttonStyle(PrometheusPill())
        }
        .prometheusCard()
    }

    @ViewBuilder
    private func runner(_ workout: NativeRun) -> some View {
        if let end = workout.restUntil {
            TimelineView(.periodic(from: .now, by: 1)) { context in
                let left = max(0, Int(ceil((end - context.date.timeIntervalSince1970 * 1000) / 1000)))
                if left > 0 {
                    HStack {
                        Text("Rest · \(left) sec").monospacedDigit()
                        Spacer()
                        Button("Skip") {
                            var next = workout
                            next.restUntil = nil
                            persist(next)
                        }
                    }
                }
            }
        }
        ForEach(workout.ex.indices, id: \.self) { index in
            let exercise = workout.ex[index]
            let kind = NativeTraining.library[exercise.name] ?? ExerciseKind(weighted: true)
            Section(exercise.name) {
                ForEach(exercise.sets.indices, id: \.self) { setIndex in
                    let set = exercise.sets[setIndex]
                    if set.done {
                        LabeledContent("Set \(setIndex + 1)", value: "\(set.w > 0 ? "\(set.w.formatted()) lb × " : "")\(set.r) \(kind.unit) ✓")
                    } else if exercise.sets.firstIndex(where: { !$0.done }) == setIndex {
                        if kind.weighted {
                            Stepper("\(set.w.formatted()) lb", value: Binding(get: { set.w }, set: { value in
                                change(index, setIndex) { $0.w = value }
                            }), in: 0...2000, step: 5)
                        }
                        Stepper("\(set.r) \(kind.unit)\(exercise.perSide == true ? " per side" : "")",
                            value: Binding(get: { set.r }, set: { value in change(index, setIndex) { $0.r = value } }), in: 1...999)
                        Button("Log set \(setIndex + 1)") { change(index, setIndex, markDone: true) { $0.done = true } }
                    }
                }
                if exercise.sets.contains(where: { !$0.done }) {
                    Button("Swap exercise") { swapSearch = ""; swapIndex = index }
                }
            }
        }
        Section {
            Button("Save workout") { finish(workout) }
                .disabled(!workout.ex.contains { $0.sets.contains { $0.done && $0.r > 0 } })
            Button("Discard workout", role: .destructive) { discard = true }
        }
    }

    private func start(_ name: String, lifts: [LiftPrescription], index: Int) {
        guard run == nil, !completed else { return }
        let workout = NativeRun(id: UUID().uuidString, name: name, day: today, startedAt: NativeTraining.now,
            ex: lifts.map { NativeTraining.exercise($0, prior: prior) }, cur: 0, bodySession: index)
        persist(workout)
    }

    private func persist(_ workout: NativeRun) {
        if log.update({ root in
            root["run"] = try NativeTraining.encode(workout)
            if root["bodyWeek"] == nil { root["bodyWeek"] = dates }
        }) { run = workout }
    }

    private func change(_ exercise: Int, _ set: Int, markDone: Bool = false, _ update: (inout NativeSet) -> Void) {
        guard var next = run else { return }
        update(&next.ex[exercise].sets[set])
        next.cur = exercise
        if markDone {
            let finished = next.ex[exercise].sets[set]
            for index in next.ex[exercise].sets.indices where index > set && !next.ex[exercise].sets[index].done {
                next.ex[exercise].sets[index].w = finished.w
                next.ex[exercise].sets[index].r = finished.r
            }
            next.restUntil = NativeTraining.now + Double(next.ex[exercise].restSeconds ?? 60) * 1000
        }
        persist(next)
    }

    private func swap(_ name: String) {
        guard var next = run, let index = swapIndex else { return }
        let old = next.ex[index]
        let done = old.sets.filter(\.done)
        let remaining = old.sets.count - done.count
        guard remaining > 0 else { return }
        let kind = NativeTraining.library[name] ?? ExerciseKind(weighted: true)
        let replacement = NativeTraining.exercise(.init(name, remaining, kind.timed ? 20 : 8, kind.timed ? 30 : 12, timed: kind.timed), prior: prior)
        if done.isEmpty { next.ex[index] = replacement }
        else {
            next.ex[index].sets = done
            next.ex.insert(replacement, at: index + 1)
        }
        persist(next)
        swapIndex = nil
    }

    private func finish(_ workout: NativeRun) {
        var finished = workout
        finished.endedAt = NativeTraining.now
        finished.restUntil = nil
        if log.update({ root in
            var history = log.workouts
            guard !history.contains(where: { $0["id"] as? String == finished.id }) else { return }
            if let record = try NativeTraining.encode(finished) as? [String: Any] { history.append(record) }
            root["workouts"] = history
            root["run"] = NSNull()
            var days = root["days"] as? [String: [String: Any]] ?? [:]
            var day = days[finished.day] ?? ["blocks": [[String: Any]]()]
            var blocks = day["blocks"] as? [[String: Any]] ?? []
            let date = Date(timeIntervalSince1970: finished.startedAt / 1000)
            let hour = Calendar.current.component(.hour, from: date)
            let minute = Calendar.current.component(.minute, from: date)
            let start = (hour < 4 ? hour + 24 : hour) * 60 + minute
            let duration = max(15, Int(((NativeTraining.now - finished.startedAt) / 900_000).rounded()) * 15)
            blocks.append(["id": UUID().uuidString, "name": finished.name, "pillar": "body",
                           "start": start, "len": duration, "done": true, "doneAt": NativeTraining.now])
            day["blocks"] = blocks.sorted { ($0["start"] as? Int ?? 0) < ($1["start"] as? Int ?? 0) }
            days[finished.day] = day
            root["days"] = days
        }) { run = nil }
    }
}

struct TrainingSchedule: View {
    @Environment(\.dismiss) private var dismiss
    let log: NativeLog
    let today: String
    @State private var week: Int?
    @State private var selected: Int?

    private var dates: [String] { NativeTraining.dates(in: log.root, today: today) }
    private var ordered: [Int] {
        let dates = dates
        return dates.indices.sorted { dates[$0] < dates[$1] }
    }
    private var displayedWeek: Int {
        let dates = dates
        return week ?? max(0, (ordered.lastIndex { dates[$0] <= today } ?? 0) / 7)
    }
    private var saved: Set<Int> {
        Set(log.workouts.compactMap { workout in
            guard let record = log.decode(workout, as: NativeRun.self), record.endedAt != nil,
                  record.ex.contains(where: { $0.sets.contains { $0.done && $0.r > 0 } }) else { return nil }
            return record.bodySession
        })
    }
    private var active: Int? { log.decode(log.root["run"], as: NativeRun.self)?.bodySession }

    var body: some View {
        let dates = dates
        let saved = saved
        let active = active
        return NavigationStack {
            List {
                Picker("Plan week", selection: Binding(get: { displayedWeek }, set: { week = $0 })) {
                    ForEach(0...52, id: \.self) { Text($0 == 52 ? "Day 365" : "Week \($0 + 1)").tag($0) }
                }
                ForEach(Array(ordered.dropFirst(displayedWeek * 7).prefix(7)), id: \.self) { index in
                    if let session = NativeTraining.session(index) {
                        DisclosureGroup {
                            switch session {
                            case .lift(_, let lifts):
                                ForEach(lifts.indices, id: \.self) { item in
                                    let lift = lifts[item]
                                    LabeledContent(lift.name, value: "\(lift.count) × \(lift.minimum)–\(lift.maximum)")
                                }
                            case .recovery(_, let notes): Text(notes)
                            }
                            if log.root["bodyWeek"] != nil && !saved.contains(index) && index != active {
                                Button("Swap dates") { selected = index }
                            }
                        } label: {
                            VStack(alignment: .leading) {
                                Text(session.name)
                                Text(dates[index] + (saved.contains(index) ? " · Done" : "")).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Body plan")
            .toolbar { ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } } }
            .sheet(isPresented: Binding(get: { selected != nil }, set: { if !$0 { selected = nil } })) {
                NavigationStack {
                    List(ordered.filter { dates[$0] >= today && $0 != selected && !saved.contains($0) && $0 != active }, id: \.self) { target in
                        Button {
                            if let selected {
                                var next = dates
                                next.swapAt(selected, target)
                                if log.update({ $0["bodyWeek"] = next }) { self.selected = nil }
                            }
                        } label: {
                            LabeledContent(NativeTraining.session(target)?.name ?? "Session", value: dates[target])
                        }
                    }
                    .navigationTitle("Swap dates")
                    .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { selected = nil } } }
                }
            }
        }
    }

}
