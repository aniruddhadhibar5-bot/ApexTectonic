"use client";

import { useEffect, useRef, useState } from "react";

type Locale = "en-US" | "ja-JP";
type GeoPoint = { lat: number; lon: number };
type ProjectedPoint = GeoPoint & { x: number; y: number; depth: number };

const continents: GeoPoint[][] = [
  [{ lat: 72, lon: -168 }, { lat: 70, lon: -140 }, { lat: 60, lon: -130 }, { lat: 55, lon: -124 }, { lat: 49, lon: -123 }, { lat: 43, lon: -124 }, { lat: 34, lon: -119 }, { lat: 30, lon: -115 }, { lat: 24, lon: -108 }, { lat: 17, lon: -100 }, { lat: 15, lon: -92 }, { lat: 20, lon: -87 }, { lat: 24, lon: -82 }, { lat: 30, lon: -81 }, { lat: 35, lon: -75 }, { lat: 43, lon: -67 }, { lat: 48, lon: -60 }, { lat: 54, lon: -58 }, { lat: 60, lon: -64 }, { lat: 63, lon: -70 }, { lat: 70, lon: -80 }, { lat: 74, lon: -110 }, { lat: 72, lon: -140 }],
  [{ lat: 12, lon: -81 }, { lat: 8, lon: -77 }, { lat: 2, lon: -79 }, { lat: -5, lon: -81 }, { lat: -15, lon: -76 }, { lat: -25, lon: -70 }, { lat: -35, lon: -72 }, { lat: -45, lon: -74 }, { lat: -53, lon: -70 }, { lat: -55, lon: -66 }, { lat: -40, lon: -62 }, { lat: -25, lon: -58 }, { lat: -10, lon: -70 }, { lat: 0, lon: -80 }, { lat: 8, lon: -80 }],
  [{ lat: 70, lon: -10 }, { lat: 72, lon: 25 }, { lat: 66, lon: 42 }, { lat: 58, lon: 52 }, { lat: 55, lon: 68 }, { lat: 58, lon: 82 }, { lat: 52, lon: 96 }, { lat: 55, lon: 110 }, { lat: 50, lon: 127 }, { lat: 43, lon: 135 }, { lat: 38, lon: 128 }, { lat: 34, lon: 120 }, { lat: 25, lon: 120 }, { lat: 20, lon: 110 }, { lat: 10, lon: 106 }, { lat: 5, lon: 100 }, { lat: 8, lon: 80 }, { lat: 20, lon: 72 }, { lat: 25, lon: 60 }, { lat: 35, lon: 50 }, { lat: 40, lon: 38 }, { lat: 45, lon: 30 }, { lat: 55, lon: 20 }, { lat: 60, lon: 10 }, { lat: 70, lon: -10 }],
  [{ lat: 36, lon: -17 }, { lat: 32, lon: -7 }, { lat: 24, lon: -17 }, { lat: 15, lon: -17 }, { lat: 5, lon: -10 }, { lat: -5, lon: 5 }, { lat: -12, lon: 12 }, { lat: -20, lon: 15 }, { lat: -30, lon: 18 }, { lat: -35, lon: 27 }, { lat: -30, lon: 33 }, { lat: -18, lon: 40 }, { lat: -5, lon: 42 }, { lat: 8, lon: 45 }, { lat: 12, lon: 51 }, { lat: 20, lon: 43 }, { lat: 30, lon: 32 }, { lat: 36, lon: 15 }, { lat: 36, lon: -17 }],
  [{ lat: 60, lon: 95 }, { lat: 70, lon: 130 }, { lat: 63, lon: 165 }, { lat: 55, lon: 153 }, { lat: 48, lon: 145 }, { lat: 42, lon: 143 }, { lat: 38, lon: 141 }, { lat: 34, lon: 136 }, { lat: 31, lon: 131 }, { lat: 35, lon: 125 }, { lat: 39, lon: 121 }, { lat: 45, lon: 125 }, { lat: 50, lon: 130 }, { lat: 54, lon: 140 }, { lat: 60, lon: 150 }, { lat: 60, lon: 95 }],
  [{ lat: -11, lon: 113 }, { lat: -17, lon: 120 }, { lat: -20, lon: 128 }, { lat: -17, lon: 136 }, { lat: -12, lon: 141 }, { lat: -13, lon: 145 }, { lat: -17, lon: 146 }, { lat: -23, lon: 153 }, { lat: -29, lon: 153 }, { lat: -36, lon: 150 }, { lat: -39, lon: 145 }, { lat: -35, lon: 138 }, { lat: -34, lon: 134 }, { lat: -28, lon: 129 }, { lat: -25, lon: 121 }, { lat: -19, lon: 115 }, { lat: -11, lon: 113 }],
];

const nodes = [
  { name: "TOKYO", lat: 35.7, lon: 139.7 },
  { name: "SINGAPORE", lat: 1.3, lon: 103.8 },
  { name: "SYDNEY", lat: -33.9, lon: 151.2 },
  { name: "SAN FRANCISCO", lat: 37.8, lon: -122.4 },
  { name: "LONDON", lat: 51.5, lon: -0.1 },
  { name: "REYKJAVIK", lat: 64.1, lon: -21.9 },
];

function drawGlobe(context: CanvasRenderingContext2D, width: number, height: number, time: number, selectedNodeIndex: number) {
  const radius = Math.max(50, Math.min(height * 0.37, width * 0.26));
  const cx = width * 0.5;
  const cy = height * 0.47;
  const rotation = (time * 0.000035) % (Math.PI * 2);
  const project = (point: GeoPoint): ProjectedPoint => {
    const lat = (point.lat * Math.PI) / 180;
    const lon = ((point.lon - 140) * Math.PI) / 180 + rotation;
    const depth = Math.cos(lat) * Math.cos(lon);
    return {
      ...point,
      x: cx + radius * Math.cos(lat) * Math.sin(lon),
      y: cy - radius * Math.sin(lat),
      depth,
    };
  };

  context.clearRect(0, 0, width, height);
  context.save();
  const atmosphere = context.createRadialGradient(cx - radius * 0.34, cy - radius * 0.38, radius * 0.05, cx, cy, radius * 1.2);
  atmosphere.addColorStop(0, "#123a4a");
  atmosphere.addColorStop(0.78, "#071a28");
  atmosphere.addColorStop(1, "#07131f");
  context.fillStyle = atmosphere;
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.beginPath();
  context.arc(cx, cy, radius, 0, Math.PI * 2);
  context.clip();

  const scan = (time * 0.00028) % (Math.PI * 2);
  const sweep = context.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  sweep.addColorStop(Math.max(0, (Math.sin(scan) + 1) / 2 - 0.04), "rgba(80, 235, 221, 0)");
  sweep.addColorStop(Math.min(1, (Math.sin(scan) + 1) / 2), "rgba(80, 235, 221, .09)");
  sweep.addColorStop(Math.min(1, (Math.sin(scan) + 1) / 2 + 0.06), "rgba(80, 235, 221, 0)");
  context.fillStyle = sweep;
  context.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

  context.strokeStyle = "rgba(82, 185, 196, .19)";
  context.lineWidth = 0.65;
  for (let latitude = -75; latitude <= 75; latitude += 15) {
    context.beginPath();
    let active = false;
    for (let longitude = -180; longitude <= 180; longitude += 2) {
      const point = project({ lat: latitude, lon: longitude });
      if (point.depth > 0) {
        if (!active) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
        active = true;
      } else active = false;
    }
    context.stroke();
  }
  for (let longitude = -180; longitude < 180; longitude += 15) {
    context.beginPath();
    let active = false;
    for (let latitude = -88; latitude <= 88; latitude += 2) {
      const point = project({ lat: latitude, lon: longitude });
      if (point.depth > 0) {
        if (!active) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
        active = true;
      } else active = false;
    }
    context.stroke();
  }

  context.lineWidth = 1.1;
  context.strokeStyle = "rgba(90, 202, 189, .66)";
  continents.forEach((continent) => {
    context.beginPath();
    let active = false;
    continent.forEach((coordinate, index) => {
      const from = project(coordinate);
      const to = project(continent[(index + 1) % continent.length]);
      if (from.depth > 0 && to.depth > 0) {
        if (!active) context.moveTo(from.x, from.y);
        context.lineTo(to.x, to.y);
        active = true;
      } else active = false;
      if (index === continent.length - 1) context.stroke();
    });
  });

  const projectedNodes = nodes.map((node) => project(node));
  const routeIndices = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [3, 5]];
  routeIndices.forEach(([fromIndex, toIndex], index) => {
    const from = projectedNodes[fromIndex];
    const to = projectedNodes[toIndex];
    if (from.depth <= 0 || to.depth <= 0) return;
    const curveX = (from.x + to.x) / 2 + (cx - (from.x + to.x) / 2) * 0.22;
    const curveY = (from.y + to.y) / 2 + (cy - (from.y + to.y) / 2) * 0.22;
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.quadraticCurveTo(curveX, curveY, to.x, to.y);
    context.strokeStyle = "rgba(78, 196, 194, .4)";
    context.lineWidth = 0.8;
    context.stroke();
    const pulse = (time * 0.00022 + index * 0.21) % 1;
    const inverse = 1 - pulse;
    const pointX = inverse * inverse * from.x + 2 * inverse * pulse * curveX + pulse * pulse * to.x;
    const pointY = inverse * inverse * from.y + 2 * inverse * pulse * curveY + pulse * pulse * to.y;
    context.beginPath();
    context.arc(pointX, pointY, 1.7, 0, Math.PI * 2);
    context.fillStyle = "#b5fff0";
    context.fill();
  });

  projectedNodes.forEach((point, index) => {
    if (point.depth <= 0) return;
    const active = index === selectedNodeIndex;
    context.beginPath();
    context.arc(point.x, point.y, active ? 2.8 : 1.8, 0, Math.PI * 2);
    context.fillStyle = active ? "#b5fff0" : "#62d8c6";
    context.fill();
    if (active) {
      context.beginPath();
      context.arc(point.x, point.y, 5 + (Math.sin(time * 0.003) + 1) * 2, 0, Math.PI * 2);
      context.strokeStyle = "rgba(105, 224, 195, .62)";
      context.lineWidth = 0.8;
      context.stroke();
    }
  });
  context.restore();

  context.strokeStyle = "rgba(101, 232, 224, .66)";
  context.lineWidth = 1;
  context.beginPath();
  context.arc(cx, cy, radius, -Math.PI * 0.38, Math.PI * 0.33);
  context.stroke();

  for (let orbit = 0; orbit < 2; orbit += 1) {
    context.save();
    context.translate(cx, cy);
    context.rotate((orbit === 0 ? -0.2 : 0.25) + time * (orbit === 0 ? 0.000018 : -0.000013));
    context.beginPath();
    context.ellipse(0, 0, radius * (1.22 + orbit * 0.12), radius * (0.32 + orbit * 0.06), 0, 0, Math.PI * 2);
    context.strokeStyle = orbit === 0 ? "rgba(79, 177, 190, .34)" : "rgba(72, 134, 168, .23)";
    context.lineWidth = 0.75;
    context.setLineDash(orbit === 0 ? [] : [2, 5]);
    context.stroke();
    context.setLineDash([]);
    const angle = time * (orbit === 0 ? 0.00023 : -0.00017) + orbit * Math.PI;
    const orbitX = Math.cos(angle) * radius * (1.22 + orbit * 0.12);
    const orbitY = Math.sin(angle) * radius * (0.32 + orbit * 0.06);
    context.beginPath();
    context.arc(orbitX, orbitY, 2, 0, Math.PI * 2);
    context.fillStyle = orbit === 0 ? "#9deedf" : "#82baff";
    context.fill();
    context.restore();
  }
  context.restore();
}

export default function LiveGlobe({ locale, label }: { locale: Locale; label: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasAvailable, setCanvasAvailable] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [selectedNodeIndex, setSelectedNodeIndex] = useState(0);
  const selectedNodeRef = useRef(0);

  useEffect(() => {
    selectedNodeRef.current = selectedNodeIndex;
  }, [selectedNodeIndex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) {
      setCanvasAvailable(false);
      return;
    }

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(motionPreference.matches);
    let frame = 0;
    let visible = false;
    let lastFrame = 0;
    let nodeTimer: number | undefined;
    const updateNodeTimer = () => {
      if (visible && !document.hidden && !motionPreference.matches && nodeTimer === undefined) {
        nodeTimer = window.setInterval(() => {
          setSelectedNodeIndex((current) => (current + 1) % nodes.length);
        }, 4800);
      } else if ((!visible || document.hidden || motionPreference.matches) && nodeTimer !== undefined) {
        window.clearInterval(nodeTimer);
        nodeTimer = undefined;
      }
    };
    const render = (time: number) => {
      frame = 0;
      if (!visible || document.hidden) return;
      if (!motionPreference.matches && time - lastFrame < 32) {
        frame = window.requestAnimationFrame(render);
        return;
      }
      lastFrame = time;
      const bounds = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.max(1, bounds.width);
      const height = Math.max(1, bounds.height);
      const pixelWidth = Math.floor(width * dpr);
      const pixelHeight = Math.floor(height * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawGlobe(context, width, height, motionPreference.matches ? 0 : time, selectedNodeRef.current);
      if (!motionPreference.matches) frame = window.requestAnimationFrame(render);
    };

    const schedule = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(render);
    };
    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) schedule();
        else if (frame) window.cancelAnimationFrame(frame);
        updateNodeTimer();
      })
      : null;
    if (observer) observer.observe(canvas);
    else {
      visible = true;
      schedule();
      updateNodeTimer();
    }
    const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(schedule) : null;
    resizeObserver?.observe(canvas);
    const onVisibilityChange = () => {
      if (document.hidden && frame) window.cancelAnimationFrame(frame);
      else schedule();
      updateNodeTimer();
    };
    const onMotionChange = () => {
      setReducedMotion(motionPreference.matches);
      schedule();
      updateNodeTimer();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    motionPreference.addEventListener("change", onMotionChange);

    return () => {
      observer?.disconnect();
      resizeObserver?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      motionPreference.removeEventListener("change", onMotionChange);
      if (frame) window.cancelAnimationFrame(frame);
      if (nodeTimer !== undefined) window.clearInterval(nodeTimer);
    };
  }, []);

  const ja = locale === "ja-JP";
  const selectedNode = nodes[selectedNodeIndex];
  return (
    <div className="globe-console" role="group" aria-label={label}>
      <div className="globe-telemetry">
        <div><span>{ja ? "領域" : "REGION"}</span><strong>JAPAN · PACIFIC RIM</strong></div>
        <div><span>{ja ? "接続" : "LINK"}</span><strong><i /> {ja ? "シミュレーション" : "SIMULATED"}</strong></div>
      </div>
      {canvasAvailable ? (
        <canvas
          ref={canvasRef}
          className="globe-canvas"
          role="img"
          aria-label={ja
            ? "日本を中心とした回転する地球儀。大陸、緯度経度線、仮想ノードと通信経路を表示"
            : "Rotating globe centered on Japan with continents, graticule, simulated network nodes and routes"}
        />
      ) : (
        <div className="globe-fallback" role="img" aria-label={label}>
          <span>JAPAN / 35.68°N 139.69°E</span><strong>NETWORK VIEW UNAVAILABLE</strong>
        </div>
      )}
      <div className="globe-data-strip">
        <div><span>{ja ? "選択ノード" : "FOCUS NODE"}</span><strong className="focus-node">{selectedNode.name}</strong><small>{selectedNode.lat.toFixed(1)}° / {selectedNode.lon.toFixed(1)}°</small></div>
        <div><span>{ja ? "稼働ノード" : "NODES"}</span><strong>06 <i>SIM</i></strong></div>
        <div><span>{ja ? "経路" : "ROUTES"}</span><strong>06 <i>SIM</i></strong></div>
        <div><span>{ja ? "活動" : "ACTIVITY"}</span><strong className="activity-value">NOMINAL</strong></div>
      </div>
      <div className="globe-disclaimer">{ja ? "すべてのネットワーク指標はデモ用の合成値です" : "NETWORK METRICS ARE SYNTHETIC DEMO VALUES"}</div>
      {reducedMotion && <span className="globe-static-note">{ja ? "静止表示" : "STATIC VIEW"}</span>}
    </div>
  );
}
