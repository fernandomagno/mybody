import { z } from "zod";

export const readingSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  value: z.union([z.number().finite(), z.string().trim().min(1).max(500)]),
  unit: z.string().trim().min(1).max(40),
  reference: z.string().max(200),
});

export const examSchema = z.object({
  id: z.string().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((value) => {
      const parsed = new Date(`${value}T12:00:00Z`);
      return (
        !Number.isNaN(parsed.valueOf()) &&
        parsed.toISOString().slice(0, 10) === value
      );
    }, "Data invalida"),
  laboratory: z.string().trim().min(1).max(100),
  filename: z.string().max(200),
  readings: z.array(readingSchema).min(1).max(300),
});

export type Reading = z.infer<typeof readingSchema>;
export type Exam = z.infer<typeof examSchema>;
export type Point = Omit<Reading, "value"> & {
  value: number;
  date: string;
  examId: string;
  laboratory: string;
};
export type Indicator = {
  key: string;
  name: string;
  unit: string;
  points: Point[];
};

export function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function numberFromInput(value: string): number {
  const clean = value.trim();
  if (!/^-?\d+(?:[.,]\d+)?$/.test(clean)) return Number.NaN;
  return Number(clean.replace(",", "."));
}

export function comparisonKey(reading: Pick<Reading, "name" | "unit">) {
  return `${normalizeName(reading.name)}|${reading.unit.trim()}`;
}

export function groupIndicators(exams: Exam[]): Indicator[] {
  const grouped = new Map<string, Indicator>();
  for (const exam of exams) {
    for (const reading of exam.readings) {
      if (typeof reading.value !== "number") continue;
      const key = comparisonKey(reading);
      const item = grouped.get(key) ?? {
        key,
        name: reading.name,
        unit: reading.unit,
        points: [],
      };
      item.points.push({
        ...reading,
        value: reading.value,
        date: exam.date,
        examId: exam.id,
        laboratory: exam.laboratory,
      });
      grouped.set(key, item);
    }
  }
  return [...grouped.values()]
    .map((item) => ({
      ...item,
      points: item.points.sort((left, right) =>
        left.date.localeCompare(right.date),
      ),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

export function comparePoints(points: Point[]) {
  const current = points.at(-1);
  const previous = points.at(-2);
  if (!current || !previous || current.date === previous.date) return null;
  const difference = current.value - previous.value;
  return {
    difference,
    percent:
      previous.value === 0
        ? null
        : (difference / Math.abs(previous.value)) * 100,
  };
}

const knownTests = [
  ["Testosterona Livre Calculada", /^testosterona livre calculada\b/],
  [
    "Testosterona Biodisponivel",
    /^testosterona biodisponivel(?: calculada)?\b/,
  ],
  ["Testosterona Total", /^testosterona total\b/],
  ["Glicose Media Estimada", /^glicose media estimada(?:\s*\(gme\))?/],
  ["Glicose", /^(?:glicose|glicemia(?: em jejum)?)\b/],
  ["Hemoglobina glicada", /^(?:hemoglobina glicada(?:\s*-\s*hba1c)?|hba1c)\b/],
  ["Hemoglobina", /^hemoglobina\b/],
  [
    "Colesterol nao HDL",
    /^(?:nao[ -]*hdl\s*-?\s*colesterol|colesterol nao[ -]*hdl)\b/,
  ],
  ["Colesterol total", /^colesterol total\b/],
  ["Colesterol HDL", /^(?:colesterol[ -]*hdl|hdl(?:\s*-?\s*colesterol)?)\b/],
  [
    "Colesterol LDL",
    /^(?:colesterol[ -]*ldl|ldl(?:\s*-?\s*colesterol)?)(?:\s*\(calculado\))?/,
  ],
  ["Colesterol VLDL", /^(?:colesterol[ -]*vldl|vldl(?:\s*-?\s*colesterol)?)\b/],
  ["Triglicerideos", /^triglicer(?:ideos|ides)\b/],
  ["Eritrocitos", /^(?:eritrocitos|hemacias)\b/],
  ["Hematocrito", /^hematocrito\b/],
  ["VCM", /^vcm\b/],
  ["HCM", /^hcm\b/],
  ["CHCM", /^chcm\b/],
  ["RDW", /^rdw\b/],
  ["Leucocitos", /^leucocitos\b/],
  ["Neutrofilos", /^neutrofilos\b/],
  ["Eosinofilos", /^eosinofilos\b/],
  ["Basofilos", /^basofilos\b/],
  ["Linfocitos", /^linfocitos\b/],
  ["Monocitos", /^monocitos\b/],
  ["Plaquetas", /^(?:contagem de )?plaquetas\b/],
  ["VPM", /^vpm\b/],
  ["Creatinina", /^creatinina\b/],
  ["eGFR", /^\*?(?:egfr|taxa de filtracao glomerular(?: estimada)?)\b/],
  ["Ureia", /^ureia\b/],
  ["Ferro", /^ferro\b/],
  ["Ferritina", /^ferritina\b/],
  ["Acido Folico", /^acido folico\b/],
  ["Acido Urico", /^acido urico\b/],
  ["Vitamina B12", /^vitamina\s*b[ -]?12(?:,\s*dosagem)?\b/],
  [
    "Vitamina D",
    /^(?:25[ -]hidroxivitamina d(?:\s*\(vitamina d\))?|vitamina\s*d(?:\s*25)?)\b/,
  ],
  ["Vitamina A", /^vitamina a\b/],
  ["Vitamina C", /^vitamina c\b/],
  ["Potassio", /^potassio\b/],
  ["Sodio", /^sodio\b/],
  ["Magnesio", /^magnesio\b/],
  ["Fosforo", /^fosforo\b/],
  ["Calcio", /^calcio\b/],
  ["Albumina", /^albumina\b/],
  ["Paratormonio (PTH)", /^(?:paratormonio\s*-?\s*pth(?: molecula)?|pth)\b/],
  ["Insulina", /^insulina\b/],
  ["HOMA-IR", /^(?:indice )?homa[ -]?ir\b/],
  ["HOMA-beta", /^(?:indice )?homa[ -]?(?:beta|b)\b/],
  ["CPK", /^(?:creatinofosfoquinase(?:\s*\(cpk\))?|cpk)\b/],
  ["TGO (AST)", /^(?:transaminase oxalacetica\s*-\s*tgo|tgo|ast)\b/],
  ["TGP (ALT)", /^(?:transaminase piruvica\s*-\s*tgp|tgp|alt)\b/],
  ["Gama-GT", /^(?:gama[ -]glutamil transferase|gama[ -]?gt|ggt)\b/],
  ["Fosfatase Alcalina", /^fosfatase alcalina\b/],
  ["Amilase", /^amilase\b/],
  ["Lipase", /^lipase\b/],
  ["Anti-tireoglobulina", /^anti[ -]?tireoglobulina(?:,\s*anticorpos)?\b/],
  ["Anti-TPO", /^(?:antiperoxidase tireoideana(?:\s*-)?|anti[ -]?tpo)\b/],
  ["TSH", /^(?:hormonio tireoestimulante|tsh)\b/],
  ["T3 Livre", /^t3 livre(?:\s*\(triiodotironina livre\))?/],
  ["T3 Total", /^t3 total(?:\s*\(triiodotironina\))?/],
  ["T4 Livre", /^(?:tiroxina livre(?:\s*\(t4 livre\))?|t4 livre)\b/],
  ["Prolactina", /^prolactina\b/],
  ["Estradiol", /^estradiol\b/],
  ["FSH", /^fsh(?:\s*-\s*hormonio foliculo)?\b/],
  ["LH", /^(?:hormonio luteinizante(?:\s*\(lh\))?|lh)\b/],
  ["SHBG", /^shbg\b/],
  ["Relacao PSA Livre / PSA Total", /^relacao psa livre\s*\/\s*psa total\b/],
  ["PSA Total", /^psa total\b/],
  ["PSA Livre", /^psa livre\b/],
  ["Atividade de Protrombina", /^atividade de protrombina\b/],
  [
    "RNI (INR)",
    /^(?:razao normatizada internacional(?:\s*\(rni\))?|rni|inr)\b/,
  ],
  ["FAN - Nucleo", /^nucleo\b/],
  ["FAN - Envelope Nuclear", /^envelope nuclear\b/],
  ["FAN - Nucleolo", /^nucleolo\b/],
  ["FAN - Citoplasma", /^citoplasma\b/],
  ["FAN - Aparelho Mitotico", /^aparelho mitotico\b/],
  ["FAN - Placa Metafasica Cromossomica", /^placa metafasica cromossomica\b/],
] as const;

const numberPattern = "(?:\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:[.,]\\d+)?)";
const unitPattern =
  "(?:10\\s*\\^\\s*6\\s*\\/[μµu]L|mL\\/min\\/1[.,]73\\s*m[²2]|(?:m|n|[μµu])?mol\\/L|(?:[μµu]|m)?(?:UI|U)\\/(?:mL|L)|(?:[μµu]|m|n|p)?g\\/(?:dL|mL|L)|\\/[μµu]L|fL|pg|s|%)";
const measurement = new RegExp(
  `^\\s*(?:(inferior(?: ou igual)? a|superior(?: ou igual)? a|[<>≤≥]=?)\\s*)?(${numberPattern})\\s*(${unitPattern})?(?=\\s|$|[;,])`,
  "i",
);
const whiteCells = new Set([
  "Leucocitos",
  "Neutrofilos",
  "Eosinofilos",
  "Basofilos",
  "Linfocitos",
  "Monocitos",
]);
const dimensionless = new Set([
  "RNI (INR)",
  "TTPa - Relacao",
  "HOMA-IR",
  "HOMA-beta",
]);

function cleanReportLine(line: string) {
  return line
    .normalize("NFKC")
    .replace(/([\p{L}])\s+(fi|fl)\s+(?=[\p{L}])/gu, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

function reportNumber(value: string) {
  return Number(
    value.includes(",")
      ? value.replace(/\./g, "").replace(",", ".")
      : /^\d{1,3}(?:\.\d{3})+$/.test(value)
        ? value.replace(/\./g, "")
        : value,
  );
}

function reportUnit(value: string) {
  const key = value.replace(/\s+/g, "").replace(/[μµu]/g, "u").toLowerCase();
  const units: Record<string, string> = {
    "mg/dl": "mg/dL",
    "g/dl": "g/dL",
    "ng/dl": "ng/dL",
    "ng/ml": "ng/mL",
    "pg/ml": "pg/mL",
    "ug/dl": "µg/dL",
    "mg/l": "mg/L",
    "mmol/l": "mmol/L",
    "nmol/l": "nmol/L",
    "umol/l": "µmol/L",
    "uui/ml": "µUI/mL",
    "mui/ml": "mUI/mL",
    "mui/l": "mUI/L",
    "ui/ml": "UI/mL",
    "u/ml": "U/mL",
    "u/l": "U/L",
    "/ul": "/µL",
    "10^6/ul": "10^6/µL",
    "ml/min/1,73m2": "mL/min/1,73m2",
    "ml/min/1.73m2": "mL/min/1,73m2",
    fl: "fL",
    pg: "pg",
    s: "s",
    "%": "%",
  };
  return units[key] ?? value;
}

function readMeasurement(text: string, name: string) {
  const input = text
    .replace(/^\s*\([^)]*\)\s*/, "")
    .replace(/^\s*[:.-]?\s*(?:resultado\s*:?)?\s*/i, "");
  const qualitative =
    /^((?:n[aã]o\s+)?reagente|negativo|positivo|inconclusivo|ausente|presente)\b/i.exec(
      input,
    );
  if (qualitative)
    return {
      value: qualitative[1],
      unit: "qualitativo",
      rest: input.slice(qualitative[0].length).trim(),
    };
  const matched = measurement.exec(input);
  if (!matched || (!matched[3] && !dimensionless.has(name))) return null;
  const numeric = reportNumber(matched[2]);
  if (!Number.isFinite(numeric)) return null;
  const value = matched[1] ? `${matched[1]} ${matched[2]}` : numeric;
  return {
    value,
    unit: matched[3] ? reportUnit(matched[3]) : "indice",
    rest: input.slice(matched[0].length).trim(),
  };
}

function matchTest(line: string) {
  const normalized = normalizeName(line);
  for (const [name, pattern] of knownTests) {
    const match = pattern.exec(normalized);
    if (match)
      return { name: name as string, suffix: line.slice(match[0].length) };
  }
  return null;
}

export function parseExamText(text: string): Reading[] {
  const found = new Map<string, Reading>();
  function add(
    name: string,
    result: NonNullable<ReturnType<typeof readMeasurement>>,
    reference: string,
  ) {
    const reading = {
      id: crypto.randomUUID(),
      name,
      value: result.value,
      unit: result.unit,
      reference: reference.slice(0, 200),
    };
    const key = comparisonKey(reading);
    if (!found.has(key)) found.set(key, reading);
  }
  for (const page of text.split("\f")) {
    const lines = page.split(/\r?\n/).map(cleanReportLine).filter(Boolean);
    let coagulation = "";
    for (const [index, line] of lines.entries()) {
      const normalized = normalizeName(line);
      if (/^tempo de protrombina\b/.test(normalized)) coagulation = "TP";
      if (/^tempo de tromboplastina\b/.test(normalized)) coagulation = "TTPa";
      if (
        /^(?:tabela de|historico|resultado(?:\s|$)|intervalo|valor(?:es)? de|referencia|nota|observa|\(material|\(metodo)/.test(
          normalized,
        )
      )
        continue;
      let candidate = matchTest(line);
      if (!candidate && /^tempo em segundos\b/.test(normalized) && coagulation)
        candidate = {
          name: `${coagulation} - Tempo`,
          suffix: line.replace(/^tempo em segundos\s*:?/i, ""),
        };
      if (
        !candidate &&
        /^relacao\s*:/.test(normalized) &&
        coagulation === "TTPa"
      )
        candidate = {
          name: "TTPa - Relacao",
          suffix: line.replace(/^rela[cç][aã]o\s*:/i, ""),
        };
      if (!candidate) continue;
      let result = readMeasurement(candidate.suffix, candidate.name);
      let resultIndex = index;
      for (
        let offset = 1;
        !result && offset <= 5 && index + offset < lines.length;
        offset++
      ) {
        const next = lines[index + offset];
        const normalNext = normalizeName(next);
        if (
          matchTest(next) ||
          /^(?:tabela de|historico|resultado|intervalo|referencia|\(material|\(metodo|hash:)/.test(
            normalNext,
          )
        )
          break;
        let valueLine = next;
        if (
          /^(?:inferior|superior)(?: ou igual)? a$|^[<>≤≥]=?$/.test(normalNext)
        )
          valueLine += ` ${lines[index + offset + 1] ?? ""}`;
        result = readMeasurement(valueLine, candidate.name);
        resultIndex = index + offset;
        if (!result && /\d|[=;]/.test(next)) break;
      }
      if (!result) continue;
      let reference = result.rest;
      if (!reference) {
        const next = lines[resultIndex + 1] ?? "";
        if (
          /^(?:\d+[.,]?\d*\s*(?:a|ate|até|-)\s*\d|inferior a|superior a|n[aã]o se aplica|vide notas)/i.test(
            next,
          )
        )
          reference = next;
      }
      if (whiteCells.has(candidate.name) && result.unit === "%") {
        const absolute = readMeasurement(result.rest, candidate.name);
        if (absolute?.unit === "/µL") {
          const end = absolute.rest.indexOf("%");
          add(
            candidate.name,
            result,
            end >= 0 ? absolute.rest.slice(0, end + 1) : "",
          );
          add(
            candidate.name,
            absolute,
            end >= 0 ? absolute.rest.slice(end + 1).trim() : absolute.rest,
          );
          continue;
        }
      }
      add(candidate.name, result, reference);
    }
  }
  return [...found.values()];
}

export function validateExam(exam: unknown) {
  const parsed = examSchema.safeParse(exam);
  if (!parsed.success)
    throw new Error(
      "Revise a data, o laboratorio, os nomes, valores numericos e unidades de todos os itens.",
    );
  const keys = parsed.data.readings.map(comparisonKey);
  if (new Set(keys).size !== keys.length)
    throw new Error(
      "Ha indicadores duplicados com a mesma unidade neste exame.",
    );
  return parsed.data;
}
