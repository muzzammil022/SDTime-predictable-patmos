import type { NextApiRequest, NextApiResponse } from "next";
import { CodeRunnerResponse } from "@/lib/types";

/**
 * Patmos code execution endpoint.
 *
 * Proxies requests to the FastAPI backend which runs code on
 * the Patmos toolchain (patmos-clang → pasim / patemu) inside Docker.
 */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CodeRunnerResponse | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, mode = "simulate", timeout = 30, run_gcc = true } = req.body;

  if (!code || !code.trim()) {
    return res.status(400).json({ error: "Code cannot be empty" });
  }

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        mode,
        timeout,
        run_gcc,
      }),
    });

    if (!backendRes.ok) {
      const errorText = await backendRes.text();
      return res.status(backendRes.status).json({
        error: `Backend error (${backendRes.status}): ${errorText}`,
      } as any);
    }

    const data: CodeRunnerResponse = await backendRes.json();
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("Failed to reach Patmos backend:", err.message);

    // Return a helpful error when backend is not running
    return res.status(503).json({
      error: `Cannot reach Patmos backend at ${BACKEND_URL}. Make sure to run: docker compose up`,
    } as any);
  }
}
