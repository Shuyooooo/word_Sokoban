import { FireWaterLoveRule } from './rules/FireWaterLoveRule';
import { TigerDoorRule } from './rules/TigerDoorRule';

export type LevelType = 'tigerDoor' | 'fireWaterLove' | 'bioRepair';

export class RuleEngine {
  private tigerRule = new TigerDoorRule();
  private fireWaterRule = new FireWaterLoveRule();

  getHint(
    levelType: LevelType,
    state: { defeated: boolean; tigerAlive: boolean; playerText: string; steam: boolean; seasonFruitMode: boolean; seasonStage: number; bioRepairStage: number }
  ): string {
    if (levelType === 'fireWaterLove') {
      return this.fireWaterRule.getHint({
        defeated: state.defeated,
        playerText: state.playerText,
        steam: state.steam,
      });
    }
    if (levelType === 'bioRepair') {
      return this.tigerRule.getBioRepairHint({
        defeated: state.defeated,
        bioRepairStage: state.bioRepairStage,
      });
    }
    return this.tigerRule.getHint({
      defeated: state.defeated,
      tigerAlive: state.tigerAlive,
      seasonFruitMode: state.seasonFruitMode,
      seasonStage: state.seasonStage,
    });
  }
}

