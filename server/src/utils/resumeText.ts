import { PDFParse } from 'pdf-parse';
import { HttpError } from './httpError';

const MAX_CHARS = 20_000;

/** Plain text from a PDF or TXT resume. Other formats (DOC/DOCX) are rejected with 400. */
export const extractResumeText = async (buffer: Buffer, mimeType: string): Promise<string> => {
  let text: string;
  if (mimeType === 'application/pdf') {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      text = (await parser.getText()).text;
    } catch {
      throw new HttpError(400, 'Could not read that PDF');
    } finally {
      await parser.destroy();
    }
  } else if (mimeType === 'text/plain') {
    text = buffer.toString('utf8');
  } else {
    throw new HttpError(400, 'Resume analysis needs a PDF or TXT file');
  }
  // pdf-parse separates pages with "-- 1 of 2 --" markers.
  text = text.replace(/-- \d+ of \d+ --/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_CHARS);
  if (text.length < 50) throw new HttpError(400, 'Not enough text found in the resume (is it a scanned image?)');
  return text;
};
