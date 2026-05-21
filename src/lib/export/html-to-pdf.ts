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
const CAPTURE_SCALE = 2;
/** Stay below common browser canvas limits (area / edge length). */
const MAX_CANVAS_EDGE = 8192;
const MAX_CANVAS_AREA = 16_777_216;

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
export const EXPORT_SECTION_ATTR = "data-export-section";
export const EXPORT_GROUP_TITLE_ATTR = "data-export-group-title";

const SLICE_SNAP_BUFFER = 4;

/** Reset hidden/off-screen styles on the html2canvas clone so layout renders in-viewport. */
function prepareCloneForCapture(clonedDocument: Document, rootSelector: string) {
  const clonedRoot = clonedDocument.querySelector(rootSelector);
  if (!(clonedRoot instanceof HTMLElement)) return;

  clonedDocument.documentElement.style.margin = "0";
  clonedDocument.documentElement.style.padding = "0";
  clonedDocument.body.style.margin = "0";
  clonedDocument.body.style.padding = "0";
  clonedDocument.body.style.background = "#ffffff";

  let node: HTMLElement | null = clonedRoot;
  while (node && node !== clonedDocument.documentElement) {
    node.style.opacity = "1";
    node.style.visibility = "visible";
    node.style.transform = "none";
    node.style.clipPath = "none";
    node.style.clip = "auto";

    const position = clonedDocument.defaultView
      ?.getComputedStyle(node)
      .position;
    if (position === "fixed" || position === "absolute") {
      node.style.position = "relative";
      node.style.left = "0";
      node.style.top = "0";
      node.style.right = "auto";
      node.style.bottom = "auto";
    }

    node = node.parentElement;
  }
}

function resolveCaptureScale(element: HTMLElement, preferredScale: number) {
  const contentHeight = Math.max(
    element.scrollHeight,
    element.clientHeight,
    element.offsetHeight,
    1,
  );
  const contentWidth = Math.max(
    element.scrollWidth,
    element.clientWidth,
    element.offsetWidth,
    1,
  );

  const byHeight = MAX_CANVAS_EDGE / contentHeight;
  const byWidth = MAX_CANVAS_EDGE / contentWidth;
  const byArea = Math.sqrt(MAX_CANVAS_AREA / (contentHeight * contentWidth));

  return Math.max(0.75, Math.min(preferredScale, byHeight, byWidth, byArea));
}

function assertValidCaptureCanvas(canvas: HTMLCanvasElement) {
  if (canvas.width < 1 || canvas.height < 1) {
    throw new Error(
      "Report capture failed: the document did not render. Try again after the timeline finishes loading.",
    );
  }
}

async function waitForLayout() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
}

/**
 * html2canvas skips zero-opacity nodes. Clone into a visible mount so layout paints.
 */
function createCaptureMount() {
  const mount = document.createElement("div");
  mount.setAttribute("data-export-capture-mount", "true");
  mount.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "z-index:-1",
    "pointer-events:none",
    "opacity:1",
    "visibility:visible",
    "overflow:visible",
  ].join(";");

  document.body.appendChild(mount);
  return mount;
}

function applyCaptureWidth(element: HTMLElement, width: number) {
  element.style.width = `${width}px`;
  element.style.maxWidth = `${width}px`;
  element.style.opacity = "1";
  element.style.visibility = "visible";
}

function elementHasLayout(element: HTMLElement) {
  const width = Math.max(
    element.scrollWidth,
    element.clientWidth,
    element.offsetWidth,
  );
  const height = Math.max(
    element.scrollHeight,
    element.clientHeight,
    element.offsetHeight,
  );
  return width >= 1 && height >= 1;
}

function mountCaptureClone(source: HTMLElement): {
  target: HTMLElement;
  cleanup: () => void;
} {
  const mount = createCaptureMount();
  const target = source.cloneNode(true) as HTMLElement;
  const width = Math.max(
    source.scrollWidth,
    source.clientWidth,
    source.offsetWidth,
    720,
  );
  applyCaptureWidth(target, width);
  mount.appendChild(target);

  return {
    target,
    cleanup: () => mount.remove(),
  };
}

/** Reparent the live node when a DOM clone does not pick up layout (e.g. hidden React host). */
function mountCaptureLive(source: HTMLElement): {
  target: HTMLElement;
  cleanup: () => void;
} {
  const mount = createCaptureMount();
  const parent = source.parentElement;
  const nextSibling = source.nextSibling;
  const placeholder = document.createComment("gp-export-placeholder");

  if (parent) {
    parent.insertBefore(placeholder, source);
  }

  const width = Math.max(
    source.scrollWidth,
    source.clientWidth,
    source.offsetWidth,
    720,
  );
  applyCaptureWidth(source, width);
  mount.appendChild(source);

  return {
    target: source,
    cleanup: () => {
      if (parent) {
        parent.insertBefore(source, nextSibling);
        parent.removeChild(placeholder);
      }
      mount.remove();
    },
  };
}

async function resolveCaptureTarget(source: HTMLElement): Promise<{
  target: HTMLElement;
  cleanup: () => void;
}> {
  const cloneMount = mountCaptureClone(source);
  await waitForLayout();

  if (elementHasLayout(cloneMount.target)) {
    return cloneMount;
  }

  cloneMount.cleanup();
  const liveMount = mountCaptureLive(source);
  await waitForLayout();

  if (!elementHasLayout(liveMount.target)) {
    liveMount.cleanup();
    throw new Error(
      "Report capture failed: the document has no measurable content.",
    );
  }

  return liveMount;
}

function assertMeasurableElement(element: HTMLElement) {
  if (!elementHasLayout(element)) {
    throw new Error(
      "Report capture failed: the document has no measurable content.",
    );
  }
}

interface PdfPageSlice {
  y: number;
  height: number;
  offset: number;
}

interface AvoidBreakRect {
  top: number;
  bottom: number;
  height: number;
}

interface TitleGroupRect {
  top: number;
  bottom: number;
  nextTop: number;
}

function toPdfRect(
  nodeRect: DOMRect,
  rootRect: DOMRect,
  pdfScale: number,
): AvoidBreakRect {
  const top = (nodeRect.top - rootRect.top) * pdfScale;
  const bottom = (nodeRect.bottom - rootRect.top) * pdfScale;
  return { top, bottom, height: bottom - top };
}

/** Section groups and standalone blocks; skip nested cards inside export sections. */
function collectAvoidBreakRects(
  root: HTMLElement,
  imgHeight: number,
): AvoidBreakRect[] {
  const contentHeight = Math.max(
    root.scrollHeight,
    root.offsetHeight,
    root.clientHeight,
    1,
  );
  const pdfScale = imgHeight / contentHeight;
  const rootRect = root.getBoundingClientRect();
  const attrSelector = `[${EXPORT_AVOID_BREAK_ATTR}]`;
  const rects: AvoidBreakRect[] = [];

  root.querySelectorAll(attrSelector).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;

    const sectionAncestor = node.closest(`[${EXPORT_SECTION_ATTR}]`);
    if (
      sectionAncestor &&
      sectionAncestor !== node &&
      !node.hasAttribute(EXPORT_SECTION_ATTR)
    ) {
      return;
    }

    const nodeRect = node.getBoundingClientRect();
    rects.push(toPdfRect(nodeRect, rootRect, pdfScale));
  });

  return rects
    .filter((rect) => rect.height > 0)
    .sort((a, b) => a.top - b.top);
}

/** Prevent slice ends between a section title and the content that follows it. */
function collectTitleGroupRects(
  root: HTMLElement,
  imgHeight: number,
): TitleGroupRect[] {
  const contentHeight = Math.max(
    root.scrollHeight,
    root.offsetHeight,
    root.clientHeight,
    1,
  );
  const pdfScale = imgHeight / contentHeight;
  const rootRect = root.getBoundingClientRect();
  const groups: TitleGroupRect[] = [];

  root.querySelectorAll(`[${EXPORT_GROUP_TITLE_ATTR}]`).forEach((node) => {
    if (!(node instanceof HTMLElement)) return;

    const titleRect = node.getBoundingClientRect();
    let nextTop = titleRect.bottom - rootRect.top;

    let sibling = node.nextElementSibling;
    while (sibling) {
      if (sibling instanceof HTMLElement) {
        const siblingRect = sibling.getBoundingClientRect();
        if (siblingRect.height > 0) {
          nextTop = siblingRect.top - rootRect.top;
          break;
        }
      }
      sibling = sibling.nextElementSibling;
    }

    const top = (titleRect.top - rootRect.top) * pdfScale;
    const bottom = (titleRect.bottom - rootRect.top) * pdfScale;
    groups.push({
      top,
      bottom,
      nextTop: nextTop * pdfScale,
    });
  });

  return groups.filter((group) => group.nextTop > group.bottom);
}

function snapSliceEnd(
  sliceStart: number,
  proposedEnd: number,
  pageSlot: number,
  imgHeight: number,
  rects: AvoidBreakRect[],
  titleGroups: TitleGroupRect[],
): number {
  let end = Math.min(sliceStart + pageSlot, imgHeight);

  for (const rect of rects) {
    if (rect.bottom <= sliceStart + SLICE_SNAP_BUFFER) continue;
    if (rect.top >= end) break;

    const wouldSplitBlock =
      end > rect.top + SLICE_SNAP_BUFFER &&
      end < rect.bottom - SLICE_SNAP_BUFFER;
    const blockStartsOnSlice = rect.top >= sliceStart - SLICE_SNAP_BUFFER;

    if (wouldSplitBlock && blockStartsOnSlice) {
      end = Math.max(sliceStart, rect.top - SLICE_SNAP_BUFFER);
    }
  }

  for (const group of titleGroups) {
    if (group.bottom <= sliceStart + SLICE_SNAP_BUFFER) continue;
    if (group.top >= proposedEnd) break;

    const wouldSplitTitle =
      end > group.top + SLICE_SNAP_BUFFER &&
      end < group.bottom - SLICE_SNAP_BUFFER;
    const orphansTitleBeforeContent =
      end > group.bottom + SLICE_SNAP_BUFFER &&
      end < group.nextTop - SLICE_SNAP_BUFFER &&
      group.top >= sliceStart - SLICE_SNAP_BUFFER;

    if (wouldSplitTitle || orphansTitleBeforeContent) {
      end = Math.max(sliceStart, group.top - SLICE_SNAP_BUFFER);
    }
  }

  if (end <= sliceStart + 1) {
    const blocking = rects.find(
      (rect) =>
        rect.top >= sliceStart - SLICE_SNAP_BUFFER &&
        rect.top < proposedEnd &&
        rect.height <= pageSlot + SLICE_SNAP_BUFFER,
    );

    if (blocking) {
      return Math.min(sliceStart + pageSlot, blocking.bottom);
    }

    return proposedEnd;
  }

  return end;
}

function buildPageSlices(
  imgHeight: number,
  pageHeight: number,
  headerOffset: number,
  margin: number,
  footerReserve: number,
  avoidRects: AvoidBreakRect[],
  titleGroups: TitleGroupRect[],
): PdfPageSlice[] {
  const slices: PdfPageSlice[] = [];
  let offset = 0;
  let pageIndex = 0;
  let guard = 0;

  while (offset < imgHeight - 0.5 && guard < 500) {
    guard += 1;
    const y = pageIndex === 0 ? headerOffset : margin;
    const pageSlot =
      pageIndex === 0
        ? pageHeight - headerOffset - margin - footerReserve
        : pageHeight - margin * 2 - footerReserve;
    const proposedEnd = Math.min(offset + pageSlot, imgHeight);
    let sliceEnd = snapSliceEnd(
      offset,
      proposedEnd,
      pageSlot,
      imgHeight,
      avoidRects,
      titleGroups,
    );

    if (sliceEnd <= offset + 1) {
      sliceEnd = proposedEnd;
    }

    slices.push({
      y,
      height: sliceEnd - offset,
      offset,
    });
    offset = sliceEnd;
    pageIndex += 1;
  }

  return slices;
}

/** Crop the capture to one page slot so content is never duplicated across pages. */
function createPageSliceCanvas(
  source: HTMLCanvasElement,
  imgHeight: number,
  slice: PdfPageSlice,
): HTMLCanvasElement {
  const canvasY = (slice.offset / imgHeight) * source.height;
  const canvasH = (slice.height / imgHeight) * source.height;
  const sliceCanvas = document.createElement("canvas");
  sliceCanvas.width = source.width;
  sliceCanvas.height = Math.max(1, Math.round(canvasH));

  const ctx = sliceCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("Report capture failed: could not slice page image.");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
  ctx.drawImage(
    source,
    0,
    canvasY,
    source.width,
    canvasH,
    0,
    0,
    sliceCanvas.width,
    sliceCanvas.height,
  );

  return sliceCanvas;
}

function getPdfImageSource(canvas: HTMLCanvasElement): {
  source: string | HTMLCanvasElement;
  format: "PNG" | "JPEG";
} {
  try {
    const png = canvas.toDataURL("image/png");
    if (/^data:image\/png;base64,iVBORw0KGgo/.test(png)) {
      return { source: png, format: "PNG" };
    }
  } catch {
    // Fall through to JPEG / canvas.
  }

  try {
    const jpeg = canvas.toDataURL("image/jpeg", 0.92);
    if (/^data:image\/jpeg;base64,/.test(jpeg) && jpeg.length > 128) {
      return { source: jpeg, format: "JPEG" };
    }
  } catch {
    // Fall through to raw canvas.
  }

  return { source: canvas, format: "PNG" };
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

  const { target: captureElement, cleanup } = await resolveCaptureTarget(element);

  try {
    assertMeasurableElement(captureElement);

    const captureWidth = Math.max(
      captureElement.scrollWidth,
      captureElement.clientWidth,
      captureElement.offsetWidth,
      1,
    );
    const captureScale = resolveCaptureScale(captureElement, CAPTURE_SCALE);

    const canvas = await html2canvas(captureElement, {
      backgroundColor: "#ffffff",
      scale: captureScale,
      useCORS: true,
      logging: false,
      windowWidth: captureWidth,
      onclone: (clonedDocument) => {
        prepareCloneForCapture(clonedDocument, rootSelector);
        sanitizeOklchColorsInClone(clonedDocument, rootSelector);
      },
    });

    assertValidCaptureCanvas(canvas);

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
    const avoidRects = collectAvoidBreakRects(captureElement, imgHeight);
    const titleGroups = collectTitleGroupRects(captureElement, imgHeight);
    const pageSlices = buildPageSlices(
      imgHeight,
      pageHeight,
      headerOffset,
      margin,
      PDF_FOOTER_RESERVE,
      avoidRects,
      titleGroups,
    );

    pageSlices.forEach((slice, index) => {
      if (index > 0) {
        pdf.addPage();
      }

      const sliceCanvas = createPageSliceCanvas(canvas, imgHeight, slice);
      const { source: sliceImage, format: sliceFormat } =
        getPdfImageSource(sliceCanvas);

      pdf.addImage(
        sliceImage,
        sliceFormat,
        margin,
        slice.y,
        contentWidth,
        slice.height,
        undefined,
        "FAST",
      );
    });

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
  } finally {
    cleanup();
  }
}
