export interface Vector2 {
  x: number;
  y: number;
}

export class PhysicsUtils {
  static distance(a: Vector2, b: Vector2): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  static normalize(vector: Vector2): Vector2 {
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    if (length === 0) return { x: 0, y: 0 };
    return { x: vector.x / length, y: vector.y / length };
  }

  static multiply(vector: Vector2, scalar: number): Vector2 {
    return { x: vector.x * scalar, y: vector.y * scalar };
  }

  static add(a: Vector2, b: Vector2): Vector2 {
    return { x: a.x + b.x, y: a.y + b.y };
  }

  static subtract(a: Vector2, b: Vector2): Vector2 {
    return { x: a.x - b.x, y: a.y - b.y };
  }

  static circleCollision(pos1: Vector2, radius1: number, pos2: Vector2, radius2: number): boolean {
    const distance = this.distance(pos1, pos2);
    return distance < (radius1 + radius2);
  }

  static rectCollision(pos1: Vector2, size1: Vector2, pos2: Vector2, size2: Vector2): boolean {
    return pos1.x < pos2.x + size2.x &&
           pos1.x + size1.x > pos2.x &&
           pos1.y < pos2.y + size2.y &&
           pos1.y + size1.y > pos2.y;
  }

  static wrapPosition(position: Vector2, bounds: Vector2): Vector2 {
    return {
      x: ((position.x % bounds.x) + bounds.x) % bounds.x,
      y: ((position.y % bounds.y) + bounds.y) % bounds.y
    };
  }

  static clampPosition(position: Vector2, min: Vector2, max: Vector2): Vector2 {
    return {
      x: Math.max(min.x, Math.min(max.x, position.x)),
      y: Math.max(min.y, Math.min(max.y, position.y))
    };
  }
}
