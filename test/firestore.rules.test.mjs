import fs from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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

const seedGoal = async () =>
  environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'users/owner/goals/goal-1'), {
      data: { id: 'goal-1', title: 'Servidor' },
      meta: { schemaVersion: 2, serverRevision: 1 },
    });
  });

test('registered owner reads server-written productivity', async () => {
  await seedGoal();
  await assertSucceeds(getDoc(doc(registered('owner').firestore(), 'users/owner/goals/goal-1')));
});

test('client productivity writes are denied', async () => {
  const db = registered('owner').firestore();
  await assertFails(setDoc(doc(db, 'users/owner/goals/goal-1'), { data: { id: 'goal-1' } }));
  await assertFails(setDoc(doc(db, 'users/owner'), { schemaVersion: 9 }));
});

test('unverified account cannot read productivity', async () => {
  await seedGoal();
  await assertFails(getDoc(doc(unverified('owner').firestore(), 'users/owner/goals/goal-1')));
});

test('cross-user reads are denied', async () => {
  await seedGoal();
  await assertFails(getDoc(doc(registered('attacker').firestore(), 'users/owner/goals/goal-1')));
});

test('connection token access remains denied', async () => {
  await assertFails(
    getDoc(doc(registered('owner').firestore(), 'users/owner/connections/google_calendar')),
  );
});
