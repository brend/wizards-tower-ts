export interface TowerEvent {
  type: string;
  strength: number;
}

export function attackTower(strength: number) {
  return {
    type: "attackTower",
    strength,
  };
}
