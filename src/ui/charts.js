// src/ui/charts.js
// ✅ ChartHost：枠だけ（中身・仕様・集計に一切干渉しない）

const _charts = new Map(); // id -> Chart instance

function canvasReady(canvas) {
  if (!canvas) return false;
  const r = canvas.getBoundingClientRect();
  // 高さ優先。幅は最低限だけ見る（狭くても初期化は許可）
  return r.height >= 120 && r.width >= 40;
}

/**
 * renderChart(id, canvas, config, plugins?)
 * - id単位でChartを管理する
 * - ドロワー切替等でcanvasが差し替わったら、そのidだけdestroyして作り直す
 * - configはウィジェット側が生成（ビン/集計/表示仕様を含む）
 */
export function renderChart(id, canvas, config, plugins = null) {
  const Chart = window.Chart;
  if (!Chart) return false;
  if (!canvasReady(canvas)) return false;

  const prev = _charts.get(id);
  if (prev && prev.canvas !== canvas) {
    try { prev.destroy(); } catch (e) {}
    _charts.delete(id);
  }

  const ctx = canvas.getContext?.("2d");
  if (!ctx) return false;

  // 初回生成
  if (!_charts.has(id)) {
    const ch = new Chart(ctx, {
      ...config,
      ...(plugins ? { plugins } : {}),
    });
    _charts.set(id, ch);
    requestAnimationFrame(() => ch?.resize());
    return true;
  }

  // 既存更新（type変更など危険な場合は作り直す）
  const ch = _charts.get(id);
  const nextType = config?.type;
  const curType = ch?.config?.type;
  if (nextType && curType && nextType !== curType) {
    try { ch.destroy(); } catch (e) {}
    _charts.delete(id);
    return renderChart(id, canvas, config, plugins);
  }

  // data/options差し替え（中身は知らない）
  if (config?.data) ch.config.data = config.data;
  if (config?.options) ch.config.options = config.options;
  ch.update();
  return true;
}

export function destroyChart(id) {
  const ch = _charts.get(id);
  if (ch) {
    try { ch.destroy(); } catch (e) {}
    _charts.delete(id);
  }
}
