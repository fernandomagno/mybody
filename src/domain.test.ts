import assert from "node:assert/strict";
import { test } from "node:test";
import {
  comparePoints,
  groupIndicators,
  numberFromInput,
  parseExamText,
  validateExam,
} from "./domain.ts";
import type { Exam } from "./domain.ts";

const exam: Exam = {
  id: "one",
  date: "2025-01-02",
  laboratory: "Exemplo",
  filename: "",
  readings: [
    { id: "a", name: "Glicose", value: 95, unit: "mg/dL", reference: "" },
  ],
};

test("numbers accept decimal comma but not inequality, empty or ambiguous thousands", () => {
  assert.equal(numberFromInput("5,8"), 5.8);
  for (const value of ["", "< 5", "1.000,00", "NaN"])
    assert.ok(Number.isNaN(numberFromInput(value)));
});
test("groups by exact unit and normalized name, ordering dates", () => {
  const newer = {
    ...exam,
    id: "two",
    date: "2026-01-02",
    readings: [{ ...exam.readings[0], name: " GLICOSE ", value: 100 }],
  };
  const incompatible = {
    ...exam,
    id: "three",
    readings: [{ ...exam.readings[0], unit: "mmol/L" }],
  };
  const groups = groupIndicators([newer, exam, incompatible]);
  assert.equal(groups.length, 2);
  const comparable = groups.find((group) => group.unit === "mg/dL")!;
  assert.equal(comparable.points[0].date, exam.date);
  assert.equal(comparePoints(comparable.points)?.difference, 5);
});
test("does not claim before/after for same date or compute percent from zero", () => {
  const points = groupIndicators([exam, exam])[0].points;
  assert.equal(comparePoints(points), null);
  points[0] = { ...points[0], value: 0, date: "2024-01-01" };
  assert.equal(comparePoints(points)?.percent, null);
});
test("conservative extraction excludes reference lines and preserves inequality results", () => {
  const parsed = parseExamText(
    "Glicose: 95 mg/dL\nColesterol total: 180 mg/dL\nValores de referencia Glicose 70 mg/dL\nFerritina: < 5 ng/mL\nCreatinina: 0,8 mg/dL",
  );
  assert.deepEqual(
    parsed.map((reading) => reading.value),
    [95, 180, "< 5", 0.8],
  );
  assert.equal(
    parseExamText("Hemoglobina glicada: 5,8 %")[0].name,
    "Hemoglobina glicada",
  );
});

test("reads blood count columns, thousands, ligatures and references without mixing values", () => {
  const parsed = parseExamText(
    "Eritrocitos\n5,10 10^6/μL 4,50 a 5,50 10^6/μL\nNeutró fi los 45,0 % 2.250 /μL 40,0 a 80,0 % 1.800 a 7.800 /μL\nContagem de Plaquetas 250.000 /μL 150.000 a 450.000 /μL\nVCM\n87,0 fL 83,0 a 101,0 fL",
  );
  assert.deepEqual(
    parsed.map(({ name, value, unit }) => ({ name, value, unit })),
    [
      { name: "Eritrocitos", value: 5.1, unit: "10^6/µL" },
      { name: "Neutrofilos", value: 45, unit: "%" },
      { name: "Neutrofilos", value: 2250, unit: "/µL" },
      { name: "Plaquetas", value: 250000, unit: "/µL" },
      { name: "VCM", value: 87, unit: "fL" },
    ],
  );
  assert.equal(parsed[1].reference, "40,0 a 80,0 %");
  assert.equal(parsed[2].reference, "1.800 a 7.800 /μL");
});

test("reads multiline hormone labels and retains bounded and qualitative results outside charts", () => {
  const parsed = parseExamText(
    "FSH - Hormonio Foliculo\nEstimulante\nInferior a\n0,4 mUI/mL\n1,4 a 18,1 mUI/mL\nHormonio Tireoestimulante\nUltrassensivel (TSH)\n2,1 μUI/mL 0,40 a 4,30 μUI/mL\nNucleo\nNao Reagente Nao Reagente\nTransaminase oxalacetica - TGO\n(Aspartato amino transferase)\n26 U/L Inferior a 34 U/L",
  );
  assert.deepEqual(
    parsed.map((reading) => reading.value),
    ["Inferior a 0,4", 2.1, "Nao Reagente", 26],
  );
  const groups = groupIndicators([{ ...exam, readings: parsed }]);
  assert.equal(groups.length, 2);
  assert.equal(validateExam({ ...exam, readings: parsed }).readings.length, 4);
});

test("keeps coagulation contexts separate and does not invent a result from a reference table", () => {
  const readings = parseExamText(
    "Tempo de Protrombina\nRESULTADO INTERVALO DE REFERENCIA\nTempo em segundos:\n14,5 s Nao se aplica\nAtividade de Protrombina:\n83 % 70 a 100%\nRazao Normatizada Internacional (RNI):\n1,1 1,0 a 1,25\fTempo de Tromboplastina Parcial Ativado\nRESULTADO INTERVALO DE REFERENCIA\nTempo em segundos\n35,5 s 27,8 a 38,6 s\nRelacao:\n1,05 0,9 a 1,25\nTabela de Referencia - Testosterona Total\n22 a 49 anos: 100 a 900 ng/dL",
  );
  assert.deepEqual(
    readings.map((reading) => reading.name),
    [
      "TP - Tempo",
      "Atividade de Protrombina",
      "RNI (INR)",
      "TTPa - Tempo",
      "TTPa - Relacao",
    ],
  );
});

test("accepts parenthetical abbreviations without discarding the measured value", () => {
  const readings = parseExamText(
    "25-Hidroxivitamina D (Vitamina D) 32 ng/mL CONFIRA NA TABELA ABAIXO\nTiroxina Livre (T4 Livre) 1,20 ng/dL 0,89 a 1,76 ng/dL\nHormonio Luteinizante (LH) Inferior a 0,15 mUI/mL CONFIRA NA TABELA ABAIXO\nCreatinofosfoquinase (CPK) 180 U/L 39 a 308 U/L",
  );
  assert.deepEqual(
    readings.map((reading) => reading.name),
    ["Vitamina D", "T4 Livre", "LH", "CPK"],
  );
  assert.equal(readings[2].value, "Inferior a 0,15");
});
test("rejects invalid date, NaN and duplicate results", () => {
  assert.throws(() => validateExam({ ...exam, date: "2026-02-31" }));
  assert.throws(() =>
    validateExam({ ...exam, readings: [{ ...exam.readings[0], value: NaN }] }),
  );
  assert.throws(() =>
    validateExam({ ...exam, readings: [exam.readings[0], exam.readings[0]] }),
  );
  assert.equal(validateExam(exam).id, "one");
});

test("extracts testosterone labels on separate lines, without historical or reference values", () => {
  const readings = parseExamText(
    "Testosterona Total\n620,50 ng/dL (Vide Intervalo de Referencia Abaixo)\nHistorico Testosterona Total\nResultado 410,00 ng/dL 620,50 ng/dL\nTestosterona Livre Calculada\n12,34 ng/dL\nTabela de Referencia - Testosterona Livre Calculada\n17 a 40 anos: 3,40 a 24,60 ng/dL\nTestosterona Biodisponivel\n230,10 ng/dL",
  );
  assert.deepEqual(
    readings.map(({ name, value, unit }) => ({ name, value, unit })),
    [
      { name: "Testosterona Total", value: 620.5, unit: "ng/dL" },
      { name: "Testosterona Livre Calculada", value: 12.34, unit: "ng/dL" },
      { name: "Testosterona Biodisponivel", value: 230.1, unit: "ng/dL" },
    ],
  );
});
