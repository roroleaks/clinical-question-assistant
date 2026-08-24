export function sset(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export function sget<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function sdel(key: string) {
  try { sessionStorage.removeItem(key); } catch {}
}

export const KEYS = {
  input: "cq_input",
  mode: "cq_mode",
  gap: "cq_gap",
  question: "cq_question",
  formulation: "cq_formulation",
  commentary: "cq_commentary"
};
