export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function normalize(value, min, max) {
  if (max === min) {
    return 0;
  }

  return clamp((value - min) / (max - min), 0, 1);
}

export function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

export function wrapAngle(angle) {
  const twoPi = Math.PI * 2;
  return ((angle + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
}
