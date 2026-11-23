import { toPdfText, type DashboardReport } from "./intervention-export";

const MARGIN = 36;
const ROW_HEIGHT = 16;
const HEADER_BAND = 56;

/**
 * Render a `DashboardReport` to a landscape A4 PDF and download it. jsPDF is
 * imported on demand so it stays out of the dashboard's initial bundle.
 */
export async function downloadDashboardReportPdf(
  report: DashboardReport,
  filename: string,
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const bottom = pageHeight - MARGIN;

  // Title band
  pdf.setFillColor(22, 136, 27);
  pdf.rect(0, 0, pageWidth, HEADER_BAND, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text(toPdfText(report.title), MARGIN, 28);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text(
    toPdfText(
      [report.generatedLabel, report.datasetLabel].filter(Boolean).join("  ·  "),
    ),
    MARGIN,
    44,
  );

  let y = HEADER_BAND + 28;
  pdf.setTextColor(38, 38, 38);

  if (report.summary.length > 0) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text("City indicators", MARGIN, y);
    y += 16;
    pdf.setFontSize(9);
    for (const [label, value] of report.summary) {
      pdf.setFont("helvetica", "normal");
      pdf.text(toPdfText(label), MARGIN, y);
      pdf.setFont("helvetica", "bold");
      pdf.text(toPdfText(value), MARGIN + 200, y);
      y += 14;
    }
    y += 14;
  }

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(toPdfText(report.tableCaption), MARGIN, y);
  y += 10;

  const drawHeaderRow = () => {
    pdf.setFillColor(245, 245, 245);
    pdf.rect(MARGIN, y, pageWidth - MARGIN * 2, ROW_HEIGHT, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(82, 82, 82);
    drawCells(report.columns.map((c) => c.label));
    y += ROW_HEIGHT;
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(38, 38, 38);
  };

  const drawCells = (cells: string[]) => {
    let x = MARGIN;
    report.columns.forEach((col, i) => {
      const pad = 4;
      const text = fitText(toPdfText(cells[i] ?? ""), col.width - pad * 2);
      if (col.align === "right") {
        pdf.text(text, x + col.width - pad, y + 11, { align: "right" });
      } else {
        pdf.text(text, x + pad, y + 11);
      }
      x += col.width;
    });
  };

  // Truncate with "..." rather than wrapping, so every row stays one line.
  const fitText = (text: string, maxWidth: number) => {
    if (pdf.getTextWidth(text) <= maxWidth) return text;
    let cut = text;
    while (cut.length > 0 && pdf.getTextWidth(`${cut}...`) > maxWidth) {
      cut = cut.slice(0, -1);
    }
    return `${cut.trimEnd()}...`;
  };

  drawHeaderRow();

  if (report.rows.length === 0) {
    pdf.setFontSize(9);
    pdf.text("No barangays match the current filters.", MARGIN + 4, y + 11);
  }

  report.rows.forEach((cells, index) => {
    if (y + ROW_HEIGHT > bottom) {
      pdf.addPage();
      y = MARGIN;
      drawHeaderRow();
    }
    if (index % 2 === 1) {
      pdf.setFillColor(250, 250, 250);
      pdf.rect(MARGIN, y, pageWidth - MARGIN * 2, ROW_HEIGHT, "F");
    }
    pdf.setFontSize(8);
    drawCells(cells);
    y += ROW_HEIGHT;
  });

  const pageCount = pdf.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(140, 140, 140);
    pdf.text(`GreenPoint · Page ${page} of ${pageCount}`, pageWidth - MARGIN, pageHeight - 16, {
      align: "right",
    });
  }

  pdf.save(filename);
}
