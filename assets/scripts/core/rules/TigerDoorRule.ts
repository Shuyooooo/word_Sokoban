export class TigerDoorRule {
  getBioRepairHint(state: { defeated: boolean; bioRepairStage: number }): string {
    if (state.defeated) return '在下变成小零食了（碰到生化河）';
    if (state.bioRepairStage <= 0) return '先把丧尸推到医院，变成兵营';
    if (state.bioRepairStage === 1) return '在下进入兵营，会爆出6个净化者';
    if (state.bioRepairStage === 2) return '把净化者推到生化河；圣光也可逐格消字防卡位';
    return '白河已连通，过河去门';
  }

  getHint(state: { defeated: boolean; tigerAlive: boolean; seasonFruitMode: boolean; seasonStage: number }): string {
    if (state.defeated) return '在下变成小零食了（被猛虎碰到）';
    if (state.seasonFruitMode && !state.tigerAlive) {
      return '推开胖胖龙，去门';
    }
    if (state.seasonFruitMode && state.tigerAlive) {
      if (state.seasonStage <= 0) return '先把春推到小芽上，扩成8行芽';
      if (state.seasonStage === 1) return '再把夏推到芽上，长成那棵大树';
      if (state.seasonStage === 2) return '把秋推到叶上，弹出金苹果';
      return '把金苹果推给巨龙，再去出门';
    }
    if (state.tigerAlive) return '把刀推向猛虎，才能出门';
    return '方向键 / WASD：先处理猛虎，再出门';
  }
}

