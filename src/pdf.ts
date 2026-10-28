import { parseExamText } from "./domain";
import { extractPageText } from "./pdf-text";

export async function readPdf(file: File) {
  if (!file.name.toLowerCase().endsWith(".pdf"))
    throw new Error("Selecione um arquivo PDF.");
  if (file.size > 15 * 1024 * 1024)
    throw new Error("O limite e de 15 MB por PDF.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
    throw new Error("O arquivo nao tem uma assinatura PDF valida.");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const task = pdfjs.getDocument({ data: bytes });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 50)
      throw new Error("O limite e de 50 paginas por exame.");
    let text = "";
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      text += extractPageText(content.items);
      page.cleanup();
      if (text.length > 500_000)
        throw new Error(
          "PDF com texto demais para revisao. Envie um exame menor.",
        );
    }
    return { text, readings: parseExamText(text) };
  } catch (error) {
    if (error instanceof Error && error.name === "PasswordException")
      throw new Error(
        "PDF protegido por senha. Exporte uma copia sem senha no seu computador.",
      );
    throw error;
  } finally {
    await task.destroy();
  }
}
