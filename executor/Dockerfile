# ── Patmos T-CREST Executor ──
# Ubuntu image with the full Patmos toolchain:
#   patmos-clang  — C compiler targeting Patmos
#   pasim         — fast instruction-set simulator
#   patemu        — cycle-accurate hardware emulator (Verilator)
#
# First build takes ~30-60 min. Use ./misc/build.sh -q for pre-compiled (faster).

FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# ── 1. System dependencies ──
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    openjdk-11-jdk \
    cmake \
    make \
    g++ \
    gcc \
    libc6-dev \
    texinfo \
    flex \
    bison \
    subversion \
    libelf-dev \
    graphviz \
    libboost-dev \
    libboost-program-options-dev \
    ruby-full \
    chrpath \
    liblpsolve55-dev \
    zlib1g-dev \
    autoconf \
    libfl2 \
    expect \
    verilator \
    curl \
    gnupg \
    apt-transport-https \
    ca-certificates \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# ── 2. Install sbt (Scala build tool, needed for Patmos hardware gen) ──
RUN echo "deb https://repo.scala-sbt.org/scalasbt/debian all main" \
    > /etc/apt/sources.list.d/sbt.list && \
    curl -sL "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x2EE0EA64E40A89B84B2DF73499E82A75642AC823" \
    | gpg --dearmor -o /etc/apt/trusted.gpg.d/sbt.gpg && \
    apt-get update && apt-get install -y sbt && \
    rm -rf /var/lib/apt/lists/*

# ── 3. Build the T-CREST / Patmos toolchain ──
ENV PATH="/root/t-crest/local/bin:${PATH}"

RUN mkdir -p /root/t-crest && \
    cd /root/t-crest && \
    git clone https://github.com/t-crest/patmos-misc.git misc && \
    cd misc && \
    ./build.sh -q

# Verify tools are available
RUN which patmos-clang && patmos-clang --version || true
RUN which pasim || true
RUN which patemu || true

# ── 4. Build patemu (hardware emulator) if not already present ──
RUN if ! command -v patemu &> /dev/null; then \
    cd /root/t-crest && \
    if [ -d "patmos" ]; then \
    cd patmos && make emulator || true; \
    fi; \
    fi

# ── 5. Non-root runner user for safety ──
RUN useradd -m runner && \
    chmod -R a+rX /root/t-crest/local || true

ENV PATH="/root/t-crest/local/bin:${PATH}"

USER runner
WORKDIR /home/runner

CMD ["sleep", "infinity"]
