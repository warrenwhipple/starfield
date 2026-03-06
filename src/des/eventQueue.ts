type TimedEvent = {
  timeArrival: number;
};

type QueueRecord<TEvent extends TimedEvent> = {
  event: TEvent;
  sequence: number;
};

function compareRecords<TEvent extends TimedEvent>(
  left: QueueRecord<TEvent>,
  right: QueueRecord<TEvent>
): number {
  if (left.event.timeArrival !== right.event.timeArrival) {
    return left.event.timeArrival - right.event.timeArrival;
  }

  return left.sequence - right.sequence;
}

export class EventQueue<TEvent extends TimedEvent> {
  private readonly items: QueueRecord<TEvent>[] = [];
  private nextSequence = 0;

  get size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  schedule(event: TEvent): TEvent {
    if (!Number.isFinite(event.timeArrival)) {
      throw new Error('Event timeArrival must be a finite number.');
    }

    const record: QueueRecord<TEvent> = {
      event,
      sequence: this.nextSequence++,
    };

    const insertIndex = this.findInsertIndex(record);
    this.items.splice(insertIndex, 0, record);
    return event;
  }

  peek(): TEvent | undefined {
    return this.items[0]?.event;
  }

  pop(): TEvent | undefined {
    return this.items.shift()?.event;
  }

  clear() {
    this.items.length = 0;
  }

  toArray(): TEvent[] {
    return this.items.map(({ event }) => event);
  }

  private findInsertIndex(record: QueueRecord<TEvent>): number {
    let low = 0;
    let high = this.items.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const comparison = compareRecords(this.items[mid], record);

      if (comparison <= 0) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }
}
