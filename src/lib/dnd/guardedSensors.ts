import { PointerSensor, TouchSensor } from "@dnd-kit/core";

export function isDragStartAllowed(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return !target.closest(
    'a,button,input,textarea,select,[contenteditable="true"],[data-no-dnd="true"]'
  );
}

export class GuardedPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent }: { nativeEvent: PointerEvent }) =>
        isDragStartAllowed(nativeEvent.target),
    },
  ];
}

export class GuardedTouchSensor extends TouchSensor {
  static activators = [
    {
      eventName: "onTouchStart" as const,
      handler: ({ nativeEvent }: { nativeEvent: TouchEvent }) =>
        isDragStartAllowed(nativeEvent.target),
    },
  ];
}

export function shouldPreventSelectionDuringDrag(
  isDragActive: boolean,
  target: EventTarget | null
): boolean {
  return isDragActive && isDragStartAllowed(target);
}
