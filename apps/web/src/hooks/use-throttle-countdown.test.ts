import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useThrottleCountdown } from "./use-throttle-countdown";

describe("useThrottleCountdown (ux-wireframe §3.2 — real-time, ticks every 1s)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts inactive with 0 remaining seconds", () => {
    const { result } = renderHook(() => useThrottleCountdown());
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.isActive).toBe(false);
  });

  it("start(seconds) arms the countdown", () => {
    const { result } = renderHook(() => useThrottleCountdown());
    act(() => result.current.start(5));
    expect(result.current.remainingSeconds).toBe(5);
    expect(result.current.isActive).toBe(true);
  });

  it("decrements by exactly 1 every second (real-time, not a static number)", () => {
    const { result } = renderHook(() => useThrottleCountdown());
    act(() => result.current.start(3));
    expect(result.current.remainingSeconds).toBe(3);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.remainingSeconds).toBe(2);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.remainingSeconds).toBe(1);
  });

  it("reaches 0 and becomes inactive automatically (form re-enables, no refresh needed)", () => {
    const { result } = renderHook(() => useThrottleCountdown());
    act(() => result.current.start(2));

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.remainingSeconds).toBe(1);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.isActive).toBe(false);
  });

  it("never goes negative", () => {
    const { result } = renderHook(() => useThrottleCountdown());
    act(() => result.current.start(1));

    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.remainingSeconds).toBe(0);
  });

  it("re-arming with start() while already counting down resyncs to the new value (clock-skew re-sync)", () => {
    const { result } = renderHook(() => useThrottleCountdown());
    act(() => result.current.start(10));
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.remainingSeconds).toBe(7);

    // server responded again with a fresh Retry-After during the wait
    act(() => result.current.start(20));
    expect(result.current.remainingSeconds).toBe(20);
  });
});
