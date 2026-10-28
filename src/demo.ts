import type { Exam } from "./domain";

export const demoExams: Exam[] = [
  { date: "2025-11-18", values: [102, 206, 48, 132, 28, 5.7] },
  { date: "2026-03-12", values: [98, 198, 51, 125, 31, 5.6] },
  { date: "2026-07-08", values: [94, 186, 54, 116, 35, 5.5] },
  { date: "2026-10-20", values: [91, 178, 57, 108, 38, 5.4] },
].map((entry, index) => ({
  id: `demo-${index}`,
  date: entry.date,
  laboratory: "Laboratorio de exemplo",
  filename: `exame-ficticio-${index + 1}.pdf`,
  readings: [
    { name: "Glicose", unit: "mg/dL", reference: "70 a 99 mg/dL (exemplo)" },
    {
      name: "Colesterol total",
      unit: "mg/dL",
      reference: "Inferior a 190 mg/dL (exemplo)",
    },
    {
      name: "Colesterol HDL",
      unit: "mg/dL",
      reference: "Superior a 40 mg/dL (exemplo)",
    },
    {
      name: "Colesterol LDL",
      unit: "mg/dL",
      reference: "Depende do risco cardiovascular",
    },
    {
      name: "Vitamina D",
      unit: "ng/mL",
      reference: "Interpretacao individualizada",
    },
    {
      name: "Hemoglobina glicada",
      unit: "%",
      reference: "Inferior a 5,7% (exemplo)",
    },
  ].map((reading, readingIndex) => ({
    ...reading,
    id: `demo-${index}-${readingIndex}`,
    value: entry.values[readingIndex],
  })),
}));
