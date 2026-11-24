/* 3D Campus Three-Centers Spatial Detective Game Controller & Three.js Overlay */
(() => {
  const api = window.campusExplorer;
  const M = window.CampusThreeCentersModel;
  if (!api || !M || typeof THREE === 'undefined') return;

  const Y_GROUND = 0.14;
  let active = false;
  let stageIndex = 0;
  let completedStages = new Set();
  let stageErrors = {};
  let showAuxLines = false;
  let hintLevel = 0;
  let stageSolved = false;
  let startTime = 0;
  let quizCorrect = 0;
  let quizTotal = 0;
  let overviewActive = false;
  let lastMetricsHtml = '';
  let lastRadarText = '';
  let lastSummaryText = '';

  // 3D Scene overlay group
  let rootGroup = null;
  let auxGroup = null;
  let liveGroup = null;
  let celebrationGroup = null;
  let beaconMeshes = [];
  let flagGroup = null;
  let liveLines = [];

  // UI elements
  const launchBtn = document.createElement('button');
  launchBtn.id = 'tc-launch';
  launchBtn.type = 'button';
  launchBtn.innerHTML = '<span class="tc-launch-icon" aria-hidden="true">📐</span><span>三心空間偵探</span>';
  launchBtn.title = '開啟 3D 數學「三角形的三心」空間偵探挑戰';

  const hud = document.createElement('aside');
  hud.id = 'tc-hud';
  hud.hidden = true;
  hud.setAttribute('aria-label', '數學三心空間偵探面板');
  hud.innerHTML = `
    <div class="tc-header">
      <div>
        <span class="tc-badge" id="tc-badge"></span>
        <h2 class="tc-title" id="tc-title"></h2>
      </div>
      <div class="tc-header-actions">
        <button type="button" class="tc-icon-btn" id="tc-minimize" title="收合／展開面板">收合</button>
        <button type="button" class="tc-icon-btn" id="tc-exit" title="結束並回到一般 3D 導覽">結束 ×</button>
      </div>
    </div>
    <div class="tc-body">
      <div class="tc-steps" id="tc-steps"></div>
      <p class="tc-story" id="tc-story"></p>
      <p class="tc-goal" id="tc-goal"></p>
      <div class="tc-radar">
        <div class="tc-radar-bar"><div class="tc-radar-fill" id="tc-radar-fill"></div></div>
        <p class="tc-radar-status" id="tc-radar-status" role="status"></p>
        <div class="tc-metrics" id="tc-metrics"></div>
        <p class="tc-summary" id="tc-summary"></p>
      </div>
      <p class="tc-feedback" id="tc-feedback" hidden role="status"></p>
      <div class="tc-hint-box" id="tc-hint-box" hidden></div>
      <div class="tc-actions">
        <button type="button" class="tc-btn tc-btn-primary" id="tc-plant">🚩 插上測量旗（E）</button>
        <button type="button" class="tc-btn" id="tc-aux">📏 顯示幾何輔助線</button>
        <button type="button" class="tc-btn" id="tc-view">🦅 鳥瞰看幾何</button>
        <button type="button" class="tc-btn" id="tc-hint">💡 偵探提示</button>
        <button type="button" class="tc-btn" id="tc-reset-pos">🏃 回到偵查起點</button>
      </div>
    </div>
  `;

  const modal = document.createElement('div');
  modal.id = 'tc-modal';
  modal.hidden = true;
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = '<div class="tc-modal-card" id="tc-modal-card"></div>';

  document.body.append(launchBtn, hud, modal);

  const $ = id => hud.querySelector('#tc-' + id);
  const modalCard = modal.querySelector('#tc-modal-card');
  const currentStage = () => M.STAGES[stageIndex];

  function disposeObject(obj) {
    if (!obj) return;
    obj.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) {
          if (mat.map) mat.map.dispose();
          mat.dispose();
        }
      }
    });
  }

  function clearSceneOverlay() {
    if (rootGroup) {
      api.scene.remove(rootGroup);
      disposeObject(rootGroup);
    }
    rootGroup = null;
    auxGroup = null;
    liveGroup = null;
    celebrationGroup = null;
    beaconMeshes = [];
    flagGroup = null;
    liveLines = [];
  }

  function makeLabelSprite(text, bgColor) {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(11, 20, 26, 0.88)';
      ctx.strokeStyle = bgColor;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(8, 12, 304, 72, 18);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 30px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 160, 48);
    }
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(5.4, 1.6, 1);
    return sprite;
  }

  function makeTubeLine(p1, p2, y, radius, color, opacity = 0.92) {
    const start = new THREE.Vector3(p1.x, y, p1.z);
    const end = new THREE.Vector3(p2.x, y, p2.z);
    const len = start.distanceTo(end);
    if (len < 0.05) return new THREE.Object3D();
    const geom = new THREE.CylinderGeometry(radius, radius, len, 8, 1);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(start).lerp(end, 0.5);
    const dir = new THREE.Vector3().subVectors(end, start).normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return mesh;
  }

  function makeCircleRing(center, radius, y, color) {
    const pts = [];
    const segs = 72;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(center.x + Math.cos(a) * radius, y, center.z + Math.sin(a) * radius));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
  }

  function makeFilledTriangle(a, b, c, y, color, opacity) {
    const geom = new THREE.BufferGeometry();
    const verts = new Float32Array([
      a.x, y, a.z,
      b.x, y, b.z,
      c.x, y, c.z,
    ]);
    geom.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
    return new THREE.Mesh(geom, mat);
  }

  function extendRay(from, through, length) {
    const dx = through.x - from.x, dz = through.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    return { x: from.x + (dx / d) * length, z: from.z + (dz / d) * length };
  }

  function buildStageGeometry(stage) {
    clearSceneOverlay();
    rootGroup = new THREE.Group();
    rootGroup.name = 'three-centers-detective-group';

    const { A, B, C } = stage.vertices;
    const color = stage.accentHex;

    // Translucent ground triangle fill + bright perimeter beams
    rootGroup.add(makeFilledTriangle(A, B, C, Y_GROUND - 0.03, color, 0.14));
    rootGroup.add(makeTubeLine(A, B, Y_GROUND, 0.14, color, 0.95));
    rootGroup.add(makeTubeLine(B, C, Y_GROUND, 0.14, color, 0.95));
    rootGroup.add(makeTubeLine(C, A, Y_GROUND, 0.14, color, 0.95));

    // Glowing vertex beacons A, B, C
    for (const [key, v] of Object.entries(stage.vertices)) {
      const beacon = new THREE.Group();
      beacon.position.set(v.x, 0, v.z);
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.65, 0.85, 0.25, 16),
        new THREE.MeshBasicMaterial({ color })
      );
      base.position.y = 0.15;
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 5.2, 12),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 })
      );
      pole.position.y = 2.6;
      const orb = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.55, 0),
        new THREE.MeshBasicMaterial({ color })
      );
      orb.position.y = 5.4;
      const label = makeLabelSprite(v.label || key, stage.accent);
      label.position.set(0, 6.7, 0);
      beacon.add(base, pole, orb, label);
      rootGroup.add(beacon);
      beaconMeshes.push(orb);
    }

    // Auxiliary geometric construction lines (toggled by player)
    auxGroup = new THREE.Group();
    auxGroup.visible = showAuxLines;
    const target = M.targetPoint(stage);

    if (stage.id === 'incenter') {
      // Angle bisector rays from A and B through I
      const rayA = extendRay(A, target, 34);
      const rayB = extendRay(B, target, 34);
      auxGroup.add(makeTubeLine(A, rayA, Y_GROUND + 0.08, 0.07, 0xfef08a, 0.85));
      auxGroup.add(makeTubeLine(B, rayB, Y_GROUND + 0.08, 0.07, 0xfef08a, 0.85));
    } else if (stage.id === 'centroid') {
      // Midpoints and medians
      const mBC = M.midpoint(B, C), mCA = M.midpoint(C, A), mAB = M.midpoint(A, B);
      for (const [v, m] of [[A, mBC], [B, mCA], [C, mAB]]) {
        auxGroup.add(makeTubeLine(v, m, Y_GROUND + 0.08, 0.07, 0x6ee7b7, 0.85));
        const dot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.45, 0.45, 0.18, 14),
          new THREE.MeshBasicMaterial({ color: 0x6ee7b7 })
        );
        dot.position.set(m.x, Y_GROUND + 0.1, m.z);
        auxGroup.add(dot);
      }
    } else {
      // Perpendicular bisectors of AB and BC extending out to O (and slightly past)
      const pairs = [[A, B], [B, C], [C, A]];
      for (const [u, v] of pairs) {
        const mid = M.midpoint(u, v);
        const end = extendRay(mid, target, M.dist(mid, target) + 6);
        const start = extendRay(target, mid, M.dist(mid, target) + 4);
        auxGroup.add(makeTubeLine(start, end, Y_GROUND + 0.08, 0.07, 0x7dd3fc, 0.88));
        const dot = new THREE.Mesh(
          new THREE.CylinderGeometry(0.4, 0.4, 0.16, 12),
          new THREE.MeshBasicMaterial({ color: 0x7dd3fc })
        );
        dot.position.set(mid.x, Y_GROUND + 0.1, mid.z);
        auxGroup.add(dot);
      }
    }
    rootGroup.add(auxGroup);

    // Live measurement lines from player feet (updated every frame)
    liveGroup = new THREE.Group();
    liveLines = [];
    for (let i = 0; i < 3; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.78 })
      );
      liveGroup.add(line);
      liveLines.push(line);
    }
    rootGroup.add(liveGroup);

    // Celebration overlay (shown upon planting flag accurately)
    celebrationGroup = new THREE.Group();
    celebrationGroup.visible = false;
    rootGroup.add(celebrationGroup);

    api.scene.add(rootGroup);
  }

  function showCelebrationGeometry(stage) {
    if (!celebrationGroup) return;
    while (celebrationGroup.children.length) {
      const c = celebrationGroup.children.pop();
      disposeObject(c);
    }
    const { A, B, C } = stage.vertices;
    const center = M.targetPoint(stage);

    // Golden survey flag at discovered center
    flagGroup = new THREE.Group();
    flagGroup.position.set(center.x, 0, center.z);
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 4.6, 10),
      new THREE.MeshBasicMaterial({ color: 0xfef08a })
    );
    pole.position.y = 2.3;
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(1.7, 0.95, 0.08),
      new THREE.MeshBasicMaterial({ color: stage.accentHex })
    );
    banner.position.set(0.9, 4.0, 0);
    const label = makeLabelSprite(`★ ${stage.short} 已定位`, stage.accent);
    label.position.set(0, 5.5, 0);
    flagGroup.add(pole, banner, label);
    celebrationGroup.add(flagGroup);

    if (stage.id === 'incenter') {
      const r = M.stageRadius(stage);
      celebrationGroup.add(makeCircleRing(center, r, Y_GROUND + 0.16, 0xfef08a));
      celebrationGroup.add(makeCircleRing(center, r - 0.18, Y_GROUND + 0.16, 0xf59e0b));
      for (const [u, v] of [[A, B], [B, C], [C, A]]) {
        const foot = M.footOfPerpendicular(center, u, v);
        celebrationGroup.add(makeTubeLine(center, foot, Y_GROUND + 0.15, 0.09, 0xfef08a, 0.95));
      }
    } else if (stage.id === 'centroid') {
      const mBC = M.midpoint(B, C), mCA = M.midpoint(C, A), mAB = M.midpoint(A, B);
      const slices = [
        [center, A, mAB, 0x10b981],
        [center, mAB, B, 0x34d399],
        [center, B, mBC, 0x059669],
        [center, mBC, C, 0x6ee7b7],
        [center, C, mCA, 0x047857],
        [center, mCA, A, 0x10b981],
      ];
      for (const [p1, p2, p3, col] of slices) {
        celebrationGroup.add(makeFilledTriangle(p1, p2, p3, Y_GROUND + 0.04, col, 0.32));
      }
      for (const [v, m] of [[A, mBC], [B, mCA], [C, mAB]]) {
        celebrationGroup.add(makeTubeLine(v, center, Y_GROUND + 0.16, 0.12, 0xfef08a, 0.95));
        celebrationGroup.add(makeTubeLine(center, m, Y_GROUND + 0.16, 0.09, 0x38bdf8, 0.95));
      }
    } else {
      const R = M.stageRadius(stage);
      celebrationGroup.add(makeCircleRing(center, R, Y_GROUND + 0.16, 0x38bdf8));
      celebrationGroup.add(makeCircleRing(center, R - 0.2, Y_GROUND + 0.16, 0xbae6fd));
      for (const v of [A, B, C]) {
        celebrationGroup.add(makeTubeLine(center, v, Y_GROUND + 0.15, 0.1, 0x7dd3fc, 0.95));
      }
    }

    if (auxGroup) auxGroup.visible = true;
    celebrationGroup.visible = true;
  }

  function renderSteps() {
    $('steps').innerHTML = M.STAGES.map((s, idx) => {
      const cls = completedStages.has(s.id) ? 'tc-step done' : idx === stageIndex ? 'tc-step active' : 'tc-step';
      const mark = completedStages.has(s.id) ? '✓ ' : `${idx + 1}. `;
      return `<div class="${cls}">${mark}${s.short}</div>`;
    }).join('');
  }

  function setFeedback(text, isSuccess = false) {
    const el = $('feedback');
    if (!text) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.className = isSuccess ? 'tc-feedback success' : 'tc-feedback';
    el.textContent = text;
  }

  function syncAuxButton() {
    const stage = currentStage();
    const btn = $('aux');
    btn.textContent = showAuxLines ? '📏 隱藏幾何輔助線' : `📏 ${stage.hintLinesLabel}`;
    btn.classList.toggle('tc-btn-active', showAuxLines);
    if (auxGroup) auxGroup.visible = showAuxLines || stageSolved;
  }

  function syncViewButton() {
    const btn = $('view');
    btn.textContent = overviewActive ? '🚶 切回步行實測' : '🦅 鳥瞰看幾何';
    btn.classList.toggle('tc-btn-active', overviewActive);
  }

  function loadStage(index, teleport = true) {
    stageIndex = index;
    showAuxLines = false;
    hintLevel = 0;
    stageSolved = false;
    overviewActive = false;
    const stage = currentStage();

    hud.style.setProperty('--tc-accent', stage.accent);
    $('badge').textContent = stage.badge;
    $('title').textContent = stage.title;
    $('story').textContent = stage.story;
    $('goal').textContent = stage.goalRule;
    $('hint-box').hidden = true;
    $('hint-box').textContent = '';
    $('plant').textContent = '🚩 插上測量旗（E）';
    $('plant').disabled = false;
    setFeedback('');
    renderSteps();
    syncAuxButton();
    syncViewButton();
    buildStageGeometry(stage);

    if (teleport && api.teleportAvatar) {
      api.teleportAvatar(stage.spawn.x, stage.spawn.y, stage.spawn.z, stage.spawn.yaw);
    }
  }

  function openStageQuiz(stage) {
    let qIndex = 0;
    let answered = false;

    function renderQuestion() {
      const q = stage.questions[qIndex];
      answered = false;
      modalCard.innerHTML = `
        <span class="tc-badge" style="background:${stage.accent}">${stage.badge} · 幾何推理 ${qIndex + 1}/${stage.questions.length}</span>
        <h2>🎯 已在 3D 操場成功定位 ${stage.short}！</h2>
        <p class="tc-question-text">${q.prompt}</p>
        <div class="tc-choices">
          ${q.choices.map((c, i) => `<button type="button" class="tc-choice" data-i="${i}">${String.fromCharCode(65 + i)}. ${c}</button>`).join('')}
        </div>
        <div class="tc-feedback" id="tc-q-fb" hidden></div>
        <div class="tc-modal-footer">
          <button type="button" class="tc-btn" id="tc-q-hint">💡 觀念提示</button>
          <button type="button" class="tc-btn tc-btn-primary" id="tc-q-next" hidden style="grid-column:auto;background:${stage.accent}">
            ${qIndex === stage.questions.length - 1 ? (stageIndex === M.STAGES.length - 1 ? '領取偵探結業證書 ↗' : '前往下一關 ↗') : '下一題 →'}
          </button>
        </div>
      `;

      const fb = modalCard.querySelector('#tc-q-fb');
      const nextBtn = modalCard.querySelector('#tc-q-next');
      const hintBtn = modalCard.querySelector('#tc-q-hint');

      hintBtn.onclick = () => {
        fb.hidden = false;
        fb.className = 'tc-feedback';
        fb.textContent = `提示：${q.hint}`;
      };

      modalCard.querySelectorAll('.tc-choice').forEach(btn => {
        btn.onclick = () => {
          if (answered) return;
          const choice = Number(btn.dataset.i);
          quizTotal++;
          if (choice === q.answer) {
            answered = true;
            quizCorrect++;
            btn.classList.add('correct');
            modalCard.querySelectorAll('.tc-choice').forEach(b => (b.disabled = true));
            fb.hidden = false;
            fb.className = 'tc-feedback success';
            fb.textContent = `✅ 答對了！${q.explanation}`;
            nextBtn.hidden = false;
          } else {
            btn.classList.add('wrong');
            btn.disabled = true;
            fb.hidden = false;
            fb.className = 'tc-feedback';
            fb.textContent = `再想一下！${q.hint}`;
          }
        };
      });

      nextBtn.onclick = () => {
        if (qIndex < stage.questions.length - 1) {
          qIndex++;
          renderQuestion();
        } else {
          modal.hidden = true;
          completedStages.add(stage.id);
          renderSteps();
          if (stageIndex < M.STAGES.length - 1) {
            loadStage(stageIndex + 1, true);
          } else {
            openVictoryModal();
          }
        }
      };
    }

    modal.hidden = false;
    api.resetManualInput?.();
    renderQuestion();
  }

  function openVictoryModal() {
    const seconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));
    const errs = Object.values(stageErrors);
    const avgError = errs.length ? Number((errs.reduce((a, b) => a + b, 0) / errs.length).toFixed(2)) : 0;
    const accuracy = quizTotal ? Math.round((quizCorrect / quizTotal) * 100) : 100;
    const record = M.saveRecord({ seconds, accuracy, avgError });

    modalCard.innerHTML = `
      <span class="tc-badge" style="background:#f59e0b">🏆 全關卡達成 · 大溪 3D 幾何空間偵探</span>
      <h2>恭喜完成「三角形的三心」3D 實境推理！</h2>
      <p class="tc-story">你親自在 3D 大溪國中操場完成了內心、重心與外心的空間量測與幾何推理。</p>
      <div class="tc-cert-stats">
        <div class="tc-cert-stat"><small>通關時間</small><strong>${seconds} 秒</strong></div>
        <div class="tc-cert-stat"><small>平均插旗誤差</small><strong>${avgError} m</strong></div>
        <div class="tc-cert-stat"><small>推理答對率</small><strong>${accuracy}%</strong></div>
      </div>
      <div class="tc-takeaways">
        ${M.STAGES.map(s => `<p><strong>${s.short}：</strong>${s.takeaway}</p>`).join('')}
      </div>
      ${record ? `<p class="tc-summary">本機最佳紀錄：最快 ${record.bestSeconds} 秒・最高答對率 ${record.bestAccuracy}%（僅存於此瀏覽器，不含個資）</p>` : ''}
      <div class="tc-modal-footer">
        <button type="button" class="tc-btn" id="tc-replay">🔄 重新挑戰</button>
        <button type="button" class="tc-btn" id="tc-close-win">留在此 3D 畫面</button>
        <button type="button" class="tc-btn tc-btn-primary" id="tc-fireworks" style="grid-column:auto;background:#f59e0b">🎆 施放 80 週年破關煙火秀</button>
      </div>
    `;

    modal.hidden = false;
    modalCard.querySelector('#tc-replay').onclick = () => {
      modal.hidden = true;
      startGame();
    };
    modalCard.querySelector('#tc-close-win').onclick = () => {
      modal.hidden = true;
    };
    modalCard.querySelector('#tc-fireworks').onclick = () => {
      modal.hidden = true;
      window.campusAnniversary?.start?.();
    };
  }

  function plantFlag() {
    if (!active || !modal.hidden || stageSolved) return;
    const stage = currentStage();
    const pos = api.getPlayerPosition?.();
    if (!pos) return;
    const m = M.measure(stage, pos);
    if (m.inRange) {
      stageSolved = true;
      stageErrors[stage.id] = m.error;
      showCelebrationGeometry(stage);
      setFeedback(`🎯 精準鎖定 ${stage.short}（誤差僅 ${m.error.toFixed(1)} m）！正在展開幾何光陣…`, true);
      $('plant').textContent = '✓ 已定位，開啟推理題';
      $('plant').disabled = true;
      // Show bird's-eye briefly or open quiz after a short visual beat
      setTimeout(() => {
        if (active && stageSolved) openStageQuiz(stage);
      }, 900);
    } else {
      const hintMsg = stage.id === 'circumcenter' && m.inside
        ? `目前距離外心還差 ${m.error.toFixed(1)} m！別忘了鈍角三角形的外心在「三角形外部」喔！`
        : stage.id === 'incenter' && !m.inside
          ? `目前在三角形外面（距內心 ${m.error.toFixed(1)} m），內心必定在三角形內部！`
          : `再靠近一點！目前距離 ${stage.short} 還有 ${m.error.toFixed(1)} m（需 ≤ ${M.TOLERANCE} m），可開啟幾何輔助線協助定位。`;
      setFeedback(hintMsg, false);
    }
  }

  function startGame() {
    active = true;
    completedStages = new Set();
    stageErrors = {};
    quizCorrect = 0;
    quizTotal = 0;
    startTime = Date.now();
    document.body.classList.add('tc-game-active');
    hud.hidden = false;
    hud.classList.remove('tc-minimized');
    $('minimize').textContent = '收合';
    api.clearNavigation?.();
    loadStage(0, true);
  }

  function stopGame() {
    active = false;
    overviewActive = false;
    document.body.classList.remove('tc-game-active');
    hud.hidden = true;
    modal.hidden = true;
    clearSceneOverlay();
  }

  // Event bindings
  launchBtn.addEventListener('click', startGame);
  $('exit').addEventListener('click', stopGame);
  $('minimize').addEventListener('click', () => {
    const min = hud.classList.toggle('tc-minimized');
    $('minimize').textContent = min ? '展開' : '收合';
  });
  $('plant').addEventListener('click', plantFlag);
  $('aux').addEventListener('click', () => {
    showAuxLines = !showAuxLines;
    syncAuxButton();
  });
  $('hint').addEventListener('click', () => {
    const stage = currentStage();
    hintLevel = Math.min(stage.hints.length, hintLevel + 1);
    const box = $('hint-box');
    box.hidden = false;
    box.innerHTML = stage.hints.slice(0, hintLevel).map((h, i) => `<div><strong>提示 ${i + 1}：</strong>${h}</div>`).join('');
  });
  $('view').addEventListener('click', () => {
    const stage = currentStage();
    overviewActive = !overviewActive;
    if (overviewActive) {
      api.focusOverview?.(stage.overview.x, stage.overview.z, stage.overview.height);
    } else {
      api.setControlMode?.('avatar');
    }
    syncViewButton();
  });
  $('reset-pos').addEventListener('click', () => {
    const stage = currentStage();
    overviewActive = false;
    syncViewButton();
    api.teleportAvatar?.(stage.spawn.x, stage.spawn.y, stage.spawn.z, stage.spawn.yaw);
  });

  window.addEventListener('keydown', event => {
    if (!active) return;
    if (event.key === 'Escape' && !modal.hidden) {
      modal.hidden = true;
      return;
    }
    if (!modal.hidden || document.activeElement?.tagName === 'INPUT') return;
    if (event.key === 'e' || event.key === 'E') {
      event.preventDefault();
      plantFlag();
    }
  });

  function update(delta, elapsed) {
    if (!active || !rootGroup) return;

    // Spin floating vertex crystals & bob flag
    for (const orb of beaconMeshes) {
      orb.rotation.y = elapsed * 1.4;
      orb.position.y = 5.4 + Math.sin(elapsed * 2.5) * 0.25;
    }
    if (flagGroup && celebrationGroup?.visible) {
      flagGroup.rotation.y = Math.sin(elapsed * 1.8) * 0.18;
    }

    const pos = api.getPlayerPosition?.();
    if (!pos) return;
    const stage = currentStage();
    const m = M.measure(stage, pos);

    // Update live 3D measurement rays from player's feet
    if (liveLines.length === 3) {
      const { A, B, C } = stage.vertices;
      const targets = stage.id === 'incenter'
        ? [M.footOfPerpendicular(pos, A, B), M.footOfPerpendicular(pos, B, C), M.footOfPerpendicular(pos, C, A)]
        : [A, B, C];
      const footY = Math.max(0.2, pos.y + 0.25);
      for (let i = 0; i < 3; i++) {
        const attr = liveLines[i].geometry.attributes.position;
        attr.setXYZ(0, pos.x, footY, pos.z);
        attr.setXYZ(1, targets[i].x, Y_GROUND + 0.15, targets[i].z);
        attr.needsUpdate = true;
        liveLines[i].material.color.setHex(m.inRange ? 0x10b981 : stage.accentHex);
      }
    }

    // Update HUD telemetry (only mutate DOM when displayed values change)
    $('radar-fill').style.width = `${Math.round(m.proximity * 100)}%`;
    const radarText = stageSolved ? `✓ ${stage.short} 已完成定位！` : m.radarLabel;
    if (radarText !== lastRadarText) {
      $('radar-status').textContent = radarText;
      lastRadarText = radarText;
    }
    const metricsHtml = m.metrics.map(item => `<div class="tc-metric"><small>${item.label}</small><strong>${item.value}</strong></div>`).join('');
    if (metricsHtml !== lastMetricsHtml) {
      $('metrics').innerHTML = metricsHtml;
      lastMetricsHtml = metricsHtml;
    }
    if (m.summary !== lastSummaryText) {
      $('summary').textContent = m.summary;
      lastSummaryText = m.summary;
    }
    $('plant').classList.toggle('tc-ready', m.inRange && !stageSolved);
  }

  window.campusThreeCentersGame = {
    start: startGame,
    stop: stopGame,
    update,
    plantFlag,
    isActive: () => active,
    getState: () => ({ active, stageIndex, stageId: currentStage().id, completed: [...completedStages], showAuxLines, stageSolved }),
  };
})();
