export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="container mx-auto p-8">
      <h1 className="text-2xl font-semibold">Company Detail</h1>
      <p className="text-sm text-muted-foreground mt-2">
        Block 1 scaffold — company {id} will render here.
      </p>
    </main>
  );
}