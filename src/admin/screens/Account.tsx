import { FormEvent, useEffect, useState } from 'react';
import { KeyRound, Plus, Trash2, UserPlus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { fieldBase, Label, Select } from '@/lib/ui';
import * as api from '../adminApi';
import { useAuth } from '../auth';
import type { AdminUser } from '../types';
import {
  btnDanger,
  btnGhost,
  btnGold,
  fullDate,
  glassCard,
  HUES,
  initialsOf,
  Medallion,
  PageEnter,
  PageHeader,
  Skeleton,
  useConfirm,
  useToast,
  Working,
} from '../ui';

const MIN_PASSWORD = 12;

export default function Account() {
  const { user, authed, adoptSession } = useAuth();
  const { push } = useToast();
  const { confirm, dialog } = useConfirm();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const isOwner = user?.role === 'owner';
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite] = useState({
    name: '',
    email: '',
    password: '',
    role: 'staff' as 'staff' | 'owner',
  });
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!isOwner) return;
    let live = true;
    authed((t) => api.listUsers(t))
      .then((list) => live && setUsers(list))
      .catch(() => live && setUsers([]));
    return () => {
      live = false;
    };
  }, [isOwner, authed]);

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (savingPassword) return;
    if (next.length < MIN_PASSWORD) {
      push({ tone: 'error', title: `New password must be at least ${MIN_PASSWORD} characters` });
      return;
    }
    if (next !== confirmPassword) {
      push({ tone: 'error', title: 'The two new passwords don’t match' });
      return;
    }
    setSavingPassword(true);
    try {
      const res = await authed((t) => api.changePassword(t, current, next));
      // Every other signed-in session is now dead; this tab keeps working
      // because the server issued a fresh token after the cut-off.
      if (res?.token) adoptSession(res.token, res.user ?? null);
      setCurrent('');
      setNext('');
      setConfirmPassword('');
      push({
        tone: 'success',
        title: 'Password changed',
        body: 'Any other device that was signed in has been signed out.',
      });
    } catch (err) {
      push({
        tone: 'error',
        title: 'Couldn’t change your password',
        body: err instanceof api.ApiError ? err.message : 'Please try again.',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const submitInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (inviting) return;
    setInviting(true);
    try {
      const created = await authed((t) =>
        api.createUser(t, {
          email: invite.email.trim().toLowerCase(),
          name: invite.name.trim(),
          password: invite.password,
          role: invite.role,
        }),
      );
      setUsers((list) => [...(list ?? []), created]);
      setInvite({ name: '', email: '', password: '', role: 'staff' });
      setShowInvite(false);
      push({
        tone: 'success',
        title: `${created.name || created.email} can now sign in`,
        body: 'Share the password with them privately and ask them to change it.',
      });
    } catch (err) {
      push({
        tone: 'error',
        title: 'Couldn’t create that account',
        body: err instanceof api.ApiError ? err.message : 'Please try again.',
      });
    } finally {
      setInviting(false);
    }
  };

  const removeUser = async (target: AdminUser) => {
    const snapshot = users ?? [];
    setUsers((list) => (list ?? []).filter((u) => u.id !== target.id));
    try {
      await authed((t) => api.deleteUser(t, target.id));
      push({ tone: 'info', title: 'Account removed' });
    } catch (err) {
      setUsers(snapshot);
      push({
        tone: 'error',
        title: 'Couldn’t remove that account',
        body: err instanceof api.ApiError ? err.message : 'Nothing was changed.',
      });
    }
  };

  return (
    <PageEnter>
      <PageHeader
        eyebrow="Your account"
        hue="gold"
        title={
          <>
            Account &amp; <span className="brand-gradient-text-bright">access</span>
          </>
        }
        sub={user?.email}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={glassCard}>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-gold-bright/15 text-gold-bright ring-1 ring-gold-bright/30">
              <KeyRound size={18} />
            </span>
            <h2 className="text-[15px] font-bold text-text-light">Change password</h2>
          </div>

          <form onSubmit={submitPassword} noValidate className="mt-5 space-y-4">
            <div>
              <Label htmlFor="pw-current" required>
                Current password
              </Label>
              <input
                id="pw-current"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className={fieldBase}
              />
            </div>
            <div>
              <Label htmlFor="pw-next" required>
                New password
              </Label>
              <input
                id="pw-next"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                className={fieldBase}
              />
              <p className="mt-1.5 text-xs text-text-light/65">
                At least {MIN_PASSWORD} characters. A short phrase you can remember beats a short
                jumble.
              </p>
            </div>
            <div>
              <Label htmlFor="pw-confirm" required>
                Repeat new password
              </Label>
              <input
                id="pw-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={fieldBase}
              />
            </div>
            <button type="submit" disabled={savingPassword} className={cn(btnGold, 'w-full')}>
              {savingPassword ? <Working label="Saving…" /> : 'Change password'}
            </button>
          </form>
        </section>

        {isOwner && (
          <section className={glassCard}>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-teal-bright/15 text-teal-bright ring-1 ring-teal-bright/30">
                <UserPlus size={18} />
              </span>
              <h2 className="text-[15px] font-bold text-text-light">Who can sign in</h2>
              <button
                type="button"
                onClick={() => setShowInvite((v) => !v)}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-text-light ring-1 ring-white/20 transition hover:bg-white/20"
              >
                <Plus size={14} />
                Add
              </button>
            </div>

            {showInvite && (
              <form onSubmit={submitInvite} noValidate className="mt-5 space-y-3.5">
                <div>
                  <Label htmlFor="u-name">Name</Label>
                  <input
                    id="u-name"
                    value={invite.name}
                    onChange={(e) => setInvite((v) => ({ ...v, name: e.target.value }))}
                    className={fieldBase}
                  />
                </div>
                <div>
                  <Label htmlFor="u-email" required>
                    Email
                  </Label>
                  <input
                    id="u-email"
                    type="email"
                    value={invite.email}
                    onChange={(e) => setInvite((v) => ({ ...v, email: e.target.value }))}
                    className={fieldBase}
                  />
                </div>
                <div>
                  <Label htmlFor="u-password" required>
                    Temporary password
                  </Label>
                  <input
                    id="u-password"
                    type="text"
                    autoComplete="off"
                    value={invite.password}
                    onChange={(e) => setInvite((v) => ({ ...v, password: e.target.value }))}
                    className={fieldBase}
                  />
                  <p className="mt-1.5 text-xs text-text-light/65">
                    At least {MIN_PASSWORD} characters. Share it privately — they can change it from
                    this screen.
                  </p>
                </div>
                <div>
                  <Label htmlFor="u-role">Role</Label>
                  <Select
                    id="u-role"
                    value={invite.role}
                    onChange={(v) => setInvite((s) => ({ ...s, role: v as 'staff' | 'owner' }))}
                  >
                    <option value="staff">Staff — everything except accounts</option>
                    <option value="owner">Owner — full access</option>
                  </Select>
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setShowInvite(false)} className={btnGhost}>
                    Cancel
                  </button>
                  <button type="submit" disabled={inviting} className={btnGold}>
                    {inviting ? <Working label="Creating…" /> : 'Create account'}
                  </button>
                </div>
              </form>
            )}

            <div className="mt-5 space-y-2">
              {users === null ? (
                <>
                  <Skeleton className="h-14" />
                  <Skeleton className="h-14" />
                </>
              ) : (
                users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 rounded-2xl bg-white/[0.05] px-4 py-3 ring-1 ring-white/10"
                  >
                    <Medallion
                      label={initialsOf(u.name || u.email)}
                      gradient={HUES[u.role === 'owner' ? 'gold' : 'teal'].gradient}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-text-light">
                        {u.name || u.email}
                        {u.id === user?.id && (
                          <span className="ml-2 text-xs font-normal text-text-light/65">you</span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-text-light/65">
                        {u.role === 'owner' ? 'Owner' : 'Staff'}
                        {u.lastLoginAt ? ` · last signed in ${fullDate(u.lastLoginAt)}` : ''}
                      </span>
                    </span>
                    {u.id !== user?.id && (
                      <button
                        type="button"
                        aria-label={`Remove ${u.email}`}
                        onClick={() =>
                          confirm({
                            title: 'Remove this account?',
                            body: (
                              <>
                                <strong className="text-text-light">{u.email}</strong> will lose
                                access the next time they sign in. If they are signed in right
                                now, their session can last up to 12 hours.
                              </>
                            ),
                            confirmLabel: 'Remove account',
                            onConfirm: () => removeUser(u),
                          })
                        }
                        className={cn(btnDanger, 'px-3 py-2')}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </div>

      {dialog}
    </PageEnter>
  );
}
