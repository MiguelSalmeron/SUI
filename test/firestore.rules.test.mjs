import fs from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

let environment;

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: 'sui-rules-test',
    firestore: { rules: await fs.readFile('firestore.rules', 'utf8') },
  });
});

beforeEach(async () => environment.clearFirestore());
after(async () => environment.cleanup());

const registered = (uid) =>
  environment.authenticatedContext(uid, {
    firebase: { sign_in_provider: 'password' },
    email_verified: true,
  });
const unverified = (uid) =>
  environment.authenticatedContext(uid, {
    firebase: { sign_in_provider: 'password' },
    email_verified: false,
  });
const anonymous = (uid) =>
  environment.authenticatedContext(uid, {
    firebase: { sign_in_provider: 'anonymous' },
  });

const goalEnvelope = (id) => ({
  data: {
    id,
    title: 'Meta real',
    deadline: '2026-09-01',
    progress: 0,
    milestones: [],
    impactDays: ['2026-09-01'],
    completed: false,
    gravity: 'low',
    createdAt: '2026-08-27',
  },
  meta: {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    revision: 1,
    deviceId: 'device-1',
    fingerprint: 'fingerprint',
    lastMutationId: 'mutation-1',
  },
  serverUpdatedAt: serverTimestamp(),
});

const syncMetadata = (overrides = {}) => ({
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  revision: 1,
  deviceId: 'device-1',
  fingerprint: 'fingerprint',
  lastMutationId: 'mutation-1',
  ...overrides,
});

const productivityRootV8 = (meta = syncMetadata()) => ({
  schemaVersion: 8,
  productivity: {
    lastResetDate: null,
    streakCount: 2,
    lastCompletedDate: '2026-08-30',
    totalXp: 40,
    meta,
    serverUpdatedAt: serverTimestamp(),
  },
  updatedAt: serverTimestamp(),
});

test('registered owner writes valid entity', async () => {
  const db = registered('owner').firestore();
  await assertSucceeds(setDoc(doc(db, 'users/owner/goals/goal-1'), goalEnvelope('goal-1')));
});

test('anonymous guest cannot write productivity', async () => {
  const db = anonymous('guest').firestore();
  await assertFails(setDoc(doc(db, 'users/guest/goals/goal-1'), goalEnvelope('goal-1')));
});

test('unverified password account keeps productivity local', async () => {
  const db = unverified('pending-email').firestore();
  await assertFails(setDoc(doc(db, 'users/pending-email/goals/goal-1'), goalEnvelope('goal-1')));
});

test('cross-user access is denied', async () => {
  const ownerDb = registered('owner').firestore();
  await assertSucceeds(setDoc(doc(ownerDb, 'users/owner/goals/goal-1'), goalEnvelope('goal-1')));
  const attackerDb = registered('attacker').firestore();
  await assertFails(getDoc(doc(attackerDb, 'users/owner/goals/goal-1')));
});

test('invalid document and connection token access are denied', async () => {
  const db = registered('owner').firestore();
  await assertFails(setDoc(doc(db, 'users/owner/goals/wrong-id'), goalEnvelope('goal-1')));
  await assertFails(getDoc(doc(db, 'users/owner/connections/google_calendar')));
});

test('legacy v7 root remains readable and writable', async () => {
  const db = registered('owner').firestore();
  await assertSucceeds(
    setDoc(doc(db, 'users/owner'), {
      schemaVersion: 7,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(getDoc(doc(db, 'users/owner')));
});

test('v8 root accepts validated summary metadata', async () => {
  const db = registered('owner').firestore();
  await assertSucceeds(setDoc(doc(db, 'users/owner'), productivityRootV8()));
});

test('v8 root rejects invalid summary metadata', async () => {
  const db = registered('owner').firestore();
  await assertFails(
    setDoc(doc(db, 'users/owner'), productivityRootV8(syncMetadata({ revision: 0 }))),
  );
  const missingMutationId = syncMetadata();
  delete missingMutationId.lastMutationId;
  await assertFails(setDoc(doc(db, 'users/owner'), productivityRootV8(missingMutationId)));
});
