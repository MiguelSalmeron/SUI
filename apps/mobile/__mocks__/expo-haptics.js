module.exports = {
  impactAsync: jest.fn(async () => undefined),
  ImpactFeedbackStyle: {
    Light: 'light',
  },
  notificationAsync: jest.fn(async () => undefined),
  NotificationFeedbackType: {
    Success: 'success',
  },
};
