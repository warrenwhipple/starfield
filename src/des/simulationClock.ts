import { EventQueue } from './eventQueue';

type TimedEvent = {
  timeArrival: number;
};

export type SimulationEventHandler<TEvent extends TimedEvent> = (
  event: TEvent,
  clock: SimulationClock<TEvent>
) => void;

export type SimulationClockOptions<TEvent extends TimedEvent> = {
  startTime?: number;
  queue?: EventQueue<TEvent>;
};

export class SimulationClock<TEvent extends TimedEvent> {
  private readonly queue: EventQueue<TEvent>;
  private currentTime: number;

  constructor(options: SimulationClockOptions<TEvent> = {}) {
    const { startTime = 0, queue = new EventQueue<TEvent>() } = options;

    if (!Number.isFinite(startTime) || startTime < 0) {
      throw new Error('Simulation start time must be a finite number >= 0.');
    }

    this.currentTime = startTime;
    this.queue = queue;
  }

  get time(): number {
    return this.currentTime;
  }

  get pendingEventCount(): number {
    return this.queue.size;
  }

  schedule(event: TEvent): TEvent {
    if (event.timeArrival < this.currentTime) {
      throw new Error('Cannot schedule an event before the current simulation time.');
    }

    return this.queue.schedule(event);
  }

  peekNextEvent(): TEvent | undefined {
    return this.queue.peek();
  }

  advanceToNextEvent(handler?: SimulationEventHandler<TEvent>): TEvent | undefined {
    const nextEvent = this.queue.pop();
    if (!nextEvent) {
      return undefined;
    }

    this.currentTime = nextEvent.timeArrival;
    handler?.(nextEvent, this);
    return nextEvent;
  }

  runUntil(time: number, handler?: SimulationEventHandler<TEvent>): TEvent[] {
    if (!Number.isFinite(time) || time < this.currentTime) {
      throw new Error('runUntil time must be a finite number >= current simulation time.');
    }

    const processed: TEvent[] = [];

    for (
      let nextEvent = this.queue.peek();
      nextEvent && nextEvent.timeArrival <= time;
      nextEvent = this.queue.peek()
    ) {
      const processedEvent = this.advanceToNextEvent(handler);
      if (processedEvent) {
        processed.push(processedEvent);
      }
    }

    this.currentTime = time;
    return processed;
  }
}
