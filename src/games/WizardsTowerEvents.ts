export interface TowerEvent {
  type: "attackTower";
  strength: number;
}

export function attackTower(strength: number): TowerEvent {
  return {
    type: "attackTower",
    strength,
  };
}
