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

private enum Palette {
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
    @State private var showingInputPreview = false

    var body: some View {
        NavigationStack {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if selection == .today {
                    Text(Date.now, format: .dateTime.weekday(.abbreviated).day().month(.abbreviated))
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(Palette.muted)
                }

                Text(selection.rawValue.uppercased())
                    .font(.system(.largeTitle, design: .default, weight: .black).width(.condensed))
                    .accessibilityAddTraits(.isHeader)

                if selection != .body && selection != .today {
                Text(selection.description)
                    .font(.body)
                    .foregroundStyle(Palette.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
                    .background(Palette.paper, in: RoundedRectangle(cornerRadius: 20))

                }

                if selection == .hero { BackupView() }

                if selection == .body || selection == .today {
                    VStack(alignment: .leading, spacing: 12) {
                        NavigationLink { NativeWorkoutView(log: log) } label: {
                            Label("Workout", systemImage: "dumbbell")
                        }
                        NavigationLink { NativeFoodView(log: log) } label: {
                            Label("Log food", systemImage: "fork.knife")
                        }
                        Text("\(log.caloriesToday) kcal logged today")
                            .font(.subheadline).foregroundStyle(Palette.muted)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Palette.ink)
                }

                if selection == .body {
                    Button("Try native input") { showingInputPreview = true }
                        .buttonStyle(.bordered)
                }
            }
            .frame(maxWidth: 520)
            .padding(16)
            .frame(maxWidth: .infinity)
        }
        .foregroundStyle(Palette.ink)
        .background(Palette.bone.ignoresSafeArea())
        .safeAreaInset(edge: .bottom, spacing: 0) {
            tabBar
        }
        .sheet(isPresented: $showingInputPreview) {
            NativeInputPreview()
        }
        .toolbar(.hidden, for: .navigationBar)
        .onChange(of: selection) { _, _ in log.reload() }
        .alert("Could not save or load data", isPresented: Binding(get: { log.error != nil }, set: { if !$0 { log.error = nil } })) {
            Button("OK") { log.error = nil }
        } message: { Text(log.error ?? "") }
        }
        .preferredColorScheme(.light)
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

private struct NativeInputPreview: View {
    @Environment(\.dismiss) private var dismiss
    @State private var food = ""
    @State private var quantity = ""

    var body: some View {
        NavigationStack {
            Form {
                TextField("Food name", text: $food)
                    .textInputAutocapitalization(.never)
                TextField("Quantity", text: $quantity)
                    .keyboardType(.decimalPad)
            }
            .navigationTitle("Input preview")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDragIndicator(.visible)
    }
}
