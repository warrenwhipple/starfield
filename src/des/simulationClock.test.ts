import { describe, expect, it } from 'vitest';

import {
  EventQueue,
  SimulationClock,
  createTravelEvent,
  distanceBetween,
  type SimulationEvent,
} from './index';

type DemoEvent = SimulationEvent<'probe-arrival' | 'missile-arrival', { label: string }>;

function makeEvent(
  id: string,
  timeArrival: number,
  type: DemoEvent['type'] = 'probe-arrival'
): DemoEvent {
  return {
    id,
    type,
    origin: { x: 0, y: 0 },
    destination: { x: 1, y: 1 },
    timeOrigin: 0,
    timeArrival,
    payload: { label: id },
  };
}

describe('DES engine', () => {
  it('computes distance-based arrival times from origin and destination', () => {
    expect(distanceBetween({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);

    const event = createTravelEvent({
      id: 'probe-sol-sirius',
      type: 'probe-arrival',
      origin: { x: 0, y: 0 },
      destination: { x: 3, y: 4 },
      timeOrigin: 2,
      speed: 5,
      payload: { label: 'Sol -> Sirius' },
    });

    expect(event.timeOrigin).toBe(2);
    expect(event.timeArrival).toBeCloseTo(3);
    expect(event.origin).toEqual({ x: 0, y: 0 });
    expect(event.destination).toEqual({ x: 3, y: 4 });
  });

  it('keeps the event queue ordered by arrival time', () => {
    const queue = new EventQueue<DemoEvent>();
    queue.schedule(makeEvent('late', 9));
    queue.schedule(makeEvent('first', 3));
    queue.schedule(makeEvent('middle', 6));

    expect(queue.toArray().map((event) => event.id)).toEqual(['first', 'middle', 'late']);
  });

  it('preserves insertion order for ties at the same arrival time', () => {
    const queue = new EventQueue<DemoEvent>();
    queue.schedule(makeEvent('alpha', 5));
    queue.schedule(makeEvent('beta', 5));
    queue.schedule(makeEvent('gamma', 5));

    expect(queue.toArray().map((event) => event.id)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('advances the simulation clock to the next event timestamp', () => {
    const clock = new SimulationClock<DemoEvent>();
    clock.schedule(makeEvent('first', 1.5));
    clock.schedule(makeEvent('second', 4.25, 'missile-arrival'));

    const processedIds: string[] = [];
    const nextEvent = clock.advanceToNextEvent((event) => {
      processedIds.push(event.id);
    });

    expect(nextEvent?.id).toBe('first');
    expect(processedIds).toEqual(['first']);
    expect(clock.time).toBe(1.5);
    expect(clock.peekNextEvent()?.id).toBe('second');
  });

  it('processes all events up to a target time and leaves later events queued', () => {
    const clock = new SimulationClock<DemoEvent>();
    clock.schedule(makeEvent('first', 1));
    clock.schedule(makeEvent('second', 3));
    clock.schedule(makeEvent('third', 8));

    const processed = clock.runUntil(5);

    expect(processed.map((event) => event.id)).toEqual(['first', 'second']);
    expect(clock.time).toBe(5);
    expect(clock.pendingEventCount).toBe(1);
    expect(clock.peekNextEvent()?.id).toBe('third');
  });
});
