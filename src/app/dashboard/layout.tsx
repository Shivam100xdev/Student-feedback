import { ReactNode } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return (
      <div className="container mx-auto py-12 px-4 text-center">
        <p className="text-muted-foreground mb-4">Please sign in to access the dashboard.</p>
        <a href="/auth/signin?callbackUrl=/dashboard" className="px-4 py-2 bg-primary text-white rounded-lg">
          Sign In
        </a>
      </div>
    );
  }

  return <>{children}</>;
}
