/** `expo-web-browser` abre Custom Tabs nativas; en tests no hay nada que abrir. */
module.exports = {
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(async () => ({ type: 'cancel' })),
  dismissAuthSession: jest.fn(),
  dismissBrowser: jest.fn(),
  openBrowserAsync: jest.fn(async () => ({ type: 'cancel' })),
};
