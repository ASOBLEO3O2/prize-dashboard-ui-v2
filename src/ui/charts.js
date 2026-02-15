// src/ui/charts.js
// ✅ ChartHost：チャートの器だけ（中身は一切知らない）

const _charts = new Map(); // id -> Chart instance

function canvasReady(canvas) {
  if (!canvas) return false;
  const r = canvas.getBoundingClientRect();
  return r.height >= 120 && r.width >= 40;
}

/**
 * renderChart(id, canvas, config, plugins?)
 * - id単位でChartを管理
 * - canvas差し替え（ドロワー切替等）を検知したら、そのidだけdestroyして作り直す
 * - configはウィジェット側が生成（集計も含めてウィジェット側）
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

  if (!_charts.has(id)) {
    const ch = new Chart(ctx, {
      ...config,
      ...(plugins ? { plugins } : {}),
    });
    _charts.set(id, ch);
    requestAnimationFrame(() => ch?.resize());
    return true;
  }

  // 既存更新：configを丸ごと差し替え（中身はウィジェットの責務）
  const ch = _charts.get(id);

  // typeが変わるような更新はdestroy→recreateが安全
  if (config?.type && ch.config?.type && config.type !== ch.config.type) {
    try { ch.destroy(); } catch (e) {}
    _charts.delete(id);
    return renderChart(id, canvas, config, plugins);
  }

  ch.config.data = config.data;
  ch.config.options = config.options || ch.config.options;
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
