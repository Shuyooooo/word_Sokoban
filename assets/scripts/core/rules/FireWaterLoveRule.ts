export class FireWaterLoveRule {
  getHint(state: { defeated: boolean; playerText: string; steam: boolean }): string {
    if (state.defeated) {
      if (state.playerText === '化石') return '在下变成化石了（爱触火爆裂）';
      return '在下失败了';
    }
    if (state.steam) return '水蒸汽散去中...';
    return '把“爱”推向“水”分裂成2个小水，再推向火';
  }
}

