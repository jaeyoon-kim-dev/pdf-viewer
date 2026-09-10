type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute(input: unknown): unknown;
};
type Context = {
  registerTool(
    tool: Tool,
    options: { signal: AbortSignal },
  ): void | Promise<void>;
};
export function registerReaderTools(actions: {
  paperId: string;
  getPages(): number;
  navigate(page: number): void;
  addNote(page: number, note: string): Promise<string>;
}) {
  const context = (document as Document & { modelContext?: Context })
    .modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const page = (input: unknown) => {
    const p = (input as { page?: unknown } | null)?.page;
    if (
      typeof p !== 'number' ||
      !Number.isInteger(p) ||
      p < 1 ||
      p > actions.getPages()
    )
      throw new Error('Choose a valid page number in the open paper.');
    return p;
  };
  const tools: Tool[] = [
    {
      name: 'navigate_paper_page',
      description: 'Move the open paper to a page.',
      inputSchema: {
        type: 'object',
        properties: { page: { type: 'integer', minimum: 1 } },
        required: ['page'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const n = page(input);
        actions.navigate(n);
        return { paperId: actions.paperId, page: n };
      },
    },
    {
      name: 'create_paper_note',
      description:
        'Save a memo linked to a page in the open paper. May be pending synchronization while offline.',
      inputSchema: {
        type: 'object',
        properties: {
          page: { type: 'integer', minimum: 1 },
          note: { type: 'string', minLength: 1, maxLength: 30000 },
        },
        required: ['page', 'note'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      async execute(input) {
        const n = page(input);
        const note = (input as { note?: unknown }).note;
        if (typeof note !== 'string' || !note.trim() || note.length > 30000)
          throw new Error('Supply a nonempty note under 30,000 characters.');
        const id = await actions.addNote(n, note);
        return {
          id,
          paperId: actions.paperId,
          page: n,
          status: 'saved-locally',
        };
      },
    },
  ];
  for (const tool of tools) {
    try {
      void Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal }),
      ).catch(() => {});
    } catch {}
  }
  return () => lifecycle.abort();
}
