import Vision
import AppKit
import Foundation

// OCR local con el framework Vision de Apple (español).
// Uso: swift ocr.swift <imagen> [--sorted]
let args = CommandLine.arguments
guard args.count >= 2 else { print("uso: swift ocr.swift <imagen>"); exit(1) }
let path = args[1]
let sorted = args.contains("--sorted")

guard let img = NSImage(contentsOfFile: path),
      let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    print("ERROR: no se pudo cargar \(path)")
    exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["es-ES", "en-US"]
request.usesLanguageCorrection = true
request.minimumTextHeight = 0.01

let handler = VNImageRequestHandler(cgImage: cg, options: [:])
try handler.perform([request])

var lines: [(String, CGRect)] = []
for obs in request.results ?? [] {
    if let top = obs.topCandidates(1).first {
        lines.append((top.string, obs.boundingBox))
    }
}

if sorted {
    // Orden de lectura: de arriba a abajo, luego de izquierda a derecha
    lines.sort {
        let dy = $0.1.midY - $1.1.midY
        return abs(dy) > 0.01 ? dy > 0 : $0.1.minX < $1.1.minX
    }
}
for (s, _) in lines { print(s) }
