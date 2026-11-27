import { useEffect, useState } from 'react';
import { Shell, Card, Avatar, Notice, Confirm, useAction } from '../ui';
import { nameOf, formatCode, inviteLink, takePendingInvite, setPendingInvite } from '../config';
import { rpc } from '../client';

const RELATION_TEXT = {
  self: 'That’s you.',
  friend: 'Already friends.',
  requested: 'Request sent — waiting for them.',
  incoming: 'They’ve asked you — accept below.',
};

/**
 * Friends: a lightweight list, not a social network. People are added by their
 * exact username or an invite code; there is no search, no suggestions and no
 * profile to browse. Being friends shows a name — nothing else — until the two
 * of you agree to start a Journey.
 */
export default function Friends({ j, go }) {
  const { snap, client } = j;
  const me = snap.me;
  const [query, setQuery] = useState('');
  const [found, setFound] = useState(null);       // { username, display_name, relation } | 'none'
  const [code, setCode] = useState('');
  const [fromLink, setFromLink] = useState(null); // an invite code that arrived in a link
  const [confirm, setConfirm] = useState(null);
  const [copied, setCopied] = useState(false);
  const [busy, error, run, setError] = useAction();

  // An invite link opened earlier: say whose it is and ask before sending.
  useEffect(() => {
    const pending = takePendingInvite();
    if (!pending) return;
    rpc(client, 'forge_lookup_invite', { p_code: pending })
      .then(person => setFromLink(person ? { ...person, code: pending } : { missing: true }))
      .catch(() => setFromLink({ missing: true }));
  }, [client]);

  const dismissLink = () => { setPendingInvite(null); setFromLink(null); };

  const find = () => run(async () => {
    const name = query.trim().replace(/^@/, '').toLowerCase();
    if (!name) return;
    const person = await rpc(client, 'forge_find_user', { p_username: name });
    setFound(person || 'none');
  });

  const request = (args) => run(async () => {
    const res = await j.act('forge_send_friend_request', args);
    return res;
  });

  const share = async () => {
    const link = inviteLink(me.invite_code);
    const text = `Add me on Forge: @${me.username} (invite code ${formatCode(me.invite_code)})`;
    try {
      if (navigator.share) { await navigator.share({ title: 'Forge', text, url: link }); return; }
    } catch { /* cancelled */ }
    try { await navigator.clipboard.writeText(`${text}\n${link}`); setCopied(true); setTimeout(() => setCopied(false), 2500); } catch {
      setError('Copy the code above to share it.');
    }
  };

  const openJourney = snap.journey;
  const incoming = snap.incoming_requests || [];
  const outgoing = snap.outgoing_requests || [];
  const friends = snap.friends || [];
  const inJourneyWith = (uid) => openJourney?.members?.some(m => m.user_id === uid);

  return (
    <Shell title="Friends" lede="Add people by their exact username or invite code. Friends see your name — nothing more — unless you start a Journey together."
      onBack={() => go('home')} testid="journey-friends">

      {fromLink && (
        <Card title="From an invite link" className="jr-ask" testid="journey-link-invite">
          {fromLink.missing ? (
            <>
              <p className="jr-text">That invite link has expired or was replaced.</p>
              <button type="button" className="btn btn-ghost btn-full" onClick={dismissLink}>OK</button>
            </>
          ) : fromLink.relation === 'none' ? (
            <>
              <p className="jr-text">Send a friend request to <strong>{nameOf(fromLink)}</strong> (@{fromLink.username})?</p>
              <div className="jr-actions">
                <button type="button" className="btn btn-primary" disabled={busy}
                  onClick={async () => { await request({ p_code: fromLink.code }); dismissLink(); }}>Send request</button>
                <button type="button" className="btn btn-ghost" onClick={dismissLink}>Not now</button>
              </div>
            </>
          ) : (
            <>
              <p className="jr-text"><strong>{nameOf(fromLink)}</strong>: {RELATION_TEXT[fromLink.relation]}</p>
              <button type="button" className="btn btn-ghost btn-full" onClick={dismissLink}>OK</button>
            </>
          )}
        </Card>
      )}

      {incoming.length > 0 && (
        <Card title="Asking to be friends" meta={`${incoming.length}`} testid="journey-incoming">
          <ul className="jr-list">
            {incoming.map(r => (
              <li key={r.id} className="jr-person">
                <Avatar person={r} size={36} />
                <span className="jr-person-name">{nameOf(r)}<span className="jr-person-sub">@{r.username}</span></span>
                <span className="jr-person-actions">
                  <button type="button" className="btn btn-primary jr-small" disabled={busy}
                    onClick={() => run(() => j.act('forge_respond_friend_request', { p_request: r.id, p_accept: true }))}>Accept</button>
                  <button type="button" className="btn btn-ghost jr-small" disabled={busy}
                    onClick={() => run(() => j.act('forge_respond_friend_request', { p_request: r.id, p_accept: false }))}>Decline</button>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Add a friend" testid="journey-add-friend">
        <form className="jr-inline-form" onSubmit={e => { e.preventDefault(); find(); }}>
          <div className="jr-at">
            <span aria-hidden="true">@</span>
            <input className="jr-input" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={20}
              placeholder="their username" aria-label="Username" value={query}
              onChange={e => { setQuery(e.target.value.toLowerCase().replace(/[^a-z0-9_@]/g, '')); setFound(null); }} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy || query.replace('@', '').length < 3}>Find</button>
        </form>
        {found === 'none' && <p className="jr-fine">No one has that exact username.</p>}
        {found && found !== 'none' && (
          <div className="jr-person jr-found" data-testid="journey-found">
            <Avatar person={found} size={36} />
            <span className="jr-person-name">{nameOf(found)}<span className="jr-person-sub">@{found.username}</span></span>
            {found.relation === 'none' ? (
              <button type="button" className="btn btn-primary jr-small" disabled={busy}
                onClick={async () => { const r = await request({ p_username: found.username }); if (r) setFound({ ...found, relation: r.status === 'accepted' ? 'friend' : 'requested' }); }}>
                Send request
              </button>
            ) : <span className="jr-person-sub">{RELATION_TEXT[found.relation]}</span>}
          </div>
        )}
        <form className="jr-inline-form" onSubmit={e => {
          e.preventDefault();
          run(async () => {
            const person = await rpc(client, 'forge_lookup_invite', { p_code: code });
            if (!person) throw new Error('That invite code isn’t valid. Check it with your friend.');
            setFromLink({ ...person, code });
            setCode('');
          });
        }}>
          <input className="jr-input" placeholder="Or an invite code" aria-label="Invite code" maxLength={11}
            value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^0-9A-F-]/g, ''))} />
          <button type="submit" className="btn btn-ghost" disabled={busy || code.replace('-', '').length < 10}>Use code</button>
        </form>
        <Notice text={error} />
      </Card>

      <Card title="Your invite" testid="journey-my-invite">
        <p className="jr-text">People can find you as <strong>@{me.username}</strong>, or with your code:</p>
        <div className="jr-code-box" data-testid="journey-my-code">{formatCode(me.invite_code)}</div>
        <div className="jr-actions">
          <button type="button" className="btn btn-primary" onClick={share}>{copied ? 'Copied' : 'Share invite'}</button>
          <button type="button" className="btn btn-ghost" onClick={() => setConfirm({ kind: 'rotate' })}>New code</button>
        </div>
        <p className="jr-fine">A code only lets someone ask to be your friend. You still choose whether to accept.</p>
      </Card>

      <Card title="Friends" meta={friends.length ? `${friends.length}` : null} testid="journey-friend-list">
        {friends.length === 0
          ? <p className="jr-empty">No friends yet.</p>
          : (
            <ul className="jr-list">
              {friends.map(f => (
                <li key={f.user_id} className="jr-person">
                  <Avatar person={f} size={36} />
                  <span className="jr-person-name">{nameOf(f)}<span className="jr-person-sub">@{f.username}{inJourneyWith(f.user_id) ? ' · in your Journey' : ''}</span></span>
                  <span className="jr-person-actions">
                    {!openJourney && (
                      <button type="button" className="btn btn-primary jr-small" disabled={busy}
                        onClick={() => setConfirm({ kind: 'journey', person: f })}>Start Journey</button>
                    )}
                    <button type="button" className="jr-link danger" onClick={() => setConfirm({ kind: 'remove', person: f })}>Remove</button>
                  </span>
                </li>
              ))}
            </ul>
          )}
      </Card>

      {outgoing.length > 0 && (
        <Card title="Requests you sent" testid="journey-outgoing">
          <ul className="jr-list">
            {outgoing.map(r => (
              <li key={r.id} className="jr-person">
                <Avatar person={r} size={36} />
                <span className="jr-person-name">{nameOf(r)}<span className="jr-person-sub">@{r.username} · waiting</span></span>
                <button type="button" className="jr-link" disabled={busy}
                  onClick={() => run(() => j.act('forge_cancel_friend_request', { p_request: r.id }))}>Cancel</button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {confirm?.kind === 'rotate' && (
        <Confirm title="Make a new invite code?" body="Links and codes you’ve already shared stop working. Your friends stay your friends."
          confirmLabel="New code" busy={busy} onCancel={() => setConfirm(null)}
          onConfirm={() => run(async () => { await j.act('forge_rotate_invite_code'); setConfirm(null); })} />
      )}
      {confirm?.kind === 'remove' && (
        <Confirm title={`Remove ${nameOf(confirm.person)}?`}
          body={inJourneyWith(confirm.person.user_id)
            ? `You’ll no longer be friends, and your Journey together ends for both of you — its goals, plans and check-ins are deleted. Your personal Forge data isn’t affected.`
            : `You’ll no longer be friends. They aren’t told; you just stop appearing in each other’s lists.`}
          confirmLabel="Remove" danger busy={busy} onCancel={() => setConfirm(null)}
          onConfirm={() => run(async () => { await j.act('forge_remove_friend', { p_user: confirm.person.user_id }); setConfirm(null); })} />
      )}
      {confirm?.kind === 'journey' && (
        <Confirm title={`Start a Journey with ${nameOf(confirm.person)}?`}
          body={`${nameOf(confirm.person)} will be asked to agree. Nothing is shared until they do.`}
          confirmLabel="Send invitation" busy={busy} onCancel={() => setConfirm(null)}
          onConfirm={() => run(async () => { await j.act('forge_invite_to_journey', { p_friend: confirm.person.user_id }); setConfirm(null); go('home'); })} />
      )}
    </Shell>
  );
}
