// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "SentinelMobileAlert",
    platforms: [.iOS(.v16), .watchOS(.v9)],
    products: [.library(name: "SentinelMobileAlert", targets: ["SentinelMobileAlert"])],
    targets: [.target(name: "SentinelMobileAlert")]
)
