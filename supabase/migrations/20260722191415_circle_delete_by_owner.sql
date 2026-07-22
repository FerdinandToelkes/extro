-- Let a circle's owner delete it. `circles` had no delete policy at all, so
-- circles could be created but never removed. Child rows (circle_members,
-- activity/availability visibility) already cascade via ON DELETE CASCADE.
create policy "circles: delete by owner" on circles for delete to authenticated using (
  owner_id = auth.uid()
);
