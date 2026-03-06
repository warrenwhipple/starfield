export type Vector2 = {
  x: number;
  y: number;
};

export const EVENT_TYPES = [
  'instruction-arrival',
  'probe-arrival',
  'missile-arrival',
  'build-complete',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type SimulationEvent<TType extends string = EventType, TPayload = unknown> = {
  id: string;
  type: TType;
  origin: Vector2;
  destination: Vector2;
  timeOrigin: number;
  timeArrival: number;
  payload: TPayload;
};

export type CreateTravelEventOptions<TType extends string, TPayload> = {
  id: string;
  type: TType;
  origin: Vector2;
  destination: Vector2;
  timeOrigin: number;
  speed: number;
  payload: TPayload;
};

function assertFiniteNumber(value: number, label: string) {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
}

function assertNonNegativeTime(value: number, label: string) {
  assertFiniteNumber(value, label);

  if (value < 0) {
    throw new Error(`${label} must be zero or greater.`);
  }
}

export function distanceBetween(origin: Vector2, destination: Vector2): number {
  const deltaX = destination.x - origin.x;
  const deltaY = destination.y - origin.y;
  return Math.hypot(deltaX, deltaY);
}

export function calculateArrivalTime(
  origin: Vector2,
  destination: Vector2,
  speed: number,
  timeOrigin = 0
): number {
  assertFiniteNumber(speed, 'speed');
  assertNonNegativeTime(timeOrigin, 'timeOrigin');

  if (speed <= 0) {
    throw new Error('speed must be greater than zero.');
  }

  return timeOrigin + distanceBetween(origin, destination) / speed;
}

export function createTravelEvent<TType extends string, TPayload>(
  options: CreateTravelEventOptions<TType, TPayload>
): SimulationEvent<TType, TPayload> {
  const { id, type, origin, destination, timeOrigin, speed, payload } = options;

  return {
    id,
    type,
    origin,
    destination,
    timeOrigin,
    timeArrival: calculateArrivalTime(origin, destination, speed, timeOrigin),
    payload,
  };
}
