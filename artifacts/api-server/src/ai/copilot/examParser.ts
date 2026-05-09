// Lightweight extractor for common veterinary lab values from free-text exam
// summaries. Pattern is best-effort; never fails or throws on bad input.
//
// Reference ranges below are intentionally generic — they are meant to flag
// likely-abnormal values to the LLM as hints, not to make clinical decisions.
// Always reviewed by the veterinarian.

export type ExamValueFlag = "low" | "high" | "normal" | "unknown";

export interface ParsedExamValue {
  name: string;
  value: number;
  unit: string | null;
  flag: ExamValueFlag;
  reference: { min: number; max: number; unit: string } | null;
}

interface RefRange {
  min: number;
  max: number;
  unit: string;
}

type SpeciesKey = "dog" | "cat" | "unknown";

// Aliases (lowercased, accents removed) → canonical name used internally.
const ALIASES: Record<string, string> = {
  alt: "ALT",
  tgp: "ALT",
  ast: "AST",
  tgo: "AST",
  creatinina: "Creatinina",
  ureia: "Ureia",
  bun: "Ureia",
  glicose: "Glicose",
  glicemia: "Glicose",
  hematocrito: "Hematócrito",
  ht: "Hematócrito",
  hemoglobina: "Hemoglobina",
  hgb: "Hemoglobina",
  plaquetas: "Plaquetas",
  leucocitos: "Leucócitos",
  wbc: "Leucócitos",
  fosfatasealcalina: "Fosfatase alcalina",
  fa: "Fosfatase alcalina",
  alp: "Fosfatase alcalina",
  proteinastotais: "Proteínas totais",
  albumina: "Albumina",
  bilirrubinatotal: "Bilirrubina total",
  colesterol: "Colesterol",
  triglicerideos: "Triglicerídeos",
  potassio: "Potássio",
  sodio: "Sódio",
  calcio: "Cálcio",
  fosforo: "Fósforo",
  t4: "T4 total",
  t4total: "T4 total",
};

const REFERENCE: Record<SpeciesKey, Record<string, RefRange>> = {
  dog: {
    ALT: { min: 10, max: 100, unit: "U/L" },
    AST: { min: 0, max: 50, unit: "U/L" },
    "Fosfatase alcalina": { min: 20, max: 150, unit: "U/L" },
    Creatinina: { min: 0.5, max: 1.8, unit: "mg/dL" },
    Ureia: { min: 10, max: 60, unit: "mg/dL" },
    Glicose: { min: 60, max: 110, unit: "mg/dL" },
    Hematócrito: { min: 37, max: 55, unit: "%" },
    Hemoglobina: { min: 12, max: 18, unit: "g/dL" },
    Plaquetas: { min: 200, max: 500, unit: "x10³/μL" },
    Leucócitos: { min: 6, max: 17, unit: "x10³/μL" },
    "Proteínas totais": { min: 5.4, max: 7.5, unit: "g/dL" },
    Albumina: { min: 2.6, max: 4, unit: "g/dL" },
    "Bilirrubina total": { min: 0.1, max: 0.5, unit: "mg/dL" },
    Colesterol: { min: 135, max: 270, unit: "mg/dL" },
    Triglicerídeos: { min: 30, max: 130, unit: "mg/dL" },
    Potássio: { min: 3.6, max: 5.5, unit: "mEq/L" },
    Sódio: { min: 140, max: 155, unit: "mEq/L" },
    Cálcio: { min: 9, max: 11.5, unit: "mg/dL" },
    Fósforo: { min: 2.5, max: 5.5, unit: "mg/dL" },
    "T4 total": { min: 1.0, max: 4.0, unit: "μg/dL" },
  },
  cat: {
    ALT: { min: 10, max: 130, unit: "U/L" },
    AST: { min: 0, max: 60, unit: "U/L" },
    "Fosfatase alcalina": { min: 5, max: 60, unit: "U/L" },
    Creatinina: { min: 0.8, max: 2.4, unit: "mg/dL" },
    Ureia: { min: 15, max: 65, unit: "mg/dL" },
    Glicose: { min: 70, max: 150, unit: "mg/dL" },
    Hematócrito: { min: 30, max: 45, unit: "%" },
    Hemoglobina: { min: 9, max: 15, unit: "g/dL" },
    Plaquetas: { min: 200, max: 500, unit: "x10³/μL" },
    Leucócitos: { min: 5.5, max: 19, unit: "x10³/μL" },
    "Proteínas totais": { min: 5.5, max: 7.5, unit: "g/dL" },
    Albumina: { min: 2.5, max: 3.9, unit: "g/dL" },
    "Bilirrubina total": { min: 0.1, max: 0.4, unit: "mg/dL" },
    Colesterol: { min: 75, max: 220, unit: "mg/dL" },
    Triglicerídeos: { min: 25, max: 160, unit: "mg/dL" },
    Potássio: { min: 3.5, max: 5.5, unit: "mEq/L" },
    Sódio: { min: 145, max: 158, unit: "mEq/L" },
    Cálcio: { min: 8, max: 11, unit: "mg/dL" },
    Fósforo: { min: 3, max: 6, unit: "mg/dL" },
    "T4 total": { min: 1.0, max: 4.0, unit: "μg/dL" },
  },
  unknown: {},
};

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function speciesKey(speciesPt: string | null | undefined): SpeciesKey {
  const k = normalizeKey(speciesPt ?? "");
  if (k.startsWith("can") || k.includes("cao") || k.includes("dog")) return "dog";
  if (k.startsWith("fel") || k.includes("gato") || k.includes("cat")) return "cat";
  return "unknown";
}

// Matches "Name: 12,3 unit", "Name 12.3 unit", "Name = 12,3", etc.
// Captures: 1 = label words, 2 = value, 3 = unit (optional, no spaces)
const LINE_RE =
  /([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ ]{1,40}?)\s*[:=]?\s*([0-9]+(?:[.,][0-9]+)*)\s*([a-zA-Zµμ%][a-zA-Z%/μµ³⁻¹·.°^0-9]{0,12})?/g;

function parseNumber(raw: string): number {
  // Heurística para milhar vs decimal:
  // - Se aparecem `.` e `,`, o ÚLTIMO é o decimal e o outro é separador de milhar.
  // - Se aparece só um separador e o grupo após tem exatamente 3 dígitos
  //   (ex.: "18.500", "1,234"), tratamos como milhar.
  // - Caso contrário, é decimal.
  const hasDot = raw.includes(".");
  const hasComma = raw.includes(",");
  if (hasDot && hasComma) {
    const lastDot = raw.lastIndexOf(".");
    const lastComma = raw.lastIndexOf(",");
    if (lastComma > lastDot) {
      return Number(raw.replace(/\./g, "").replace(",", "."));
    }
    return Number(raw.replace(/,/g, ""));
  }
  if (hasDot || hasComma) {
    const sep = hasDot ? "." : ",";
    const parts = raw.split(sep);
    const tail = parts[parts.length - 1];
    if (parts.length > 2 || tail.length === 3) {
      // Milhar: remove todos os separadores.
      return Number(raw.split(sep).join(""));
    }
    return Number(raw.replace(",", "."));
  }
  return Number(raw);
}

function flagFor(value: number, ref: RefRange | null): ExamValueFlag {
  if (!ref) return "unknown";
  if (value < ref.min) return "low";
  if (value > ref.max) return "high";
  return "normal";
}

/**
 * Parse free-text into known lab values. Returns at most `limit` values to
 * keep prompts bounded.
 */
export function parseExamValues(
  text: string | null | undefined,
  species: SpeciesKey,
  limit = 8,
): ParsedExamValue[] {
  if (!text) return [];
  const refs = REFERENCE[species] ?? {};
  const out: ParsedExamValue[] = [];
  const seen = new Set<string>();

  // Reset regex state between calls.
  LINE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = LINE_RE.exec(text)) !== null) {
    if (out.length >= limit) break;
    const labelRaw = m[1].trim();
    const valueRaw = m[2];
    const unitRaw = m[3]?.trim() || null;

    // Skip if label is just a single short word that could be noise.
    if (labelRaw.length < 2) continue;

    const key = normalizeKey(labelRaw.replace(/\s+/g, ""));
    const canonical = ALIASES[key];
    if (!canonical) continue;
    if (seen.has(canonical)) continue;

    const value = parseNumber(valueRaw);
    if (!Number.isFinite(value)) continue;

    const ref = refs[canonical] ?? null;
    seen.add(canonical);
    out.push({
      name: canonical,
      value,
      unit: unitRaw ?? ref?.unit ?? null,
      flag: flagFor(value, ref),
      reference: ref,
    });
  }
  return out;
}

export function formatParsedValues(values: ParsedExamValue[]): string | null {
  if (values.length === 0) return null;
  const parts = values.map((v) => {
    const unit = v.unit ? ` ${v.unit}` : "";
    if (v.flag === "high" && v.reference)
      return `${v.name} ${v.value}${unit} ↑ (ref ${v.reference.min}–${v.reference.max} ${v.reference.unit})`;
    if (v.flag === "low" && v.reference)
      return `${v.name} ${v.value}${unit} ↓ (ref ${v.reference.min}–${v.reference.max} ${v.reference.unit})`;
    if (v.flag === "normal" && v.reference)
      return `${v.name} ${v.value}${unit} (normal)`;
    return `${v.name} ${v.value}${unit}`;
  });
  return parts.join(" • ");
}
