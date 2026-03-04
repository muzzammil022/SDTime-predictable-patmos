// === Simulation State Types ===

export interface CarState {
  x: number; // horizontal position (lane center)
  y: number; // distance traveled along road
  speed: number; // units per second
  lane: number; // 0 = left, 1 = right
  steering: number; // -1 left, 0 straight, 1 right (for animation)
  braking: boolean;
}

export interface Obstacle {
  x: number;
  y: number; // fixed position on the road
  lane: number;
  width: number;
  height: number;
}

export type Difficulty = "easy" | "hard";

export interface SimulationConfig {
  roadLength: number; // total road distance
  laneWidth: number; // pixels per lane
  numLanes: number;
  detectionThreshold: number; // distance at which Patmos triggers
  initialSpeed: number;
  brakeDeceleration: number;
  laneChangeSpeed: number; // how fast lane change animates
  numObstacles: number; // 1-5
  difficulty: Difficulty;
}

export const DIFFICULTY_PRESETS: Record<Difficulty, { speed: number; detectionThreshold: number; brakeDeceleration: number }> = {
  easy: { speed: 120, detectionThreshold: 250, brakeDeceleration: 350 },
  hard: { speed: 220, detectionThreshold: 150, brakeDeceleration: 250 },
};

export const DEFAULT_CONFIG: SimulationConfig = {
  roadLength: 2000,
  laneWidth: 120,
  numLanes: 2,
  detectionThreshold: 250, // pixels
  initialSpeed: 120, // pixels per second
  brakeDeceleration: 350,
  laneChangeSpeed: 4,
  numObstacles: 1,
  difficulty: "easy",
};

// === Patmos API Types ===

export interface PatmosRequest {
  distance: number;
  speed: number;
  lane: number;
  deadline_cycles: number;
}

export interface PatmosResponse {
  action: "steer" | "brake" | "none";
  target_lane: number;
  brake_force: number;
  cycles_used: number;
  deadline_cycles: number;
  deadline_met: boolean;
  execution_path: string; // which branch was taken
  timestamp: number;
}

// === Timing Comparison Types ===

export interface ProcessorTiming {
  cycles: number;
  wcet: number; // worst-case execution time in cycles
  bcet: number; // best-case execution time in cycles
  jitter: number; // wcet - bcet
  executionTimeMs: number; // wall-clock time
}

export interface TimingComparison {
  patmos: ProcessorTiming;
  normal: ProcessorTiming;
  speedup: number; // ratio
  predictabilityGain: number; // jitter reduction ratio
}

// === Code Runner Types (Patmos Backend) ===

export type ExecutionMode = "simulate" | "emulate" | "both";

export interface CodeRunnerRequest {
  code: string;
  mode: ExecutionMode;
  timeout?: number;
  run_gcc?: boolean;
}

/** Stats from pasim / patemu */
export interface PatmosStats {
  cycles: number;
  instructions: number;
  bundles: number;
  cache_hits: number;
  cache_misses: number;
  method_cache_hits: number;
  method_cache_misses: number;
  stack_cache_ops: number;
  raw_output: string;
}

/** Result from a single tool (pasim, patemu, or gcc) */
export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string | null;
  exit_code: number;
  wall_time_ms: number;
  tool: "pasim" | "patemu" | "gcc";
  stats?: PatmosStats | null;
}

/** Full response from /api/execute */
export interface CodeRunnerResponse {
  success: boolean;
  code: string;
  mode: string;
  pasim?: ExecutionResult | null;
  patemu?: ExecutionResult | null;
  gcc?: ExecutionResult | null;
  summary?: string | null;
}

// === Simulation Status ===

export type SimStatus = "idle" | "running" | "patmos-triggered" | "avoiding" | "completed" | "collision";

export interface SimulationState {
  car: CarState;
  obstacles: Obstacle[];
  status: SimStatus;
  patmosResult: PatmosResponse | null;
  patmosHistory: PatmosResponse[];
  elapsedTime: number;
  triggerDistance: number | null;
  timingComparison: TimingComparison | null;
}
