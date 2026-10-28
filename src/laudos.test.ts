import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { parseExamText, validateExam } from "./domain.ts";
import { extractPageText } from "./pdf-text.ts";

const cases = [
  {
    file: "Laudo Completo 02_03_2026 (1).pdf",
    count: 76,
    textual: 9,
    additional: [
      "CPK",
      "TP - Tempo",
      "TTPa - Tempo",
      "Anti-tireoglobulina",
      "Anti-TPO",
      "FAN - Nucleo",
      "FAN - Envelope Nuclear",
      "FAN - Nucleolo",
      "FAN - Citoplasma",
      "FAN - Aparelho Mitotico",
      "FAN - Placa Metafasica Cromossomica",
      "Paratormonio (PTH)",
    ],
  },
  {
    file: "Laudo Completo 13_10_2026 (2).pdf",
    count: 59,
    textual: 2,
    additional: [
      "Acido Folico",
      "Albumina",
      "T3 Livre",
      "Fosfatase Alcalina",
      "PSA Livre",
      "Relacao PSA Livre / PSA Total",
      "Vitamina A",
      "Vitamina C",
    ],
  },
];

for (const [index, entry] of cases.entries()) {
  const path = fileURLToPath(new URL(`../../${entry.file}`, import.meta.url));
  test(
    `cobertura do laudo local ${index + 1} sem copiar dados pessoais para fixtures`,
    { skip: !existsSync(path) },
    async () => {
      const task = getDocument({
        data: new Uint8Array(readFileSync(path)),
        useSystemFonts: true,
      });
      try {
        const pdf = await task.promise;
        let text = "";
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          const page = await pdf.getPage(pageNumber);
          text += extractPageText((await page.getTextContent()).items);
          page.cleanup();
        }
        const readings = parseExamText(text);
        assert.equal(
          readings.length,
          entry.count,
          "Quantidade de campos reconhecidos mudou; revise a cobertura",
        );
        assert.equal(
          readings.filter((reading) => typeof reading.value === "string")
            .length,
          entry.textual,
        );
        for (const name of [
          "Eritrocitos",
          "Hemoglobina",
          "Hematocrito",
          "Leucocitos",
          "Neutrofilos",
          "Eosinofilos",
          "Basofilos",
          "Linfocitos",
          "Monocitos",
          "Plaquetas",
          "VPM",
          "Ferro",
          "Ferritina",
          "Vitamina B12",
          "Ureia",
          "Creatinina",
          "eGFR",
          "Vitamina D",
          "Glicose",
          "Hemoglobina glicada",
          "Glicose Media Estimada",
          "Colesterol total",
          "Colesterol LDL",
          "Colesterol HDL",
          "Colesterol VLDL",
          "Triglicerideos",
          "Acido Urico",
          "TGO (AST)",
          "TGP (ALT)",
          "Gama-GT",
          "TSH",
          "T4 Livre",
          "Prolactina",
          "Estradiol",
          "FSH",
          "LH",
          "SHBG",
          "Testosterona Total",
          "Testosterona Livre Calculada",
          "Testosterona Biodisponivel",
          "PSA Total",
          ...entry.additional,
        ]) {
          assert.ok(
            readings.some((reading) => reading.name === name),
            `Campo ausente: ${name}`,
          );
        }
        for (const name of [
          "Testosterona Total",
          "Testosterona Livre Calculada",
          "Testosterona Biodisponivel",
        ]) {
          const label =
            name === "Testosterona Biodisponivel"
              ? "Testosterona Biodispon[ií]vel"
              : name;
          const source = new RegExp(
            `^\\s*${label.replaceAll(" ", "\\s+")}\\s+([0-9.,]+)\\s+ng/dL`,
            "m",
          ).exec(text.replaceAll("\f", "\n"));
          assert.ok(source, `Resultado atual nao localizado na fonte: ${name}`);
          const expected = Number(
            source[1].replace(/\./g, "").replace(",", "."),
          );
          assert.ok(
            readings.some(
              (reading) =>
                reading.name === name &&
                reading.value === expected &&
                reading.unit === "ng/dL",
            ),
            `Resultado atual divergente para ${name}`,
          );
        }
        validateExam({
          id: crypto.randomUUID(),
          date: "2026-01-01",
          laboratory: "Validacao local",
          filename: "",
          readings,
        });
      } finally {
        await task.destroy();
      }
    },
  );
}
