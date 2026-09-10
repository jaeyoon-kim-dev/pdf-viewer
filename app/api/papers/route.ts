import { database, files } from '@/db';
import { json, mutationGuard } from '@/lib/server';
export async function POST(request: Request) {
  const rejected = mutationGuard(request);
  if (rejected) return rejected;
  const max = 40 * 1024 * 1024;
  if (Number(request.headers.get('content-length')) > max + 65536)
    return json({ error: 'PDFs must be under 40 MB.' }, 413);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'Upload a PDF file.' }, 400);
  }
  const file = form.get('file');
  if (!(file instanceof File) || file.size > max || file.size < 5)
    return json({ error: 'Choose a PDF under 40 MB.' }, 400);
  const header = new TextDecoder().decode(
    await file.slice(0, 1024).arrayBuffer(),
  );
  if (!header.includes('%PDF-'))
    return json({ error: 'This file is not a PDF.' }, 400);
  const pages = Number(form.get('pages'));
  if (!Number.isInteger(pages) || pages < 1 || pages > 10000)
    return json({ error: 'The PDF page count is invalid.' }, 400);
  const id = crypto.randomUUID();
  const suppliedTitle = form.get('title');
  const title = (
    typeof suppliedTitle === 'string' && suppliedTitle.trim()
      ? suppliedTitle
      : file.name.replace(/\.pdf$/i, '')
  ).slice(0, 300);
  const paper = {
    id,
    title,
    filename: file.name.slice(0, 300),
    pages,
    bytes: file.size,
    createdAt: new Date().toISOString(),
    tags: [],
  };
  await files().put(`${id}.pdf`, file.stream(), {
    httpMetadata: { contentType: 'application/pdf' },
  });
  try {
    await database()
      .prepare(
        'INSERT INTO papers (id,title,filename,pages,bytes,created_at) VALUES (?,?,?,?,?,?)',
      )
      .bind(id, paper.title, paper.filename, pages, file.size, paper.createdAt)
      .run();
  } catch (e) {
    await files().delete(`${id}.pdf`);
    throw e;
  }
  return json(paper, 201);
}
