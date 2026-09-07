const actual = jest.requireActual('react-native-safe-area-context');

module.exports = {
  ...actual,
  initialWindowMetrics: {
    frame: { width: 320, height: 640, x: 0, y: 0 },
    insets: { left: 0, right: 0, bottom: 0, top: 0 },
  },
  useSafeAreaInsets: jest.fn(() => ({ top: 0, bottom: 0, left: 0, right: 0 })),
  useSafeAreaFrame: jest.fn(() => ({ width: 320, height: 640, x: 0, y: 0 })),
};
