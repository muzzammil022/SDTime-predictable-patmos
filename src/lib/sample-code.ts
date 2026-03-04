export interface CodeSample {
  name: string;
  description: string;
  code: string;
}

export const SAMPLE_CODES: CodeSample[] = [
  {
    name: "Binary Search",
    description: "Bounded binary search on a fixed-size sorted array — O(log n) with known WCET",
    code: `#include <stdio.h>

// Binary search on a fixed-size sorted array
// Bounded iterations: at most log2(SIZE) = 4 iterations
// No dynamic memory, fully deterministic

#define SIZE 16

int data[SIZE] = {2, 5, 8, 12, 16, 23, 38, 42, 55, 67, 72, 81, 93, 99, 104, 110};

int binary_search(int target) {
    int low = 0;
    int high = SIZE - 1;

    // Bounded loop: at most log2(16) = 4 iterations
    for (int i = 0; i < 4; i++) {
        if (low > high) break;
        int mid = low + (high - low) / 2;

        if (data[mid] == target) {
            return mid;
        } else if (data[mid] < target) {
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return -1; // not found
}

int main() {
    int target = 42;
    int index = binary_search(target);

    if (index >= 0) {
        printf("Found %d at index %d\\n", target, index);
    } else {
        printf("Value %d not found\\n", target);
    }
    return 0;
}`,
  },
  {
    name: "Bubble Sort",
    description: "Fixed-size bubble sort — bounded O(n²) iterations for WCET analysis",
    code: `#include <stdio.h>

// Bubble sort on a fixed-size array
// Exactly N*(N-1)/2 comparisons — fully bounded
// No dynamic memory, no recursion

#define N 8

int arr[N] = {64, 34, 25, 12, 22, 11, 90, 45};

void bubble_sort() {
    // Bounded outer loop: exactly N-1 iterations
    for (int i = 0; i < N - 1; i++) {
        // Bounded inner loop: exactly N-1-i iterations
        for (int j = 0; j < N - 1 - i; j++) {
            if (arr[j] > arr[j + 1]) {
                int temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
            }
        }
    }
}

int main() {
    bubble_sort();

    printf("Sorted: ");
    for (int i = 0; i < N; i++) {
        printf("%d ", arr[i]);
    }
    printf("\\n");
    return 0;
}`,
  },
  {
    name: "Matrix Multiply",
    description: "Fixed-dimension matrix multiplication — deterministic triple-nested loop",
    code: `#include <stdio.h>

// Matrix multiplication: C = A * B
// Fixed dimensions: 4x4 matrices
// Exactly N^3 = 64 multiply-accumulate operations
// Fully bounded, no dynamic allocation

#define N 4

int A[N][N] = {
    {1, 2, 3, 4},
    {5, 6, 7, 8},
    {9, 10, 11, 12},
    {13, 14, 15, 16}
};

int B[N][N] = {
    {16, 15, 14, 13},
    {12, 11, 10, 9},
    {8, 7, 6, 5},
    {4, 3, 2, 1}
};

int C[N][N];

void mat_mul() {
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            C[i][j] = 0;
            for (int k = 0; k < N; k++) {
                C[i][j] += A[i][k] * B[k][j];
            }
        }
    }
}

int main() {
    mat_mul();

    printf("Result matrix C:\\n");
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            printf("%4d ", C[i][j]);
        }
        printf("\\n");
    }
    return 0;
}`,
  },
  {
    name: "CRC Calculation",
    description: "CRC-8 checksum over fixed-length data — bit-level bounded loops",
    code: `#include <stdio.h>

// CRC-8 calculation (polynomial 0x07)
// Fixed data length, bounded bit-level loops
// Common in safety-critical communication protocols

#define DATA_LEN 8
#define CRC_POLY 0x07

unsigned char data[DATA_LEN] = {0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38};

unsigned char crc8(unsigned char *buf, int len) {
    unsigned char crc = 0x00;

    // Bounded loop: exactly DATA_LEN iterations
    for (int i = 0; i < len; i++) {
        crc ^= buf[i];

        // Bounded loop: exactly 8 iterations (one per bit)
        for (int bit = 0; bit < 8; bit++) {
            if (crc & 0x80) {
                crc = (crc << 1) ^ CRC_POLY;
            } else {
                crc = crc << 1;
            }
        }
    }
    return crc;
}

int main() {
    unsigned char checksum = crc8(data, DATA_LEN);

    printf("Data: ");
    for (int i = 0; i < DATA_LEN; i++) {
        printf("0x%02X ", data[i]);
    }
    printf("\\n");
    printf("CRC-8: 0x%02X\\n", checksum);

    // Verify: recalculate should match
    unsigned char verify = crc8(data, DATA_LEN);
    printf("Verify: %s\\n", (verify == checksum) ? "PASS" : "FAIL");
    return 0;
}`,
  },
  {
    name: "Fibonacci",
    description: "Iterative Fibonacci with bounded loop — no recursion, WCET-safe",
    code: `#include <stdio.h>

// Iterative Fibonacci sequence
// Bounded loop: exactly N iterations
// No recursion (recursion makes WCET analysis hard)
// No dynamic memory

#define N 20

unsigned int fib[N];

void compute_fibonacci() {
    fib[0] = 0;
    fib[1] = 1;

    // Bounded loop: exactly N-2 iterations
    for (int i = 2; i < N; i++) {
        fib[i] = fib[i - 1] + fib[i - 2];
    }
}

int main() {
    compute_fibonacci();

    printf("Fibonacci sequence (first %d):\\n", N);
    for (int i = 0; i < N; i++) {
        printf("F(%d) = %u\\n", i, fib[i]);
    }

    // Sum of all values (bounded accumulation)
    unsigned int sum = 0;
    for (int i = 0; i < N; i++) {
        sum += fib[i];
    }
    printf("Sum: %u\\n", sum);
    return 0;
}`,
  },
  {
    name: "Obstacle Avoidance",
    description: "Real-time obstacle avoidance decision — safety-critical with bounded WCET",
    code: `#include <stdio.h>

// Obstacle avoidance decision algorithm
// This is the critical real-time code that runs when
// the car's sensor detects an obstacle ahead.
//
// On Patmos: WCET is bounded and deterministic
// On Normal CPU: timing varies with cache state

#define THRESHOLD 150
#define BRAKE_MAX 1000

typedef struct { int x, y, speed, lane; } Car;
typedef struct { int x, y, lane; } Obstacle;
typedef struct { int action, target_lane, brake_force; } Decision;

// action: 0=none, 1=steer, 2=brake
Decision avoid(Car car, Obstacle obs) {
    Decision d = {0, car.lane, 0};
    int dist = obs.y - car.y;
    int same = (car.lane == obs.lane);

    if (same && dist > 0 && dist < THRESHOLD) {
        if (car.lane == 0) {
            d.action = 1;  // steer right
            d.target_lane = 1;
        } else {
            d.action = 1;  // steer left
            d.target_lane = 0;
        }
        d.brake_force = (THRESHOLD - dist) * BRAKE_MAX / THRESHOLD;
    }
    return d;
}

int main() {
    Car car = {60, 0, 200, 0};
    Obstacle obs = {60, 120, 0};

    printf("=== Obstacle Avoidance Benchmark ===\\n");
    printf("Car: lane=%d speed=%d\\n", car.lane, car.speed);
    printf("Obstacle: lane=%d dist=%d\\n", obs.lane, obs.y);
    printf("\\n");

    // Run decision 100 times to measure consistency
    // On Patmos, every iteration takes the same cycles
    int steer_count = 0, brake_count = 0, none_count = 0;
    for (int i = 0; i < 100; i++) {
        car.y = i;
        Decision d = avoid(car, obs);
        if (d.action == 1) steer_count++;
        else if (d.action == 2) brake_count++;
        else none_count++;
    }

    printf("Results over 100 iterations:\\n");
    printf("  Steer: %d\\n", steer_count);
    printf("  Brake: %d\\n", brake_count);
    printf("  None:  %d\\n", none_count);
    printf("\\nOn Patmos, every iteration takes the same cycles.\\n");
    printf("On a normal CPU, cache state causes timing variation.\\n");
    return 0;
}`,
  },
];
