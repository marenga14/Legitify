import { bytesToHex, type Hex } from "viem";

const MAX_BYTES = 15 * 1024 * 1024;
const QR_POINTS = 64;
const MARGIN = 16;

export const STATUS_LABELS: Record<string, string> = {
  pending: "Not published", authentic: "Issued", revoked: "Revoked", replaced: "Replaced", suspended: "Issuer suspended",
};
export const shortId = (id: string) => `${id.slice(0, 10)}…${id.slice(-6)}`;
export const longDate = (d: string) => new Date(d).toLocaleDateString(undefined, { dateStyle: "full" });
export const newCredentialId = (): Hex => bytesToHex(crypto.getRandomValues(new Uint8Array(32)));

/**
 * Adds a QR code to the last page pointing at the certificate's public record. The stamped file
 * is what gets fingerprinted, so it's also the exact copy a holder must present to verify.
 */
export async function stampCertificate(file: File, credentialId: Hex): Promise<File> {
  if (file.size > MAX_BYTES) throw new Error("Files can be up to 15 MB.");
  // Large, and only staff creating a certificate need them.
  const [{ PDFDocument, rgb }, { default: QRCode }] = await Promise.all([import("pdf-lib"), import("qrcode")]);
  let pdf: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    pdf = await PDFDocument.load(await file.arrayBuffer());
  } catch {
    throw new Error("This PDF can't be stamped. Check it isn't password-protected or damaged.");
  }
  const png = await QRCode.toDataURL(`${location.origin}/v/${credentialId}`, { margin: 1, width: 256 });
  const qr = await pdf.embedPng(png);
  const page = pdf.getPages().at(-1)!;
  const x = page.getWidth() - QR_POINTS - MARGIN;
  page.drawRectangle({ x: x - 2, y: MARGIN - 2, width: QR_POINTS + 4, height: QR_POINTS + 4, color: rgb(1, 1, 1) });
  page.drawImage(qr, { x, y: MARGIN, width: QR_POINTS, height: QR_POINTS });
  return new File([(await pdf.save()) as BlobPart], file.name, { type: "application/pdf" });
}
