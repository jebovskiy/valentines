import { test } from 'node:test';
import assert from 'node:assert/strict';

import { visibleDateSessionForUser, type DateSessionRow } from '../src/services/dates';

const USER_A = 111;
const USER_B = 222;

function session(overrides: Partial<DateSessionRow> = {}): DateSessionRow {
  return {
    id: 'session-1',
    pair_id: 'pair-1',
    initiator_id: USER_A,
    params: {},
    places: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
    status: 'active',
    match: null,
    dismissed_by: [],
    created_at: '2026-10-01T10:00:00.000Z',
    updated_at: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

test('dates: no session at all -> nothing to show', () => {
  assert.equal(visibleDateSessionForUser(null, USER_A), null);
});

test('dates: an active session stays resumable for both partners', () => {
  const s = session();
  assert.equal(visibleDateSessionForUser(s, USER_A), s);
  assert.equal(visibleDateSessionForUser(s, USER_B), s);
});

test('dates: a finished session is still visible to the partner who has not closed it', () => {
  const s = session({ status: 'done', match: { matched: true, index: 0 } });
  assert.equal(visibleDateSessionForUser(s, USER_A), s);
  assert.equal(visibleDateSessionForUser(s, USER_B), s);
});

test('dates: a session dismissed by the partner is hidden for that user only', () => {
  const s = session({ status: 'done', match: { matched: true, index: 0 }, dismissed_by: [USER_A] });
  assert.equal(visibleDateSessionForUser(s, USER_A), null, 'the user who closed the result must not see it again');
  assert.equal(visibleDateSessionForUser(s, USER_B), s, 'the other partner has not seen it yet');
});

test('dates: once both partners closed the result it is gone for both', () => {
  const s = session({ status: 'done', dismissed_by: [USER_A, USER_B] });
  assert.equal(visibleDateSessionForUser(s, USER_A), null);
  assert.equal(visibleDateSessionForUser(s, USER_B), null);
});

test('dates: dismissal never hides an active session', () => {
  const s = session({ dismissed_by: [USER_A, USER_B] });
  assert.equal(visibleDateSessionForUser(s, USER_A), s);
  assert.equal(visibleDateSessionForUser(s, USER_B), s);
});

test('dates: a session without acknowledgements is treated as unseen', () => {
  const s = session({ status: 'done', dismissed_by: undefined as unknown as number[] });
  assert.equal(visibleDateSessionForUser(s, USER_A), s);
});
