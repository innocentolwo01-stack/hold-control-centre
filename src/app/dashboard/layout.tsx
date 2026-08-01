'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';

import { DashboardShell } from '@/components/dashboard-shell';
import { Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';

type AccessState = 'checking' | 'granted' | 'denied';

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [access, setAccess] = useState<AccessState>('checking');

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (!session) {
        const next = encodeURIComponent(pathname || '/dashboard');
        router.replace(`/login?next=${next}`);
        return;
      }

      const { data, error } = await supabase
        .from('admin_memberships')
        .select('role,active')
        .eq('user_id', session.user.id)
        .eq('active', true)
        .maybeSingle();

      if (!active) return;

      if (error || !data) {
        setAccess('denied');
        return;
      }

      setAccess('granted');
    }

    void verifyAccess();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        const next = encodeURIComponent(pathname || '/dashboard');
        router.replace(`/login?next=${next}`);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (access === 'checking') {
    return (
      <div className="full-centre">
        <div className="spinner" aria-label="Checking administrator access" />
      </div>
    );
  }

  if (access === 'denied') {
    return (
      <div className="full-centre">
        <section className="access-denied">
          <h1>Administrator access required</h1>
          <p>
            This account does not have an active Hold Control Centre
            administrator membership.
          </p>

          <Button
            onClick={() =>
              void supabase.auth.signOut().then(() => router.replace('/login'))
            }
          >
            Return to sign in
          </Button>
        </section>
      </div>
    );
  }

  return <DashboardShell>{children}</DashboardShell>;
}
