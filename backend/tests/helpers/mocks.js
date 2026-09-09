import { vi } from 'vitest';

export function createMockPool() {
  return {
    query: vi.fn(),
    connect: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
      release: vi.fn()
    }),
    end: vi.fn().mockResolvedValue(undefined),
    on: vi.fn()
  };
}

export function createMockRedis() {
  return {
    status: 'ready',
    ping: vi.fn().mockResolvedValue('PONG'),
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue('OK'),
    on: vi.fn()
  };
}

export function createMockQueue() {
  return {
    add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn()
  };
}

export default {
  createMockPool,
  createMockRedis,
  createMockQueue
};
