// app/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;

import ClientRoot from "./ClientRoot";

export default function Page() {
  return <ClientRoot />;
}

