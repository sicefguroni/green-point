import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";

const COLOR_PROPS = [
  "color",
  "background",
  "background-color",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-color",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "outline-color",
  "text-decoration-color",
  "box-shadow",
  "text-shadow",
  "fill",
  "stroke",
] as const;

const PDF_FOOTER_RESERVE = 28;
const SLICE_SNAP_BUFFER_CSS = 4;

function sanitizeOklchColorsInClone(
  clonedDocument: Document,
  rootSelector: string,
) {
  const root = clonedDocument.querySelector(rootSelector);
  if (!root) return;

  const probe = clonedDocument.createElement("span");
  probe.style.position = "fixed";
  probe.style.opacity = "0";
  probe.style.pointerEvents = "none";
  probe.style.color = "#000000";
  clonedDocument.body.appendChild(probe);

  const resolveColorToken = (token: string) => {
    probe.style.color = token.trim();
    return clonedDocument.defaultView?.getComputedStyle(probe).color ?? token;
  };

  const replaceUnsupportedColors = (value: string) =>
    value.replace(/oklch\([^)]*\)|color-mix\([^)]*\)/gi, (match) =>
      resolveColorToken(match),
    );

  const elements = [
    clonedDocument.documentElement,
    clonedDocument.body,
    root,
    ...Array.from(root.querySelectorAll("*")),
  ];

  elements.forEach((element) => {
    if (!(element instanceof HTMLElement || element instanceof SVGElement)) {
      return;
    }

    const computed = clonedDocument.defaultView?.getComputedStyle(element);
    if (!computed) return;

    COLOR_PROPS.forEach((prop) => {
      const value = computed.getPropertyValue(prop);
      if (!value || (!value.includes("oklch") && !value.includes("color-mix"))) {
        return;
      }
      const sanitized = replaceUnsupportedColors(value);
      if (sanitized !== value) {
        element.style.setProperty(prop, sanitized);
      }
    });
  });

  probe.remove();
}

export interface MultiPagePdfExportOptions {
  fileName: string;
  title: string;
  subtitle?: string;
  rootSelector?: string;
  margin?: number;
  headerHeight?: number;
}

export const EXPORT_AVOID_BREAK_ATTR = "data-export-avoid-break";

interface ContentRect {
  top: number;
  bottom: number;
  height: number;
}

function collectLeafAvoidBreakRects(root: HTMLElement): ContentRect[] {
  const attrSelector = `[${EXPORT_AVOID_BREAK_ATTR}]`;
  const rects: ContentRect[] = [];
  const rootRect = root.getBoundingClientRect();

  root.querySelectorAll(attrSelector).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    if (node.querySelector(attrSelector)) return;

    const nodeRect = node.getBoundingClientRect();
    const top = nodeRect.top - rootRect.top;
    const bottom = nodeRect.bottom - rootRect.top;

    rects.push({
      top,
      bottom,
      height: bottom - top,
    });
  });

  return rects
    .filter((rect) => rect.height > 0)
    .sort((a, b) => a.top - b.top);
}

function snapSliceEndCss(
  sliceStartCss: number,
  proposedEndCss: number,
  rects: ContentRect[],
  maxPageContentCss: number,
): number {
  let end = proposedEndCss;

  for (const rect of rects) {
    if (rect.bottom <= sliceStartCss + SLICE_SNAP_BUFFER_CSS) continue;
    if (rect.top >= end) break;

    const wouldSplitBlock =
      end > rect.top + SLICE_SNAP_BUFFER_CSS && end < rect.bottom - SLICE_SNAP_BUFFER_CSS;
    const blockStartsOnThisSlice =
      rect.top >= sliceStartCss - SLICE_SNAP_BUFFER_CSS;

    if (wouldSplitBlock && blockStartsOnThisSlice) {
      end = Math.max(sliceStartCss, rect.top - SLICE_SNAP_BUFFER_CSS);
    }
  }

  if (end <= sliceStartCss + 1) {
    const blocking = rects.find(
      (rect) =>
        rect.top >= sliceStartCss - SLICE_SNAP_BUFFER_CSS &&
        rect.top < proposedEndCss &&
        rect.height <= maxPageContentCss + SLICE_SNAP_BUFFER_CSS,
    );

    if (blocking) {
      return Math.min(sliceStartCss + maxPageContentCss, blocking.bottom);
    }

    return proposedEndCss;
  }

  return end;
}

function buildImageSliceOffsets(
  totalHeightCss: number,
  imgHeightPdf: number,
  rects: ContentRect[],
  firstPageContentPdf: number,
  nextPageContentPdf: number,
): number[] {
  if (totalHeightCss <= 0) return [0, imgHeightPdf];

  const cssToPdf = imgHeightPdf / totalHeightCss;
  const slicesPdf = [0];
  let sliceStartCss = 0;
  let pageIndex = 0;
  let guard = 0;

  while (sliceStartCss < totalHeightCss - 0.5 && guard < 500) {
    guard += 1;
    const pageContentPdf =
      pageIndex === 0 ? firstPageContentPdf : nextPageContentPdf;
    const pageContentCss = pageContentPdf / cssToPdf;
    let sliceEndCss = Math.min(sliceStartCss + pageContentCss, totalHeightCss);

    sliceEndCss = snapSliceEndCss(
      sliceStartCss,
      sliceEndCss,
      rects,
      pageContentCss,
    );

    if (sliceEndCss <= sliceStartCss + 1) {
      sliceEndCss = Math.min(sliceStartCss + pageContentCss, totalHeightCss);
    }

    slicesPdf.push(sliceEndCss * cssToPdf);
    sliceStartCss = sliceEndCss;
    pageIndex += 1;
  }

  slicesPdf[slicesPdf.length - 1] = imgHeightPdf;
  return slicesPdf;
}

export async function exportElementToMultiPagePdf(
  element: HTMLElement,
  options: MultiPagePdfExportOptions,
): Promise<void> {
  const {
    fileName,
    title,
    subtitle,
    rootSelector = "[data-export-root]",
    margin = 32,
    headerHeight = 56,
  } = options;

  const captureWidth = Math.max(element.scrollWidth, element.clientWidth);
  let captureHeight = Math.max(element.scrollHeight, element.clientHeight);
  let avoidBreakRects: ContentRect[] = [];

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  const canvas = await html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: 2,
    width: captureWidth,
    height: captureHeight,
    windowWidth: captureWidth,
    windowHeight: captureHeight,
    scrollX: 0,
    scrollY: 0,
    useCORS: true,
    onclone: (clonedDocument) => {
      sanitizeOklchColorsInClone(clonedDocument, rootSelector);
      const clonedRoot = clonedDocument.querySelector(rootSelector);
      if (clonedRoot instanceof HTMLElement) {
        avoidBreakRects = collectLeafAvoidBreakRects(clonedRoot);
        captureHeight = Math.max(
          clonedRoot.scrollHeight,
          clonedRoot.clientHeight,
          captureHeight,
        );
      }
    },
  });

  if (avoidBreakRects.length === 0) {
    avoidBreakRects = collectLeafAvoidBreakRects(element);
  }

  const pdf = new jsPDF({
    unit: "pt",
    format: "a4",
    orientation: "portrait",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const ratio = canvas.width / contentWidth;
  const imgHeight = canvas.height / ratio;
  const imgData = canvas.toDataURL("image/png");

  pdf.setFillColor(16, 185, 129);
  pdf.rect(0, 0, pageWidth, headerHeight, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(title, margin, 22);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  if (subtitle) {
    pdf.text(subtitle, margin, 38);
  }

  const headerOffset = headerHeight + 16;
  const firstPageContent = pageHeight - headerOffset - margin - PDF_FOOTER_RESERVE;
  const nextPageContent = pageHeight - margin * 2 - PDF_FOOTER_RESERVE;
  const sliceOffsets = buildImageSliceOffsets(
    captureHeight,
    imgHeight,
    avoidBreakRects,
    firstPageContent,
    nextPageContent,
  );

  for (let pageIndex = 0; pageIndex < sliceOffsets.length - 1; pageIndex += 1) {
    if (pageIndex > 0) {
      pdf.addPage();
    }

    const imageOffset = sliceOffsets[pageIndex];
    const yPosition =
      pageIndex === 0 ? headerOffset - imageOffset : margin - imageOffset;

    pdf.addImage(
      imgData,
      "PNG",
      margin,
      yPosition,
      contentWidth,
      imgHeight,
      undefined,
      "FAST",
    );
  }

  const totalPages = pdf.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setTextColor(120, 120, 120);
    pdf.setFontSize(8);
    pdf.text(
      `Page ${page} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 14,
      { align: "right" },
    );
    pdf.text("GreenPoint", margin, pageHeight - 14);
  }

  pdf.save(fileName);
}
