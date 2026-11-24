import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import * as THREE from 'three';

function loadModel() {
  const dom = new JSDOM('<body></body>', { runScripts: 'outside-only', url: 'https://campus.test/' });
  const w = dom.window as any;
  w.eval(readFileSync('public/campus-explorer/outdoor-plan.js', 'utf8') + '\nwindow.__CampusOutdoorPlan = CampusOutdoorPlan;');
  w.eval(readFileSync('public/campus-explorer/three-centers-model.js', 'utf8'));
  return { dom, M: w.CampusThreeCentersModel, P: w.__CampusOutdoorPlan };
}

describe('CampusThreeCentersModel 幾何與關卡驗證', () => {
  it('第一關內心為精準 26-28-30 海倫三角形，內心 (-92, -21) 且內切圓半徑 8.0m', () => {
    const { dom, M } = loadModel();
    try {
      const stage = M.STAGES[0];
      const { A, B, C } = stage.vertices;
      expect(M.dist(A, B)).toBeCloseTo(28, 6);
      expect(M.dist(B, C)).toBeCloseTo(30, 6);
      expect(M.dist(C, A)).toBeCloseTo(26, 6);
      const ic = M.targetPoint(stage);
      expect(ic.x).toBeCloseTo(-92, 6);
      expect(ic.z).toBeCloseTo(-21, 6);
      expect(M.stageRadius(stage)).toBeCloseTo(8, 6);
      expect(M.isInsideTriangle(ic, A, B, C)).toBe(true);
      const m = M.measure(stage, ic);
      expect(m.inRange).toBe(true);
      expect(m.spread).toBeCloseTo(0, 6);
    } finally {
      dom.window.close();
    }
  });

  it('第二關重心為整數相對座標 (12, 9)，世界座標 (-92, -22) 且三中線比值 2:1', () => {
    const { dom, M } = loadModel();
    try {
      const stage = M.STAGES[1];
      const { A, B, C } = stage.vertices;
      const g = M.targetPoint(stage);
      expect(g.x).toBeCloseTo(-92, 6);
      expect(g.z).toBeCloseTo(-22, 6);
      expect(M.toGrid(g)).toEqual({ x: 12, y: 9 });
      expect(M.dist(g, A) / M.dist(g, M.midpoint(B, C))).toBeCloseTo(2, 6);
      expect(M.dist(g, B) / M.dist(g, M.midpoint(C, A))).toBeCloseTo(2, 6);
      expect(M.dist(g, C) / M.dist(g, M.midpoint(A, B))).toBeCloseTo(2, 6);
      expect(M.isInsideTriangle(g, A, B, C)).toBe(true);
    } finally {
      dom.window.close();
    }
  });

  it('第三關為鈍角三角形，外心 (-90, -25) 落在三角形外部且外接圓半徑 17.0m', () => {
    const { dom, M } = loadModel();
    try {
      const stage = M.STAGES[2];
      const { A, B, C } = stage.vertices;
      // Dot product at B must be negative (obtuse angle)
      const dotB = (A.x - B.x) * (C.x - B.x) + (A.z - B.z) * (C.z - B.z);
      expect(dotB).toBeLessThan(0);
      const o = M.targetPoint(stage);
      expect(o.x).toBeCloseTo(-90, 6);
      expect(o.z).toBeCloseTo(-25, 6);
      expect(M.stageRadius(stage)).toBeCloseTo(17, 6);
      expect(M.isInsideTriangle(o, A, B, C)).toBe(false);
      expect(M.dist(o, A)).toBeCloseTo(17, 6);
      expect(M.dist(o, B)).toBeCloseTo(17, 6);
      expect(M.dist(o, C)).toBeCloseTo(17, 6);
    } finally {
      dom.window.close();
    }
  });

  it('三關的所有頂點、起點與目標三心均位於大溪國中校園圍牆內之開闊操場', () => {
    const { dom, M, P } = loadModel();
    try {
      for (const stage of M.STAGES) {
        const pts = [stage.vertices.A, stage.vertices.B, stage.vertices.C, stage.spawn, M.targetPoint(stage)];
        for (const p of pts) {
          expect(P.perimeter.contains(p.x, p.z)).toBe(true);
          expect(P.reserved(p)).toBe(false);
        }
      }
    } finally {
      dom.window.close();
    }
  });
});

describe('CampusThreeCentersGame 3D 互動流程', () => {
  it('可啟動挑戰、遠距插旗提醒、定位插旗展開推理題，並在結束時清理 3D 場景', () => {
    vi.useFakeTimers();
    const dom = new JSDOM('<body></body>', { runScripts: 'outside-only', url: 'https://campus.test/' });
    const w = dom.window as any;
    const scene = new THREE.Scene();
    const playerPos = new THREE.Vector3(-82, 0, -16);
    w.THREE = THREE;
    w.HTMLCanvasElement.prototype.getContext = () => ({
      fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '', textBaseline: '',
      beginPath() {}, roundRect() {}, fill() {}, stroke() {}, fillText() {},
    });
    w.campusExplorer = {
      scene,
      clearNavigation: vi.fn(),
      resetManualInput: vi.fn(),
      setControlMode: vi.fn(),
      focusOverview: vi.fn(),
      getPlayerPosition: () => playerPos.clone(),
      teleportAvatar: vi.fn((x: number, y: number, z: number) => playerPos.set(x, y, z)),
    };
    try {
      w.eval(readFileSync('public/campus-explorer/three-centers-model.js', 'utf8'));
      w.eval(readFileSync('public/campus-explorer/three-centers-game.js', 'utf8'));

      const launch = w.document.getElementById('tc-launch');
      expect(launch).not.toBeNull();
      launch.click();

      expect(w.campusThreeCentersGame.isActive()).toBe(true);
      expect(scene.getObjectByName('three-centers-detective-group')).toBeTruthy();
      expect(w.campusExplorer.teleportAvatar).toHaveBeenCalledTimes(1);

      // Too far from incenter (-92, -21): planting should fail with feedback
      w.campusThreeCentersGame.update(0.016, 1);
      w.document.getElementById('tc-plant').click();
      expect(w.document.getElementById('tc-feedback').hidden).toBe(false);
      expect(w.campusThreeCentersGame.getState().stageSolved).toBe(false);

      // Move to exact incenter (-92, -21) and plant flag
      playerPos.set(-92, 0, -21);
      w.campusThreeCentersGame.update(0.016, 2);
      w.document.getElementById('tc-plant').click();
      expect(w.campusThreeCentersGame.getState().stageSolved).toBe(true);

      vi.advanceTimersByTime(1000);
      expect(w.document.getElementById('tc-modal').hidden).toBe(false);

      // Exit cleans up 3D overlay
      w.campusThreeCentersGame.stop();
      expect(w.campusThreeCentersGame.isActive()).toBe(false);
      expect(scene.getObjectByName('three-centers-detective-group')).toBeUndefined();
    } finally {
      vi.useRealTimers();
      dom.window.close();
    }
  });
});
