import Reader from '@/components/reader';
export default async function PaperPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Reader paperId={id} />;
}
