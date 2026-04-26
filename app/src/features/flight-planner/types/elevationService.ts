export interface IElevationService {
  getElevations(points: Array<[number, number]>): Promise<number[]>
}
