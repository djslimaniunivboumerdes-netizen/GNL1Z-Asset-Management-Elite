// src/lib/alarmStore.ts
// Lightweight in-memory pub/sub store for Smart Flow's simulated live alarm feed.
// Shared across SmartFlow (producer) and AiAgentChat (consumer) with zero backend
// dependency — pure client-side simulation on top of the real equipment master
// catalog, so the AI Agent can answer "what alarms are active right now?" with
// data that matches whatever is actually flashing on the Smart Process Flow screen.

export type AlarmSeverity = "P1" | "P2" | "P3";

export interface SimulatedAlarm {
  id: string;
  tag: string;          // TAGS[].id (short diagram tag, e.g. "E501")
  dbTag: string | null;  // full master-catalog tag, e.g. "X01-E-501"
  nameEn: string;
  nameFr: string;
  unit: string;
  instrument: string;    // e.g. "PAHH-10104"
  kind: string;          // e.g. "High Pressure"
  kindFr: string;
  severity: AlarmSeverity;
  descriptionEn: string;
  descriptionFr: string;
  actionEn: string;
  actionFr: string;
  triggeredAt: number;   // epoch ms
  acknowledged: boolean;
}

type Listener = () => void;

let alarms: SimulatedAlarm[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeAlarms(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAlarmsSnapshot(): SimulatedAlarm[] {
  return alarms;
}

export function pushAlarm(alarm: SimulatedAlarm) {
  // Avoid stacking duplicate unacknowledged alarms on the same tag+kind
  const exists = alarms.some(
    (a) => a.tag === alarm.tag && a.kind === alarm.kind && !a.acknowledged
  );
  if (exists) return;
  alarms = [alarm, ...alarms].slice(0, 20);
  emit();
}

export function acknowledgeAlarm(id: string) {
  alarms = alarms.map((a) => (a.id === id ? { ...a, acknowledged: true } : a));
  emit();
}

export function clearAlarm(id: string) {
  alarms = alarms.filter((a) => a.id !== id);
  emit();
}

export function getActiveAlarms(): SimulatedAlarm[] {
  return alarms.filter((a) => !a.acknowledged);
}
