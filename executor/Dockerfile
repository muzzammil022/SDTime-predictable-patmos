# ── Sandboxed Linux executor ──
# Lightweight image with gcc + python3 for running user code
FROM debian:bookworm-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    libc6-dev \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Non-root user for safety
RUN useradd -m runner
USER runner
WORKDIR /home/runner

CMD ["sleep", "infinity"]
