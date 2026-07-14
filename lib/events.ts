const DATA_CHANGED_EVENT = "issueflow:data-changed";

export function emitDataChanged() {
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
}

export function onDataChanged(handler: () => void) {
  window.addEventListener(DATA_CHANGED_EVENT, handler);
  return () => window.removeEventListener(DATA_CHANGED_EVENT, handler);
}
