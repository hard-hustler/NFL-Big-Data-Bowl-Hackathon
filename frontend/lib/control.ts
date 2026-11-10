/** Catch-point control charts, exported by backend/scripts/export_control_charts.py. */

export interface Prop {
  n: number
  rate: number
  lo: number
  hi: number
  third?: "low" | "mid" | "high"
}

export interface MeanCI {
  n: number
  mean: number
  lo: number
  hi: number
}

export interface ControlData {
  n_plays: number
  base_rate: number
  sameSep: (Prop & { sep: string; third: "low" | "mid" | "high" })[]
  joint: {
    r: number
    /** [separation, control, complete (0/1)] per target */
    points: [number, number, number][]
    cells: { x0: number; x1: number; y0: number; y1: number; n: number; rate: number }[]
  }
  timeline: Record<"cpc" | "separation" | "territory", (MeanCI & { t: number; outcome: "complete" | "incomplete" })[]>
  leverage: { rows: string[]; cols: string[]; cells: (Prop & { sep: string; lev: string })[] }
  hypotheses: {
    speed: (MeanCI & { label: string; air_yards: number })[]
    hips: (MeanCI & { label: string })[]
  }
}

export async function getControlData(): Promise<ControlData> {
  const res = await fetch("/data/control.json")
  if (!res.ok) throw new Error(`control.json failed: ${res.status}`)
  return res.json()
}
