import SwiftUI

struct AgendaBlock: Identifiable {
    let id: String
    let raw: [String: Any]
    init?(_ raw: [String: Any]) {
        guard let id = raw["id"] as? String else { return nil }
        self.id = id
        self.raw = raw
    }
}

struct AgendaEdit: View {
    @Environment(\.dismiss) private var dismiss
    let log: NativeLog
    let block: AgendaBlock
    let source: String
    @State private var day = Date()
    @State private var time = Date()
    @State private var name = ""
    @State private var pillar = "todo"
    @State private var length = 30
    @State private var confirmRemove = false

    var body: some View {
        NavigationStack {
            Form {
                TextField("Block name", text: $name)
                Picker("Pillar", selection: $pillar) {
                    ForEach(["mind", "body", "soul", "todo"], id: \.self) { Text($0.capitalized) }
                }
                DatePicker("Date", selection: $day, displayedComponents: .date)
                DatePicker("Time", selection: $time, displayedComponents: .hourAndMinute)
                Stepper("Duration · \(length) min", value: $length, in: 5...360, step: 5)
                Button("Duplicate block") { save(copy: true) }
                Button("Remove block", role: .destructive) { confirmRemove = true }
            }
            .scrollContentBackground(.hidden).background(Palette.bone)
            .navigationTitle("Edit block").tint(Palette.ink)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { save(copy: false) } }
            }
            .confirmationDialog("Remove this block?", isPresented: $confirmRemove) {
                Button("Remove", role: .destructive) {
                    if log.updateBlocks(source, { $0.removeAll { $0["id"] as? String == block.id } }) { dismiss() }
                }
            }
        }
        .onAppear {
            day = BodyDate.date(source) ?? Date()
            time = day.addingTimeInterval(Double((block.raw["start"] as? Int ?? 480) % 1440) * 60)
            name = block.raw["name"] as? String ?? ""
            pillar = block.raw["pillar"] as? String ?? "todo"
            length = min(360, max(5, block.raw["len"] as? Int ?? 30))
        }
    }

    private func save(copy: Bool) {
        let title = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        let destination = BodyDate.key(day)
        let clock = BodyDate.minutes(time)
        var next = block.raw
        next["name"] = title
        next["pillar"] = pillar
        next["start"] = clock < 240 ? clock + 1440 : clock
        next["len"] = length
        if copy {
            next["id"] = UUID().uuidString
            next["done"] = false
            next["doneAt"] = nil
        }
        if log.update({ data in
            var map = log.dayMap
            var origin = map[source] ?? [:]
            if !copy { origin["blocks"] = log.blocks(source).filter { $0["id"] as? String != block.id } }
            map[source] = origin
            var day = map[destination] ?? [:]
            var blocks = day["blocks"] as? [[String: Any]] ?? []
            blocks.append(next)
            day["blocks"] = blocks.sorted { ($0["start"] as? Int ?? 0) < ($1["start"] as? Int ?? 0) }
            map[destination] = day
            data["days"] = map
        }) { dismiss() }
    }
}
