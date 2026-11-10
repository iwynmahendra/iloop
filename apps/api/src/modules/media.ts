import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { config } from '../config.js';
import { withDb } from '../db.js';
import { AppError, badRequest, notFound, ok } from '../http.js';
import { auditCtx, writeAudit } from '../crud/audit.js';
import { idParam, writeSupplier } from '../crud/core.js';
import { saveImage } from '../storage.js';
import { resources } from '../crud/resources.generated.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024, files: 10 } });
const def = resources.find((r) => r.name === 'MediaAsset')!;

/** Mounted BEFORE the generic CRUD router so media can only be created by upload, and only alt text / folder can be edited. */
export const mediaRouter = Router();

mediaRouter.post('/upload', upload.array('files', 10), async (req, res) => {
  const s = req.scope!;
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) throw badRequest('Attach one or more images in the "files" field');
  const meta = z.object({ altText: z.string().max(255).optional(), folder: z.string().max(120).optional() }).parse(req.body ?? {});
  const supplierId = (await writeSupplier(def, s))!;
  const saved = await Promise.all(files.map((f) => saveImage(f.buffer, supplierId).then((img) => ({ img, name: f.originalname }))));
  const rows = await withDb(s.db, async (tx) => {
    const out = [];
    for (const { img, name } of saved) {
      const row = await tx.mediaAsset.create({ data: { supplierId, ...img, sizeBytes: BigInt(img.sizeBytes), originalName: name.slice(0, 255), altText: meta.altText ?? null, folder: meta.folder ?? null, createdBy: s.userId, updatedBy: s.userId } });
      await writeAudit(tx, { action: 'CREATE', entityType: 'MediaAsset', entityId: row.id, supplierId, after: row, ...auditCtx(req) });
      out.push(row);
    }
    return out;
  });
  ok(res, rows, 'Uploaded', undefined, 201);
});

mediaRouter.post('/', () => { throw new AppError(405, 'Upload images with POST /shared/media-assets/upload'); });
mediaRouter.post('/import', () => { throw new AppError(405, 'Import is not available for media'); });
mediaRouter.put('/:id', () => { throw new AppError(405, 'Use PATCH'); });
mediaRouter.patch('/:id', async (req, res) => {
  const s = req.scope!, id = idParam(req);
  const body = z.object({ altText: z.string().max(255).nullish(), folder: z.string().max(120).nullish() }).strict().parse(req.body);
  const row = await withDb(s.db, async (tx) => {
    const before = await tx.mediaAsset.findFirst({ where: { id, deletedAt: null, ...(s.supplierId ? { supplierId: s.supplierId } : {}) } });
    if (!before) throw notFound();
    const after = await tx.mediaAsset.update({ where: { id }, data: { ...body, updatedBy: s.userId } });
    await writeAudit(tx, { action: 'UPDATE', entityType: 'MediaAsset', entityId: id, supplierId: before.supplierId, before, after, ...auditCtx(req) });
    return after;
  });
  ok(res, row, 'Updated');
});
