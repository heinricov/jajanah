import { getContext, runWithContext, updateContext } from './als';

describe('als', () => {
  it('getContext di luar konteks mengembalikan object kosong', () => {
    expect(getContext()).toEqual({});
  });

  it('runWithContext membungkus fn dan terbaca di dalamnya', () => {
    runWithContext({ requestId: 'req-1', method: 'GET', path: '/status' }, () => {
      expect(getContext()).toEqual({ requestId: 'req-1', method: 'GET', path: '/status' });
    });
  });

  it('konteks bersarang mewarisi milik induk', () => {
    runWithContext({ requestId: 'req-1' }, () => {
      runWithContext({ userId: 'user-9' }, () => {
        expect(getContext()).toEqual({ requestId: 'req-1', userId: 'user-9' });
      });
      expect(getContext()).toEqual({ requestId: 'req-1' });
    });
  });

  it('updateContext memperbarui store aktif', () => {
    runWithContext({ requestId: 'req-1' }, () => {
      updateContext({ userId: 'user-9' });
      expect(getContext()).toEqual({ requestId: 'req-1', userId: 'user-9' });
    });
  });

  it('updateContext di luar konteks tidak melempar', () => {
    expect(() => {
      updateContext({ userId: 'user-9' });
    }).not.toThrow();
    expect(getContext()).toEqual({});
  });

  it('konteks bertahan melewati boundary async', async () => {
    await runWithContext({ requestId: 'req-1' }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(getContext()).toEqual({ requestId: 'req-1' });
    });
  });
});
