export class HealthRepository {
  async ping(): Promise<boolean> {
    return true;
  }
}
