import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import ReportClient from './ReportClient';

export const dynamic = 'force-dynamic';

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getSupabaseAdmin();

  const { data: session } = await supabase
    .from('homepage_audit_sessions')
    .select('id, report_content, created_at, homepage_url')
    .eq('id', id)
    .single();

  if (!session || !session.report_content) notFound();

  return (
    <ReportClient
      report={session.report_content}
      createdAt={session.created_at}
      homepageUrl={session.homepage_url ?? null}
    />
  );
}
