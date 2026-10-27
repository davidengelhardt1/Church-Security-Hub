-- Applied to the live project as migration "harden_subscriptions_and_grants".
-- Run this on an existing database that was created from an older schema.sql.

-- 1. A subscription's email must be the signed-in user's own email.
drop policy "select own subscription" on public.subscriptions;
drop policy "insert own subscription" on public.subscriptions;
drop policy "update own subscription" on public.subscriptions;
drop policy "delete own subscription" on public.subscriptions;

create policy "select own subscription" on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "insert own subscription" on public.subscriptions
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and lower(email) = lower((select auth.jwt() ->> 'email'))
  );

create policy "update own subscription" on public.subscriptions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and lower(email) = lower((select auth.jwt() ->> 'email'))
  );

create policy "delete own subscription" on public.subscriptions
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 2. Least privilege.
revoke all on table public.incidents from anon, authenticated;
revoke all on table public.subscriptions from anon;
revoke truncate, references, trigger on table public.subscriptions from authenticated;
