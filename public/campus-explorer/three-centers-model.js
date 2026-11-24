/* Pure geometry and quest state for the 3D Campus Three-Centers Spatial Detective mode. */
window.CampusThreeCentersModel = (() => {
  const STORAGE_KEY = 'daxi-campus-3d:three-centers-record-v1';
  const TOLERANCE = 2.1; // Walkable capture radius in 3D guide meters

  const dist = (p, q) => Math.hypot(p.x - q.x, p.z - q.z);
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 });

  function footOfPerpendicular(p, a, b) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const lenSq = dx * dx + dz * dz || 1;
    const t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / lenSq;
    return { x: a.x + dx * t, z: a.z + dz * t, t };
  }

  function pointToLineDistance(p, a, b) {
    const foot = footOfPerpendicular(p, a, b);
    return dist(p, foot);
  }

  function isInsideTriangle(p, a, b, c) {
    const cross = (u, v, w) => (v.x - u.x) * (w.z - u.z) - (v.z - u.z) * (w.x - u.x);
    const d1 = cross(p, a, b), d2 = cross(p, b, c), d3 = cross(p, c, a);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  }

  function incenter(a, b, c) {
    const la = dist(b, c), lb = dist(c, a), lc = dist(a, b);
    const sum = la + lb + lc || 1;
    return {
      x: (la * a.x + lb * b.x + lc * c.x) / sum,
      z: (la * a.z + lb * b.z + lc * c.z) / sum,
    };
  }

  function inradius(a, b, c) {
    const ic = incenter(a, b, c);
    return pointToLineDistance(ic, a, b);
  }

  function centroid(a, b, c) {
    return { x: (a.x + b.x + c.x) / 3, z: (a.z + b.z + c.z) / 3 };
  }

  function circumcenter(a, b, c) {
    const d = 2 * (a.x * (b.z - c.z) + b.x * (c.z - a.z) + c.x * (a.z - b.z));
    if (Math.abs(d) < 1e-6) return centroid(a, b, c);
    const a2 = a.x * a.x + a.z * a.z;
    const b2 = b.x * b.x + b.z * b.z;
    const c2 = c.x * c.x + c.z * c.z;
    return {
      x: (a2 * (b.z - c.z) + b2 * (c.z - a.z) + c2 * (a.z - b.z)) / d,
      z: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
    };
  }

  function circumradius(a, b, c) {
    return dist(circumcenter(a, b, c), a);
  }

  // Relative Cartesian plane for Stage 2: origin (-104, -13), East = +X, North = +Y
  const GRID_ORIGIN = { x: -104, z: -13 };
  const toGrid = p => ({
    x: Number((p.x - GRID_ORIGIN.x).toFixed(1)),
    y: Number((GRID_ORIGIN.z - p.z).toFixed(1)),
  });

  const STAGES = [
    {
      id: 'incenter',
      index: 0,
      badge: '第一關 · 內心',
      short: '內心 I',
      title: '校慶補給站：尋找內心',
      accent: '#f59e0b',
      accentHex: 0xf59e0b,
      // 26-28-30 Heron triangle on open sports field; exact incenter (-92, -21), inradius 8.0m
      vertices: {
        A: { x: -104, z: -13, label: 'A 標竿（西南）' },
        B: { x: -76, z: -13, label: 'B 標竿（東南）' },
        C: { x: -94, z: -37, label: 'C 標竿（北側）' },
      },
      spawn: { x: -82, y: 0, z: -16, yaw: 0.9 },
      overview: { x: -90, z: -24, height: 54 },
      story: '操場上有三條校慶賽道圍成 △ABC（邊長 26m、28m、30m）。請在三角形內找出「內心 I」，使補給站到三條邊界的垂直距離完全相等！',
      goalRule: '目標：讓到三邊的垂直距離 d(AB) = d(BC) = d(CA) = 8.0 m',
      hintLinesLabel: '顯示內角平分線',
      hints: [
        '內心是三條「內角平分線」的交點，而且必定落在三角形內部。',
        '一邊走一邊觀察左側三邊垂直距離：試著往距離較大的那一條邊的反方向靠近，或開啟「內角平分線」找兩線交點！',
      ],
      takeaway: '內心 I 是三內角平分線交點，到三邊等距（內切圓半徑 r），且不論何種三角形，內心必在內部。',
      questions: [
        {
          id: 'inc-1',
          prompt: '在剛才的 3D 操場實測中，補給站設在「內心 I」時，哪一項幾何性質必定成立？',
          choices: [
            '到三角形三條邊的垂直距離相等',
            '到三個頂點 A、B、C 的距離相等',
            '一定是鈍角三角形外部的點',
            '一定在最長邊的中點上',
          ],
          answer: 0,
          hint: '回想剛才綠色垂線與金色圓形碰到的位置：是切到「三條邊」還是通過「三個頂點」？',
          explanation: '內心是三條內角平分線的交點，角平分線上的點到角兩邊等距，因此內心到三邊垂直距離相等（即內切圓半徑 r = 8m）。',
        },
        {
          id: 'inc-2',
          prompt: '本關操場 △ABC 三邊長為 26m、28m、30m，面積為 336 m²。利用「面積 = ½ × 周長 × r」，內切圓半徑 r 是多少？',
          choices: ['6 m', '8 m', '10 m', '12 m'],
          answer: 1,
          hint: '先算周長 s×2 = 26 + 28 + 30 = 84，再算 ½ × 84 × r = 336。',
          explanation: '周長為 26 + 28 + 30 = 84，半周長 s = 42，由 336 = 42 × r 得 r = 8 m，正好與 3D 實測數據吻合！',
        },
      ],
    },
    {
      id: 'centroid',
      index: 1,
      badge: '第二關 · 重心',
      short: '重心 G',
      title: '空拍吊掛點：尋找重心',
      accent: '#10b981',
      accentHex: 0x10b981,
      // Grid origin (-104, -13): A(0,0), B(27,3), C(9,24) -> exact centroid (12,9) => world (-92, -22)
      vertices: {
        A: { x: -104, z: -13, label: 'A (0, 0)' },
        B: { x: -77, z: -16, label: 'B (27, 3)' },
        C: { x: -95, z: -37, label: 'C (9, 24)' },
      },
      spawn: { x: -101, y: 0, z: -16, yaw: -0.75 },
      overview: { x: -91, z: -24, height: 54 },
      story: '空拍無人機要吊起 80 週年三角形布幕，必須找到物理平衡點「重心 G」。利用頂點座標平均與「頂點到重心：重心到對邊中點 = 2 : 1」走到重心插旗！',
      goalRule: '目標：讓座標收斂至三頂點平均，且 PA : PM = 2.0 : 1',
      hintLinesLabel: '顯示中點與中線',
      hints: [
        '重心座標是三頂點座標的平均：X = (0 + 27 + 9) ÷ 3，Y = (0 + 3 + 24) ÷ 3。',
        '開啟「中點與中線」輔助光束，沿著任一條中線走到距離頂點 2/3 處的交點就是重心 G(12, 9)！',
      ],
      takeaway: '重心 G 是三條中線的交點，座標為三頂點平均，將每條中線分成 2 : 1，並把三角形分成 6 塊等面積小三角形。',
      questions: [
        {
          id: 'cen-1',
          prompt: '若操場頂點 C 到對邊 AB 中點 M 的中線全長為 24 公尺，重心 G 距離頂點 C 應該是多少公尺？',
          choices: ['8 公尺', '12 公尺', '16 公尺', '18 公尺'],
          answer: 2,
          hint: '重心把中線分成「頂點到重心 : 重心到中點 = 2 : 1」，也就是占全長的 2/3。',
          explanation: '頂點到重心占整條中線的 2/3，因此 24 × (2/3) = 16 公尺，重心到中點則為 8 公尺。',
        },
        {
          id: 'cen-2',
          prompt: '三條中線交於重心 G 後，會將整個操場三角形切割成 6 塊小三角形（如剛才 3D 地面彩色區塊），這 6 塊的面積關係為何？',
          choices: [
            '6 塊面積全部相等',
            '靠鈍角的 2 塊較大',
            '只有對稱的兩兩相等',
            '必須是正三角形才會相等',
          ],
          answer: 0,
          hint: '等底同高的三角形面積相等，每一條中線都把對應三角形面積平分。',
          explanation: '不管三角形是什麼形狀，三條中線必將原三角形平分為 6 個面積完全相等的小三角形！',
        },
      ],
    },
    {
      id: 'circumcenter',
      index: 2,
      badge: '第三關 · 外心',
      short: '外心 O',
      title: '全區廣播塔：尋找外心',
      accent: '#0ea5e9',
      accentHex: 0x0ea5e9,
      // Obtuse triangle (∠B ≈ 118.1°); exact circumcenter O(-90, -25) OUTSIDE triangle, R = 17.0m
      vertices: {
        A: { x: -105, z: -17, label: 'A 據點（西）' },
        B: { x: -98, z: -10, label: 'B 據點（鈍角）' },
        C: { x: -75, z: -17, label: 'C 據點（東）' },
      },
      spawn: { x: -94, y: 0, z: -14, yaw: 0.1 },
      overview: { x: -90, z: -22, height: 58 },
      story: '廣播轉播塔必須與三個據點 A、B、C 保持完全相等的距離（PA = PB = PC）。注意：∠B 是超過 90° 的鈍角，別被三角形的邊界騙了！',
      goalRule: '目標：走出盲點，找到 PA = PB = PC = 17.0 m 的外心',
      hintLinesLabel: '顯示垂直平分線（中垂線）',
      hints: [
        '外心是三邊「垂直平分線（中垂線）」的交點，到三個頂點等距。',
        '本關 △ABC 是「鈍角三角形」，外心不會在三角形裡面！試著往北走出 AC 邊界外，或開啟中垂線看看交點落在哪裡！',
      ],
      takeaway: '外心 O 是三邊垂直平分線交點，到三頂點等距（外接圓半徑 R）；銳角在內部、直角在斜邊中點、鈍角在三角形外部。',
      questions: [
        {
          id: 'cir-1',
          prompt: '本關你必須走出 △ABC 外部才找到外心 O，這是因為這個三角形具有什麼特徵？',
          choices: [
            '它是鈍角三角形（有一個內角大於 90°）',
            '它是不等邊三角形',
            '它的周長大於 50 公尺',
            '所有三角形的外心都在外部',
          ],
          answer: 0,
          hint: '觀察 ∠B 的張開角度，以及鈍角對應邊 AC 外側的中垂線交會位置。',
          explanation: '外心位置隨最大角決定：銳角三角形在內部、直角三角形在斜邊中點、鈍角三角形一定落在三角形外部！',
        },
        {
          id: 'cir-2',
          prompt: '如果我們把操場三個據點改成「直角三角形」，那麼廣播塔（外心 O）應該直接設在哪裡最快？',
          choices: [
            '斜邊的中點',
            '直角頂點上',
            '較短股的中點',
            '三角形外部',
          ],
          answer: 0,
          hint: '半圓所對的圓周角是 90°，斜邊正好是外接圓的直徑！',
          explanation: '直角三角形的斜邊就是外接圓直徑，因此斜邊中點到三頂點等距，就是外心（R = 斜邊長 ÷ 2）。',
        },
      ],
    },
  ];

  function targetPoint(stage) {
    const { A, B, C } = stage.vertices;
    if (stage.id === 'incenter') return incenter(A, B, C);
    if (stage.id === 'centroid') return centroid(A, B, C);
    return circumcenter(A, B, C);
  }

  function stageRadius(stage) {
    const { A, B, C } = stage.vertices;
    if (stage.id === 'incenter') return inradius(A, B, C);
    if (stage.id === 'circumcenter') return circumradius(A, B, C);
    return 0;
  }

  function measure(stage, pos) {
    const { A, B, C } = stage.vertices;
    const p = { x: pos.x, z: pos.z };
    const target = targetPoint(stage);
    const error = dist(p, target);
    const inside = isInsideTriangle(p, A, B, C);
    const inRange = error <= TOLERANCE;
    // Warm-cold score: 1 at target, fades smoothly over 24m
    const proximity = Math.max(0, Math.min(1, 1 - error / 24));
    let radarLabel = '距離尚遠，繼續探索';
    if (inRange) radarLabel = '🎯 已鎖定目標點！請按下「插上測量旗」';
    else if (error <= 4.5) radarLabel = '🔥 非常接近！微調腳步讓數值收斂';
    else if (error <= 9) radarLabel = '🟠 方向正確，繼續靠近交點';
    else if (error <= 16) radarLabel = '🟡 感測到微弱訊號，可開啟輔助線';

    if (stage.id === 'incenter') {
      const dAB = pointToLineDistance(p, A, B);
      const dBC = pointToLineDistance(p, B, C);
      const dCA = pointToLineDistance(p, C, A);
      const spread = Math.max(dAB, dBC, dCA) - Math.min(dAB, dBC, dCA);
      return {
        target, error, inside, inRange, proximity, radarLabel, spread,
        metrics: [
          { label: '距邊 AB', value: `${dAB.toFixed(1)} m` },
          { label: '距邊 BC', value: `${dBC.toFixed(1)} m` },
          { label: '距邊 CA', value: `${dCA.toFixed(1)} m` },
        ],
        summary: inside
          ? `三邊垂直距離差值：${spread.toFixed(1)} m`
          : '⚠️ 目前在三角形外部（內心必在內部！）',
      };
    }

    if (stage.id === 'centroid') {
      const mBC = midpoint(B, C), mCA = midpoint(C, A), mAB = midpoint(A, B);
      const rA = dist(p, A) / Math.max(0.2, dist(p, mBC));
      const rB = dist(p, B) / Math.max(0.2, dist(p, mCA));
      const rC = dist(p, C) / Math.max(0.2, dist(p, mAB));
      const grid = toGrid(p);
      return {
        target, error, inside, inRange, proximity, radarLabel,
        metrics: [
          { label: '目前座標', value: `(${grid.x}, ${grid.y})` },
          { label: 'PA : PM₁', value: `${rA.toFixed(1)} : 1` },
          { label: 'PC : PM₃', value: `${rC.toFixed(1)} : 1` },
        ],
        summary: `B 線比值 PB : PM₂ = ${rB.toFixed(1)} : 1（目標 2.0 : 1）`,
      };
    }

    // Circumcenter
    const pA = dist(p, A), pB = dist(p, B), pC = dist(p, C);
    const spread = Math.max(pA, pB, pC) - Math.min(pA, pB, pC);
    return {
      target, error, inside, inRange, proximity, radarLabel, spread,
      metrics: [
        { label: '距頂點 A', value: `${pA.toFixed(1)} m` },
        { label: '距頂點 B', value: `${pB.toFixed(1)} m` },
        { label: '距頂點 C', value: `${pC.toFixed(1)} m` },
      ],
      summary: inside
        ? `目前在三角形內（差值 ${spread.toFixed(1)} m）— 試著往外部找！`
        : `目前在三角形外・三頂點距離差值：${spread.toFixed(1)} m`,
    };
  }

  function loadRecord(storage) {
    try {
      const raw = (storage || localStorage).getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed ? parsed : null;
    } catch {
      return null;
    }
  }

  function saveRecord(record, storage) {
    try {
      const store = storage || localStorage;
      const prev = loadRecord(store);
      const merged = {
        completedCount: (prev?.completedCount || 0) + 1,
        bestSeconds: prev?.bestSeconds ? Math.min(prev.bestSeconds, record.seconds) : record.seconds,
        bestAccuracy: prev?.bestAccuracy ? Math.max(prev.bestAccuracy, record.accuracy) : record.accuracy,
        lastAvgError: record.avgError,
        updatedAt: new Date().toISOString(),
      };
      store.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    } catch {
      return null;
    }
  }

  return {
    STORAGE_KEY,
    TOLERANCE,
    STAGES,
    GRID_ORIGIN,
    dist,
    midpoint,
    footOfPerpendicular,
    pointToLineDistance,
    isInsideTriangle,
    incenter,
    inradius,
    centroid,
    circumcenter,
    circumradius,
    toGrid,
    targetPoint,
    stageRadius,
    measure,
    loadRecord,
    saveRecord,
  };
})();
