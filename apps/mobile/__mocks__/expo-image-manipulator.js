module.exports = {
  SaveFormat: { WEBP: 'webp' },
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      crop: jest.fn(),
      resize: jest.fn(),
      renderAsync: jest.fn(async () => ({
        saveAsync: jest.fn(async () => ({ uri: 'file:///photo.webp' })),
      })),
    })),
  },
};
