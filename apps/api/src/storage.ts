import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { imageSize } from 'image-size';
import { config } from './config.js';
import { AppError } from './http.js';

const TYPES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/png', ext: 'png', test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/gif', ext: 'gif', test: (b) => b.subarray(0, 4).toString('latin1') === 'GIF8' },
  { mime: 'image/webp', ext: 'webp', test: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
];

export interface StoredImage { storageKey: string; url: string; mimeType: string; sizeBytes: number; width: number | null; height: number | null; checksum: string }

/** Type is decided from the file's bytes, never from the client's file name or Content-Type. SVG is refused (script risk). */
export async function saveImage(buf: Buffer, supplierId: string): Promise<StoredImage> {
  if (buf.length === 0) throw new AppError(422, 'The file is empty');
  if (buf.length > config.MAX_UPLOAD_MB * 1024 * 1024) throw new AppError(413, `Images can be at most ${config.MAX_UPLOAD_MB} MB`);
  const t = TYPES.find((x) => x.test(buf));
  if (!t) throw new AppError(415, 'Only JPEG, PNG, WebP and GIF images are allowed');
  let width: number | null = null, height: number | null = null;
  try { const d = imageSize(buf); width = d.width ?? null; height = d.height ?? null; } catch { throw new AppError(422, 'The image file is damaged'); }
  if ((width ?? 0) > 12000 || (height ?? 0) > 12000) throw new AppError(422, 'Image dimensions are too large');
  const storageKey = `${supplierId}/${crypto.randomUUID()}.${t.ext}`;
  const checksum = crypto.createHash('sha256').update(buf).digest('hex');
  let url: string;
  if (config.STORAGE_DRIVER === 's3') {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const c = new S3Client({ region: config.S3_REGION, endpoint: config.S3_ENDPOINT || undefined, forcePathStyle: !!config.S3_ENDPOINT,
      credentials: config.S3_ACCESS_KEY ? { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY ?? '' } : undefined });
    await c.send(new PutObjectCommand({ Bucket: config.S3_BUCKET!, Key: storageKey, Body: buf, ContentType: t.mime, CacheControl: 'public, max-age=31536000, immutable' }));
    url = `${(config.S3_PUBLIC_URL ?? '').replace(/\/$/, '')}/${storageKey}`;
  } else {
    const file = path.join(path.resolve(config.UPLOAD_DIR), storageKey);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, buf);
    url = `${config.PUBLIC_UPLOAD_URL.replace(/\/$/, '')}/${storageKey}`;
  }
  return { storageKey, url, mimeType: t.mime, sizeBytes: buf.length, width, height, checksum };
}
