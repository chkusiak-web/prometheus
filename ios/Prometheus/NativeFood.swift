import SwiftUI
import VisionKit

private struct CatalogFood: Decodable, Identifiable {
    let name: String
    let kcal: Double
    let protein: Double
    let carbs: Double
    let fat: Double
    let label: String
    let grams: Double
    let milliliters: Double?

    var id: String { "\(name)|\(label)|\(kcal)" }
    var serving: Double { milliliters ?? (grams > 0 ? grams : 100) }

    init(from decoder: Decoder) throws {
        var row = try decoder.unkeyedContainer()
        name = try row.decode(String.self)
        kcal = try row.decode(Double.self)
        protein = try row.decode(Double.self)
        carbs = try row.decode(Double.self)
        fat = try row.decode(Double.self)
        label = try row.decode(String.self)
        grams = try row.decode(Double.self)
        milliliters = row.isAtEnd ? nil : try row.decodeIfPresent(Double.self)
    }

    var units: [(String, Double)] {
        var result: [(String, Double)] = [("Servings", serving)]
        if let cups = label.range(of: #"^\d+(\.\d+)?(?= cups?\b)"#, options: [.regularExpression, .caseInsensitive]),
           let amount = Double(label[cups]), amount > 0 {
            result.append(("Cups", serving / amount))
        }
        result.append(milliliters != nil ? ("mL", 1) : ("Grams", 1))
        return result
    }
}

private enum Catalog {
    static let base = URL(string: "https://chkusiak-web.github.io/prometheus/")!

    static func fetch<Value: Decodable>(_ path: String, type: Value.Type) async throws -> Value? {
        let (data, response) = try await URLSession.shared.data(from: base.appendingPathComponent(path))
        if let status = (response as? HTTPURLResponse)?.statusCode {
            if status == 404 { return nil }
            guard status == 200 else { throw URLError(.badServerResponse) }
        }
        return try JSONDecoder().decode(type, from: data)
    }

    static func terms(_ value: String) -> [String] {
        value.lowercased().replacingOccurrences(of: #"\boat[-\s]*milk\b"#, with: "oat milk", options: .regularExpression)
            .split(whereSeparator: { !$0.isLetter && !$0.isNumber }).map(String.init)
    }

    static func matches(_ name: String, _ query: [String]) -> Bool {
        let words = terms(name)
        return query.allSatisfy { token in words.contains { $0.hasPrefix(token) } }
    }

    static func barcode(_ text: String) -> String? {
        guard [8, 12, 13, 14].contains(text.count), text.allSatisfy({ "0123456789".contains($0) })
        else { return nil }
        let value = String(text.drop(while: { $0 == "0" }))
        return value.isEmpty ? nil : value
    }
}

struct NativeFoodView: View {
    let log: NativeLog
    @State private var query = ""
    @State private var basics: [CatalogFood] = []
    @State private var products: [CatalogFood] = []
    @State private var showAll = false
    @State private var scanning = false
    @State private var scannedCode: String?
    @State private var selection: CatalogFood?
    @State private var quickAdd = false
    @State private var message: String?
    @State private var loading = false
    @State private var meal = {
        switch Calendar.current.component(.hour, from: Date()) {
        case 4..<11: "Breakfast"
        case 11..<15: "Lunch"
        case 15..<21: "Dinner"
        default: "Snack"
        }
    }()

    private var recent: [[String: Any]] {
        var seen = Set<String>()
        return log.food.keys.sorted(by: >).flatMap { Array((log.food[$0] ?? []).reversed()) }.filter {
            guard let name = $0["name"] as? String, Catalog.matches(name, Catalog.terms(query)) else { return false }
            return seen.insert(name.lowercased()).inserted
        }.prefix(6).map { $0 }
    }

    private var basicResults: [CatalogFood] {
        guard !Catalog.terms(query).isEmpty, Catalog.barcode(query) == nil else { return [] }
        return basics.filter { Catalog.matches($0.name, Catalog.terms(query)) }
            .sorted { $0.name.count < $1.name.count }
    }

    var body: some View {
        List {
            Section {
                Picker("Meal", selection: $meal) {
                    ForEach(["Breakfast", "Lunch", "Dinner", "Snack"], id: \.self) { Text($0) }
                }
                HStack {
                    TextField("Food or barcode", text: $query)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    Button("Scan", systemImage: "barcode.viewfinder") { scanning = true }
                        .labelStyle(.iconOnly).accessibilityLabel("Scan barcode")
                }
                Button("Quick add calories") { quickAdd = true }
            } header: { Text("\(log.caloriesToday) kcal logged today") }
            if let message { Text(message).font(.footnote) }
            if loading { ProgressView("Searching foods") }
            if !recent.isEmpty {
                Section("Recent") {
                    ForEach(Array(recent.enumerated()), id: \.offset) { _, entry in
                        Button {
                            var item = entry
                            item["id"] = UUID().uuidString
                            item["meal"] = meal
                            if log.addFood(item) { message = "Food added." }
                        } label: {
                            LabeledContent(entry["name"] as? String ?? "Food", value: "\(entry["kcal"] as? Int ?? 0) kcal")
                        }
                    }
                }
            }
            if !basicResults.isEmpty {
                Section("Basic foods") {
                    rows(Array(basicResults.prefix(showAll ? 40 : 4)))
                    if basicResults.count > 4 {
                        Button(showAll ? "Show fewer" : "Show more") { showAll.toggle() }
                    }
                }
            }
            if !products.isEmpty { Section("Branded foods") { rows(products) } }
            if let entries = log.food[BodyDate.today], !entries.isEmpty {
                Section("Logged today") {
                    ForEach(Array(entries.enumerated()), id: \.offset) { _, entry in
                        LabeledContent(entry["name"] as? String ?? "Food", value: "\(entry["kcal"] as? Int ?? 0) kcal")
                    }
                }
            }
        }
        .navigationTitle("Food")
        .task {
            do {
                async let legacy = Catalog.fetch("foods.json", type: [CatalogFood].self)
                async let survey = Catalog.fetch("catalog/survey.json", type: [CatalogFood].self)
                basics = try await (legacy ?? []) + (survey ?? [])
            } catch where !Task.isCancelled { message = "Food catalog unavailable. Recent foods and Quick Add still work." }
            catch {}
        }
        .task(id: query) { await search() }
        .sheet(item: $selection) { item in FoodPortion(food: item, meal: meal, log: log) }
        .sheet(isPresented: $quickAdd) { QuickFood(query: query, meal: meal, log: log) }
        .sheet(isPresented: $scanning, onDismiss: {
            guard let code = scannedCode else { return }
            scannedCode = nil
            if query == code { selection = products.first }
            else { query = code }
        }) {
            NavigationStack {
                Group {
                    if DataScannerViewController.isSupported && DataScannerViewController.isAvailable {
                        BarcodeCamera { code in scannedCode = code; scanning = false }
                    } else {
                        ContentUnavailableView("Camera unavailable", systemImage: "barcode", description: Text("Enter the barcode in food search."))
                    }
                }
                .navigationTitle("Scan barcode")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Done") { scanning = false } } }
            }
        }
    }

    private func rows(_ foods: [CatalogFood]) -> some View {
        ForEach(Array(foods.enumerated()), id: \.offset) { _, item in
            Button { selection = item } label: {
                VStack(alignment: .leading, spacing: 3) {
                    Text(item.name).foregroundStyle(.primary)
                    Text(item.label).font(.caption).foregroundStyle(.secondary)
                }
            }
        }
    }

    private func search() async {
        showAll = false
        products = []
        message = nil
        let text = query.trimmingCharacters(in: .whitespacesAndNewlines)
        let barcode = Catalog.barcode(text)
        let terms = Catalog.terms(text)
        guard let anchor = terms.max(by: { $0.count < $1.count }), anchor.count >= 3 || barcode != nil else {
            loading = false
            return
        }
        loading = true
        defer { if !Task.isCancelled { loading = false } }
        do {
            if let barcode {
                let items = try await Catalog.fetch("catalog/barcode/\(barcode.prefix(3)).json", type: [String: CatalogFood].self)
                try Task.checkCancellation()
                if let item = items?[barcode] {
                    products = [item]
                    selection = item
                } else { message = "No product found. Try a name search or Quick Add." }
            } else {
                try await Task.sleep(for: .milliseconds(220))
                let items = try await Catalog.fetch("catalog/search/\(anchor.prefix(3)).json", type: [CatalogFood].self) ?? []
                try Task.checkCancellation()
                products = Array(items.lazy.filter { Catalog.matches($0.name, terms) }.prefix(25))
                if products.isEmpty && basicResults.isEmpty { message = "No matches. Try fewer words or Quick Add." }
            }
        } catch where !Task.isCancelled {
            message = "Catalog lookup unavailable. Try again or use Quick Add."
        } catch {}
    }
}

private struct FoodPortion: View {
    @Environment(\.dismiss) private var dismiss
    let food: CatalogFood
    let meal: String
    let log: NativeLog
    @State private var unit: Int
    @State private var quantity: String

    init(food: CatalogFood, meal: String, log: NativeLog) {
        self.food = food
        self.meal = meal
        self.log = log
        let index = food.units.firstIndex { $0.0 == "Cups" } ?? 0
        _unit = State(initialValue: index)
        _quantity = State(initialValue: (food.serving / food.units[index].1).formatted(.number.grouping(.never).precision(.fractionLength(0...4))))
    }

    private var amount: Double { (Double(quantity.replacingOccurrences(of: ",", with: ".")) ?? 0) * food.units[unit].1 }
    private var valid: Bool { amount.isFinite && amount > 0 && amount <= 100_000 }
    private var energy: Int { valid ? Int((food.kcal * amount / 100).rounded()) : 0 }

    var body: some View {
        NavigationStack {
            Form {
                Section(food.name) {
                    Text(food.label)
                    TextField("Quantity", text: $quantity).keyboardType(.decimalPad)
                    Picker("Unit", selection: Binding(get: { unit }, set: { next in
                        if valid { quantity = (amount / food.units[next].1).formatted(.number.grouping(.never).precision(.fractionLength(0...4))) }
                        unit = next
                    })) {
                        ForEach(food.units.indices, id: \.self) { Text(food.units[$0].0).tag($0) }
                    }
                    LabeledContent("Calories", value: "\(energy) kcal")
                    Button("Add to \(meal)") {
                        var entry: [String: Any] = ["id": UUID().uuidString, "name": food.name, "meal": meal, "kcal": energy,
                            "p": food.protein * amount / 100, "c": food.carbs * amount / 100, "f": food.fat * amount / 100]
                        entry[food.milliliters == nil ? "grams" : "milliliters"] = amount
                        if log.addFood(entry) { dismiss() }
                    }.disabled(!valid)
                }
            }.navigationTitle("Portion").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }
    }
}

private struct QuickFood: View {
    @Environment(\.dismiss) private var dismiss
    let query: String
    let meal: String
    let log: NativeLog
    @State private var name = ""
    @State private var calories = ""
    private var energy: Int? { Int(calories).flatMap { (0...100_000).contains($0) ? $0 : nil } }

    var body: some View {
        NavigationStack {
            Form {
                TextField("Food name", text: $name)
                TextField("Calories", text: $calories).keyboardType(.numberPad)
                Button("Add to \(meal)") {
                    guard let energy else { return }
                    if log.addFood(["id": UUID().uuidString, "name": name.isEmpty ? "Quick Add" : name, "meal": meal, "kcal": energy]) { dismiss() }
                }.disabled(energy == nil)
            }.navigationTitle("Quick Add").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } } }
        }.onAppear { name = Catalog.barcode(query) == nil ? query : "" }
    }
}

private struct BarcodeCamera: UIViewControllerRepresentable {
    let onCode: (String) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onCode: onCode) }

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(recognizedDataTypes: [.barcode(symbologies: [.ean8, .ean13, .upce])],
            qualityLevel: .balanced, isHighlightingEnabled: true)
        scanner.delegate = context.coordinator
        return scanner
    }

    func updateUIViewController(_ scanner: DataScannerViewController, context: Context) {
        if !scanner.isScanning && !context.coordinator.delivered { try? scanner.startScanning() }
    }

    static func dismantleUIViewController(_ scanner: DataScannerViewController, coordinator: Coordinator) {
        scanner.stopScanning()
    }

    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        private let onCode: (String) -> Void
        var delivered = false
        init(onCode: @escaping (String) -> Void) { self.onCode = onCode }

        func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
            guard !delivered else { return }
            for item in addedItems {
                if case .barcode(let code) = item, let value = code.payloadStringValue {
                    delivered = true
                    dataScanner.stopScanning()
                    onCode(value)
                    return
                }
            }
        }
    }
}
