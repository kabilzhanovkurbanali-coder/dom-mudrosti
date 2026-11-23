// Finds faces in pictures with the macOS Vision framework.
// For every path prints one JSON line: {"path": …, "faces": [[x, y, w, h], …]}
// with the boxes in pixels, measured from the top-left corner.
//
//     swiftc -O tools/faces.swift -o .build/faces && .build/faces a.jpg b.jpg
import Foundation
import ImageIO
import Vision

for path in CommandLine.arguments.dropFirst() {
    var boxes: [[Int]] = []
    let url = URL(fileURLWithPath: path) as CFURL
    if let source = CGImageSourceCreateWithURL(url, nil),
       let image = CGImageSourceCreateImageAtIndex(source, 0, nil) {
        let w = Double(image.width), h = Double(image.height)
        let request = VNDetectFaceRectanglesRequest()
        try? VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
        for face in request.results ?? [] where face.confidence > 0.5 {
            let b = face.boundingBox
            boxes.append([
                Int(b.minX * w), Int((1 - b.maxY) * h), Int(b.width * w), Int(b.height * h),
            ])
        }
    }
    let line: [String: Any] = ["path": path, "faces": boxes]
    let data = try! JSONSerialization.data(withJSONObject: line)
    print(String(data: data, encoding: .utf8)!)
}
