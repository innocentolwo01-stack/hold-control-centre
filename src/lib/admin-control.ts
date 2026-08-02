import { supabase } from '@/lib/supabase';

export async function invokeAdmin<T = Record<string, unknown>>(
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    'admin-control',
    { body },
  );

  if (error) {
    throw new Error(error.message);
  }

  const response = (data ?? {}) as Record<string, unknown>;

  if (response.error) {
    const detail =
      typeof response.detail === 'string'
        ? response.detail
        : typeof response.error === 'string'
          ? response.error
          : 'The administrator action failed.';

    throw new Error(detail);
  }

  return response as T;
}
