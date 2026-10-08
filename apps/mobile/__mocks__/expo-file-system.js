module.exports = {
  Paths: { document: { uri: 'file:///documents/' }, cache: { uri: 'file:///cache/' } },
  File: jest.fn(function (...parts) {
    this.uri = parts.map((part) => part.uri || part).join('/');
    this.exists = true;
    this.copy = jest.fn();
    this.delete = jest.fn();
  }),
};
