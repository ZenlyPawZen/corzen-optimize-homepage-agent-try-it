import { redirect } from 'next/navigation';

const GATING_PAGE_URL = 'https://corzenhub.com/optimize-homepage-agent-try-it/';

export default function Home() {
  redirect(GATING_PAGE_URL);
}
