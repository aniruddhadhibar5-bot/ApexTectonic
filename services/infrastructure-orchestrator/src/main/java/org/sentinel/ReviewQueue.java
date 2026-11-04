package org.sentinel;

import java.util.Objects;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;

public final class ReviewQueue {
    public record AlertCandidate(String eventId, double confidence, String summary) {
        public AlertCandidate {
            if (eventId == null || eventId.isBlank()) {
                throw new IllegalArgumentException("eventId is required");
            }
            if (!Double.isFinite(confidence) || confidence < 0 || confidence > 1) {
                throw new IllegalArgumentException("confidence must be within [0, 1]");
            }
            Objects.requireNonNull(summary, "summary");
        }
    }

    private final BlockingQueue<AlertCandidate> queue = new LinkedBlockingQueue<>(1024);

    public boolean submitForHumanReview(AlertCandidate candidate) {
        return queue.offer(Objects.requireNonNull(candidate, "candidate"));
    }

    public AlertCandidate poll() {
        return queue.poll();
    }
}
