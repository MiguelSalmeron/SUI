const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const order = [];
const original = Module._load;
Module._load = function (name, parent, ...args) {
  if (parent?.filename.endsWith('/account/deleteAccount.js')) {
    if (name === 'firebase-functions/v2/https')
      return { onRequest: (_options, handler) => handler };
    if (name === 'firebase-admin/auth')
      return {
        getAuth: () => ({
          deleteUser: async (uid) => {
            assert.equal(uid, 'owner');
            order.push('auth');
          },
        }),
      };
    if (name === '../profile/updateIdentity')
      return {
        deleteAvatar: async (uid) => {
          assert.equal(uid, 'owner');
          order.push('avatar');
        },
      };
    if (name === '../chat/auth')
      return { authenticateBearer: async () => ({ ok: true, uid: 'owner' }) };
    if (name === '../chat/firebase')
      return {
        firestore: {
          collection: () => ({ doc: () => ({}) }),
          recursiveDelete: async () => {
            order.push('firestore');
          },
        },
      };
    if (name === '../connections/googleCalendar')
      return {
        disconnectGoogleCalendarForUser: async () => {
          order.push('calendar');
        },
      };
    if (name === '../connections/googleTasks')
      return { disconnectGoogleTasksForUser: async () => undefined };
    if (name === '../http/appCheck') return { verifyAppCheckHeader: async () => true };
    if (name === '../http/cors') return { setCorsHeaders: () => true };
  }
  return original.call(this, name, parent, ...args);
};
const { deleteAccount } = require('../lib/account/deleteAccount.js');
Module._load = original;
test('borrar cuenta elimina avatar antes de documento y Auth', async () => {
  let status;
  const response = {
    status: (value) => {
      status = value;
      return response;
    },
    json: () => undefined,
  };
  await deleteAccount({ method: 'POST', headers: { authorization: 'Bearer token' } }, response);
  assert.equal(status, 200);
  assert.deepEqual(order, ['calendar', 'avatar', 'firestore', 'auth']);
});
