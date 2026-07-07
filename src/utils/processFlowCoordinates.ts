import coordinates from "@/data/processFlowCoordinates.json";

export interface Coordinate {
  x: number;
  y: number;
}

export function getCoordinate(diag: string): Coordinate {
  const coord = (coordinates as Record<string, Coordinate>)[diag];

  return coord ?? {
    x: 50,
    y: 50,
  };
}
