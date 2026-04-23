import type { Readable } from "node:stream";
import { createClient } from "@deepgram/sdk";
import { drive_v3 } from "googleapis";
import mammoth from "mammoth";
import pdfParse from "pdf-parse";
import { chunkByTokens, chunkVideoSegments, type VideoSegment } from "../ingest/chunk";
import type { DriveFile } from "./crawler";

export type SourceType = "pdf" | "video_transcript" | "docx";

export type ExtractedChunk = {
  text: string;
  chunkIndex: number;
  startMs?: number;
  endMs?: number;
  metadata?: Record<string, unknown>;
};

export type ExtractedDocument = {
  sourceType: SourceType;
  chunks: ExtractedChunk[];
};

async function downloadBuffer(
  drive: drive_v3.Drive,
  fileId: string
): Promise<Buffer> {
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data as ArrayBuffer);
}

async function downloadStream(
  drive: drive_v3.Drive,
  fileId: string
): Promise<Readable> {
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );
  return res.data as Readable;
}

export async function extractPdf(
  drive: drive_v3.Drive,
  file: DriveFile
): Promise<ExtractedDocument> {
  const buf = await downloadBuffer(drive, file.id);
  const parsed = await pdfParse(buf);
  const texts = chunkByTokens(parsed.text, {
    targetTokens: 300,
    maxTokens: 450,
    overlapTokens: 60,
  });
  return {
    sourceType: "pdf",
    chunks: texts.map((text, i) => ({
      text,
      chunkIndex: i,
      metadata: { pages: parsed.numpages },
    })),
  };
}

export async function extractDocx(
  drive: drive_v3.Drive,
  file: DriveFile
): Promise<ExtractedDocument> {
  const buf = await downloadBuffer(drive, file.id);
  const { value } = await mammoth.extractRawText({ buffer: buf });
  const texts = chunkByTokens(value, {
    targetTokens: 300,
    maxTokens: 450,
    overlapTokens: 60,
  });
  return {
    sourceType: "docx",
    chunks: texts.map((text, i) => ({ text, chunkIndex: i })),
  };
}

type DeepgramParagraph = {
  start: number;
  end: number;
  sentences: { text: string; start: number; end: number }[];
};

type DeepgramUtterance = {
  start: number;
  end: number;
  transcript: string;
};

export async function extractVideo(
  drive: drive_v3.Drive,
  file: DriveFile
): Promise<ExtractedDocument> {
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error("DEEPGRAM_API_KEY manquant");
  }
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  const stream = await downloadStream(drive, file.id);

  const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
    stream,
    {
      model: "nova-3-general",
      language: "fr",
      smart_format: true,
      paragraphs: true,
      punctuate: true,
      utterances: true,
    }
  );

  if (error) throw new Error(`Deepgram : ${error.message ?? String(error)}`);
  if (!result) throw new Error("Deepgram : résultat vide");

  const alt = result.results.channels[0]?.alternatives?.[0];
  if (!alt) throw new Error("Deepgram : aucune alternative de transcription");

  const paragraphs =
    ((alt as unknown as { paragraphs?: { paragraphs?: DeepgramParagraph[] } })
      .paragraphs?.paragraphs ?? []) as DeepgramParagraph[];
  const utterances = ((result.results as unknown as { utterances?: DeepgramUtterance[] })
    .utterances ?? []) as DeepgramUtterance[];

  const segments: VideoSegment[] = paragraphs.length
    ? paragraphs.map((p) => ({
        startS: p.start,
        endS: p.end,
        text: p.sentences.map((s) => s.text).join(" "),
      }))
    : utterances.map((u) => ({
        startS: u.start,
        endS: u.end,
        text: u.transcript,
      }));

  if (segments.length === 0) {
    const full = alt.transcript ?? "";
    if (!full.trim()) return { sourceType: "video_transcript", chunks: [] };
    return {
      sourceType: "video_transcript",
      chunks: [{ text: full, chunkIndex: 0, startMs: 0, endMs: 0 }],
    };
  }

  const videoChunks = chunkVideoSegments(segments, 30, 10);
  return {
    sourceType: "video_transcript",
    chunks: videoChunks.map((c, i) => ({
      text: c.text,
      chunkIndex: i,
      startMs: c.startMs,
      endMs: c.endMs,
    })),
  };
}
