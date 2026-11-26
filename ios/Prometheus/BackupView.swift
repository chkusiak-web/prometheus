import SwiftUI
import UniformTypeIdentifiers

private struct BackupDocument: FileDocument {
    static let readableContentTypes: [UTType] = [.json]
    let data: Data

    init(data: Data) { self.data = data }

    init(configuration: ReadConfiguration) throws {
        guard let data = configuration.file.regularFileContents else { throw BackupError.invalid }
        self.data = data
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}

struct BackupView: View {
    @State private var stored: BackupSnapshot?
    @State private var candidate: BackupSnapshot?
    @State private var importing = false
    @State private var exporting = false
    @State private var message: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Backup").font(.headline).accessibilityAddTraits(.isHeader)
            if let stored {
                Text("Saved on this device").font(.subheadline)
                summary(stored)
                Button("Export backup") { exporting = true }
            } else {
                Text("In the web app, go to Hero → Settings → Save backup. Then choose that JSON file here.")
                    .font(.subheadline)
            }
            Button("Import backup") { importing = true }
                .buttonStyle(.bordered)
            if let message { Text(message).font(.footnote) }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(.background, in: RoundedRectangle(cornerRadius: 20))
        .task {
            do { stored = try BackupStorage.appStorage().load() }
            catch { message = "Could not read the saved backup: \(error.localizedDescription)" }
        }
        .fileImporter(isPresented: $importing, allowedContentTypes: [.json]) { result in
            do {
                let url = try result.get()
                let accessed = url.startAccessingSecurityScopedResource()
                defer { if accessed { url.stopAccessingSecurityScopedResource() } }
                let incoming = try BackupSnapshot(data: Data(contentsOf: url))
                if incoming.data == stored?.data {
                    message = "This backup is already saved."
                } else {
                    candidate = incoming
                }
            } catch {
                message = "Import failed: \(error.localizedDescription)"
            }
        }
        .fileExporter(isPresented: $exporting,
                      document: stored.map { BackupDocument(data: $0.data) },
                      contentType: .json, defaultFilename: "prometheus-backup") { result in
            switch result {
            case .success: message = "Backup exported."
            case .failure(let error): message = "Export failed: \(error.localizedDescription)"
            }
        }
        .sheet(isPresented: Binding(get: { candidate != nil }, set: { if !$0 { candidate = nil } })) {
            if let candidate {
                NavigationStack {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 12) {
                            if stored != nil {
                                Text("Importing replaces the backup saved in this app. Your original JSON file is kept.")
                                    .font(.subheadline)
                            }
                            summary(candidate)
                        }
                        .padding(20)
                    }
                    .navigationTitle("Review backup")
                    .navigationBarTitleDisplayMode(.inline)
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            Button("Cancel") { self.candidate = nil }
                        }
                        ToolbarItem(placement: .confirmationAction) {
                            Button(stored == nil ? "Import" : "Replace") { save(candidate) }
                        }
                    }
                }
            }
        }
    }

    private func summary(_ backup: BackupSnapshot) -> some View {
        VStack(spacing: 8) {
            ForEach(backup.counts, id: \.label) { entry in
                LabeledContent(entry.label, value: entry.count.formatted())
            }
        }
        .font(.subheadline)
    }

    private func save(_ backup: BackupSnapshot) {
        do {
            try BackupStorage.appStorage().save(backup)
            stored = backup
            candidate = nil
            message = "Backup imported."
        } catch {
            candidate = nil
            message = "Could not save the backup: \(error.localizedDescription)"
        }
    }
}
