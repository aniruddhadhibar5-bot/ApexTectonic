import Foundation

public struct AlertCandidate: Sendable {
    public let eventID: String
    public let confidence: Double

    public init(eventID: String, confidence: Double) throws {
        guard !eventID.isEmpty, confidence.isFinite, (0.0...1.0).contains(confidence) else {
            throw AlertError.invalidCandidate
        }
        self.eventID = eventID
        self.confidence = confidence
    }
}

public enum AlertError: Error {
    case invalidCandidate
}

public actor CandidateBuffer {
    private let alerts: AsyncStream<AlertCandidate>
    private var continuation: AsyncStream<AlertCandidate>.Continuation?

    public init() {
        let pair = AsyncStream<AlertCandidate>.makeStream(
            bufferingPolicy: .bufferingNewest(128)
        )
        alerts = pair.stream
        continuation = pair.continuation
    }

    public func stream() -> AsyncStream<AlertCandidate> {
        alerts
    }

    public func publish(
        _ candidate: AlertCandidate
    ) -> AsyncStream<AlertCandidate>.Continuation.YieldResult? {
        continuation?.yield(candidate)
    }

    public func finish() {
        continuation?.finish()
        continuation = nil
    }
}
