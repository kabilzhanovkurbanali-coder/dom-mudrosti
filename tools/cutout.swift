// Cuts the subject (a person with what he holds) out of a picture with the
// macOS Vision framework — the same «lift subject» as in the Photos app.
// For every pair of arguments «in.jpg out.png» writes a grey mask
// (white = the person) of the size of the picture. macOS 14 or newer.
//
//     swiftc -O tools/cutout.swift -o .build/cutout && .build/cutout a.jpg a.mask.png
import AppKit
import CoreImage
import Foundation
import Vision

let args = Array(CommandLine.arguments.dropFirst())
var i = 0
let context = CIContext()
while i + 1 < args.count {
    let input = URL(fileURLWithPath: args[i])
    let output = URL(fileURLWithPath: args[i + 1])
    i += 2
    guard let source = CGImageSourceCreateWithURL(input as CFURL, nil),
          let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        print("fail \(input.path): cannot read")
        continue
    }
    let handler = VNImageRequestHandler(cgImage: image, options: [:])
    let request = VNGenerateForegroundInstanceMaskRequest()
    do {
        try handler.perform([request])
        guard let result = request.results?.first else {
            print("fail \(input.path): no subject")
            continue
        }
        let mask = try result.generateScaledMaskForImage(forInstances: result.allInstances, from: handler)
        let ci = CIImage(cvPixelBuffer: mask)
        guard let cg = context.createCGImage(ci, from: ci.extent) else {
            print("fail \(input.path): cannot render")
            continue
        }
        let rep = NSBitmapImageRep(cgImage: cg)
        try rep.representation(using: .png, properties: [:])!.write(to: output)
        print("ok \(output.path)")
    } catch {
        print("fail \(input.path): \(error)")
    }
}
