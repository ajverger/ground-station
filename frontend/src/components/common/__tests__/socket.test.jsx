/**
 * Example test for Socket context
 */

import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSocket, SocketProvider, redactSocketDebugArgs } from '../socket';

// Mock socket.io-client - define the mock inline in the factory function
vi.mock('socket.io-client', () => ({
  Manager: class MockManager {
    constructor(url, options) {
      this.url = url;
      this.options = options;
    }

    socket(namespace) {
      const mockSocket = {
        on: vi.fn(),
        off: vi.fn(),
        emit: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        close: vi.fn(),
        onAny: vi.fn(),
        offAny: vi.fn(),
        connected: true,
        id: 'test-socket-id',
        io: {
          on: vi.fn(),
          off: vi.fn(),
          engine: {
            on: vi.fn(),
            off: vi.fn(),
          },
        },
      };
      return mockSocket;
    }
  },
  io: vi.fn(),
}));

describe('SocketProvider', () => {
  it('redacts admin passwords from event-console copies without changing the sent payload', () => {
    const payload = { cmd: 'users.reset_password', data: { user_id: 'user-1', password: 'private' } };
    const args = [payload];

    expect(redactSocketDebugArgs('api.call', args)[0].data.password).toBe('[REDACTED]');
    expect(payload.data.password).toBe('private');
    const tokenPayload = { cmd: 'tokens.create', data: { password: 'token-password' } };
    expect(redactSocketDebugArgs('api.call', [tokenPayload])[0].data.password).toBe('[REDACTED]');
    expect(tokenPayload.data.password).toBe('token-password');
  });

  it('provides socket instance to children', () => {
    const wrapper = ({ children }) => (
      <SocketProvider>{children}</SocketProvider>
    );

    const { result } = renderHook(() => useSocket(), { wrapper });

    expect(result.current.socket).toBeDefined();
  });

  it('socket can emit events', () => {
    const wrapper = ({ children }) => (
      <SocketProvider>{children}</SocketProvider>
    );

    const { result } = renderHook(() => useSocket(), { wrapper });

    // Test that socket has an emit function
    expect(result.current.socket).toBeDefined();
    expect(typeof result.current.socket.emit).toBe('function');

    // Test that emit can be called without errors
    expect(() => {
      result.current.socket.emit('test-event', { data: 'test' });
    }).not.toThrow();
  });

  it('measures incoming payloads only while enabled without reconnecting', () => {
    const wrapper = ({ children }) => <SocketProvider>{children}</SocketProvider>;
    const { result } = renderHook(() => useSocket(), { wrapper });
    const socket = result.current.socket;
    let serializations = 0;
    const payload = { toJSON: () => { serializations += 1; return { large: 'payload' }; } };

    const incoming = () => socket.onAny.mock.calls.at(-1)[0];
    act(() => incoming()('sample', payload));
    expect(serializations).toBe(0);

    act(() => result.current.setCollectStats(true));
    act(() => incoming()('sample', payload));
    expect(serializations).toBe(1);
    expect(result.current.socket).toBe(socket);
    expect(socket.close).not.toHaveBeenCalled();

    act(() => result.current.setCollectStats(false));
    act(() => incoming()('sample', payload));
    expect(serializations).toBe(1);
  });

  it('samples traffic on demand without a background timer', () => {
    vi.useFakeTimers();
    try {
      const wrapper = ({ children }) => <SocketProvider>{children}</SocketProvider>;
      const { result, unmount } = renderHook(() => useSocket(), { wrapper });
      const incoming = result.current.socket.onAny.mock.calls.at(-1)[0];

      expect(vi.getTimerCount()).toBe(0);
      act(() => result.current.setCollectStats(true));
      act(() => incoming('sample', { value: 1 }));
      act(() => vi.advanceTimersByTime(1000));
      expect(result.current.trafficStatsRef.current.engine.packetsReceived).toBe(0);

      act(() => result.current.sampleTrafficStats());
      expect(result.current.trafficStatsRef.current.engine.packetsReceived).toBe(1);
      expect(result.current.trafficStatsRef.current.rates.packetsPerSecond.received).toBe(1);
      expect(vi.getTimerCount()).toBe(0);

      act(() => result.current.setCollectStats(false));
      unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('updates transport status from socket events without polling', () => {
    const wrapper = ({ children }) => <SocketProvider>{children}</SocketProvider>;
    const { result } = renderHook(() => useSocket(), { wrapper });
    const socket = result.current.socket;
    const connect = socket.on.mock.calls.find(([event]) => event === 'connect')[1];
    const disconnect = socket.on.mock.calls.find(([event]) => event === 'disconnect')[1];

    act(() => {
      socket.io.engine.transport = { name: 'polling' };
      connect();
    });
    expect(result.current.transportName).toBe('polling');

    const upgrade = socket.io.engine.on.mock.calls.find(([event]) => event === 'upgrade')[1];
    act(() => {
      socket.io.engine.transport = { name: 'websocket' };
      upgrade({ name: 'websocket' });
    });
    expect(result.current.transportName).toBe('websocket');
    expect(result.current.trafficStatsRef.current.engine.upgradeAttempts).toBe(1);

    act(() => disconnect('test'));
    expect(result.current.transportName).toBe('disconnected');
  });
});
