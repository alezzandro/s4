import EventEmitter from 'eventemitter3';

// Define event payload types
export type EventMap = {
  notification: {
    variant: 'success' | 'danger' | 'warning' | 'info';
    title: string;
    description: string;
  };
  'auth:unauthorized': {
    message: string;
  };
  error: {
    error: Error | string;
  };
};

type EventCallback<T = unknown> = (payload: T) => void;

const eventEmitter = new EventEmitter();

const Emitter = {
  on: <K extends keyof EventMap>(event: K, fn: EventCallback<EventMap[K]>) => eventEmitter.on(event, fn),
  once: <K extends keyof EventMap>(event: K, fn: EventCallback<EventMap[K]>) => eventEmitter.once(event, fn),
  off: <K extends keyof EventMap>(event: K, fn: EventCallback<EventMap[K]>) => eventEmitter.off(event, fn),
  emit: <K extends keyof EventMap>(event: K, payload: EventMap[K]) => eventEmitter.emit(event, payload),
};

Object.freeze(Emitter);

export default Emitter;
