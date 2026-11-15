import { LevelBlueprint, MilestoneLandmarkId, PrestigeTierDef } from '../data/landmarks';

export type CityThemeId = 'metropolis' | 'cyberpunk' | 'sunset' | 'ecocity';

interface TowerPalette {
  fill: string;
  fillAlt: string;
  trim: string;
  accent: string;
  window: string;
}

export function resolveTowerPalette(
  blueprint: LevelBlueprint,
  theme: CityThemeId,
  prestige: PrestigeTierDef
): TowerPalette {
  let base: TowerPalette = {
    fill: blueprint.primaryColor,
    fillAlt: blueprint.secondaryColor,
    trim: blueprint.accentColor,
    accent: blueprint.accentColor,
    window: blueprint.windowTint,
  };

  if (theme === 'cyberpunk') {
    base = {
      fill: '#2e1065',
      fillAlt: '#172554',
      trim: '#06b6d4',
      accent: '#f43f5e',
      window: '#22d3ee',
    };
  } else if (theme === 'sunset') {
    base = {
      fill: '#701a75',
      fillAlt: '#4c0519',
      trim: '#fb923c',
      accent: '#f472b6',
      window: '#fed7aa',
    };
  } else if (theme === 'ecocity') {
    base = {
      fill: '#064e3b',
      fillAlt: '#14532d',
      trim: '#34d399',
      accent: '#a7f3d0',
      window: '#6ee7b7',
    };
  }

  // Prestige Tier visual overlays (Level 76+)
  if (prestige.id === 'gold_blueprint') {
    return {
      fill: '#78350f',
      fillAlt: '#451a03',
      trim: '#fbbf24',
      accent: '#fde047',
      window: '#fef08a',
    };
  }
  if (prestige.id === 'neon_cyber') {
    return {
      fill: '#1e1b4b',
      fillAlt: '#090d16',
      trim: '#f43f5e',
      accent: '#22d3ee',
      window: '#38bdf8',
    };
  }
  if (prestige.id === 'orbital_chrome') {
    return {
      fill: '#64748b',
      fillAlt: '#1e293b',
      trim: '#f8fafc',
      accent: '#c084fc',
      window: '#e0f2fe',
    };
  }

  return base;
}

function drawMilestoneLandmark(
  ctx: CanvasRenderingContext2D,
  id: MilestoneLandmarkId,
  W: number,
  H: number,
  pal: TowerPalette,
  timestamp: number,
  mode: 'blueprint' | 'solid',
  isMini: boolean
) {
  const isBp = mode === 'blueprint';

  if (id === 'flatiron') {
    // Triangular steel-frame wedge building tapering toward northern prow edge
    const leftX = -W * 0.34;
    const prowX = W * 0.04;
    const rightX = W * 0.34;
    const roofY = -H * 0.9;

    const traceMain = () => {
      ctx.beginPath();
      ctx.moveTo(leftX, 0);
      ctx.lineTo(leftX * 0.88, roofY);
      ctx.lineTo(prowX * 0.6, roofY - H * 0.03);
      ctx.lineTo(rightX * 0.88, roofY);
      ctx.lineTo(rightX, 0);
      ctx.closePath();
    };

    if (isBp) {
      traceMain();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(prowX, 0);
      ctx.lineTo(prowX * 0.6, roofY - H * 0.03);
      ctx.stroke();
      ctx.strokeRect(leftX * 0.94, roofY - 5, (rightX - leftX) * 0.94, 6);
    } else {
      // Sunlit west facade
      ctx.fillStyle = pal.fill;
      ctx.beginPath();
      ctx.moveTo(leftX, 0);
      ctx.lineTo(leftX * 0.88, roofY);
      ctx.lineTo(prowX * 0.6, roofY - H * 0.03);
      ctx.lineTo(prowX, 0);
      ctx.closePath();
      ctx.fill();

      // Deep shaded east wedge facet
      ctx.fillStyle = pal.fillAlt;
      ctx.beginPath();
      ctx.moveTo(prowX, 0);
      ctx.lineTo(prowX * 0.6, roofY - H * 0.03);
      ctx.lineTo(rightX * 0.88, roofY);
      ctx.lineTo(rightX, 0);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1.2;
      traceMain();
      ctx.stroke();

      // Beaux-Arts horizontal limestone cornice bands & windows
      if (!isMini) {
        const rows = 9;
        for (let r = 1; r < rows; r++) {
          const ry = (roofY * r) / rows;
          ctx.fillStyle = pal.window;
          ctx.fillRect(leftX * 0.82, ry, (prowX - leftX) * 0.72, 3);
          ctx.fillStyle = 'rgba(254, 240, 138, 0.5)';
          ctx.fillRect(prowX + 4, ry, (rightX - prowX) * 0.7, 3);
        }
      }
      // Projecting Beaux-Arts roof cornice
      ctx.fillStyle = pal.trim;
      ctx.fillRect(leftX * 0.94, roofY - 5, (rightX - leftX) * 0.94, 5);
    }
    return;
  }

  if (id === 'eiffel_tower') {
    const baseHalf = W * 0.44;
    const d1Y = -H * 0.24;
    const d1Half = W * 0.28;
    const d2Y = -H * 0.48;
    const d2Half = W * 0.16;
    const d3Y = -H * 0.87;
    const d3Half = W * 0.045;

    const traceOuter = () => {
      ctx.beginPath();
      ctx.moveTo(-baseHalf, 0);
      ctx.quadraticCurveTo(-baseHalf * 0.65, d1Y * 0.9, -d1Half, d1Y);
      ctx.quadraticCurveTo(-d1Half * 0.72, (d1Y + d2Y) * 0.5, -d2Half, d2Y);
      ctx.quadraticCurveTo(-d2Half * 0.5, (d2Y + d3Y) * 0.52, -d3Half, d3Y);
      ctx.lineTo(d3Half, d3Y);
      ctx.quadraticCurveTo(d2Half * 0.5, (d2Y + d3Y) * 0.52, d2Half, d2Y);
      ctx.quadraticCurveTo(d1Half * 0.72, (d1Y + d2Y) * 0.5, d1Half, d1Y);
      ctx.quadraticCurveTo(baseHalf * 0.65, d1Y * 0.9, baseHalf, 0);
      ctx.closePath();
    };

    if (isBp) {
      traceOuter();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, baseHalf * 0.45, Math.PI, 0, false);
      ctx.stroke();
      ctx.strokeRect(-d1Half - 4, d1Y - 4, (d1Half + 4) * 2, 7);
      ctx.strokeRect(-d2Half - 3, d2Y - 4, (d2Half + 3) * 2, 6);
      ctx.beginPath();
      ctx.moveTo(0, d3Y);
      ctx.lineTo(0, -H);
      ctx.stroke();
    } else {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-baseHalf, 0);
      ctx.quadraticCurveTo(-baseHalf * 0.65, d1Y * 0.9, -d1Half, d1Y);
      ctx.quadraticCurveTo(-d1Half * 0.72, (d1Y + d2Y) * 0.5, -d2Half, d2Y);
      ctx.quadraticCurveTo(-d2Half * 0.5, (d2Y + d3Y) * 0.52, -d3Half, d3Y);
      ctx.lineTo(d3Half, d3Y);
      ctx.quadraticCurveTo(d2Half * 0.5, (d2Y + d3Y) * 0.52, d2Half, d2Y);
      ctx.quadraticCurveTo(d1Half * 0.72, (d1Y + d2Y) * 0.5, d1Half, d1Y);
      ctx.quadraticCurveTo(baseHalf * 0.65, d1Y * 0.9, baseHalf, 0);
      ctx.closePath();
      const archW = baseHalf * 0.48;
      ctx.moveTo(-archW, 0);
      ctx.quadraticCurveTo(0, d1Y * 1.12, archW, 0);
      ctx.closePath();

      const g = ctx.createLinearGradient(0, 0, 0, -H);
      g.addColorStop(0, pal.fillAlt);
      g.addColorStop(0.55, pal.fill);
      g.addColorStop(1, pal.trim);
      ctx.fillStyle = g;
      ctx.fill('evenodd');

      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = 1.4;
      traceOuter();
      ctx.stroke();

      if (!isMini) {
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.28)';
        ctx.lineWidth = 1;
        for (let seg = 0; seg < 6; seg++) {
          const sy0 = d2Y + ((d3Y - d2Y) * seg) / 6;
          const sy1 = d2Y + ((d3Y - d2Y) * (seg + 1)) / 6;
          const hw0 = d2Half + ((d3Half - d2Half) * seg) / 6;
          const hw1 = d2Half + ((d3Half - d2Half) * (seg + 1)) / 6;
          ctx.beginPath();
          ctx.moveTo(-hw0, sy0);
          ctx.lineTo(hw1, sy1);
          ctx.moveTo(hw0, sy0);
          ctx.lineTo(-hw1, sy1);
          ctx.stroke();
        }
      }

      ctx.fillStyle = pal.fillAlt;
      ctx.fillRect(-d1Half - 4, d1Y - 4, (d1Half + 4) * 2, 7);
      ctx.fillRect(-d2Half - 3, d2Y - 4, (d2Half + 3) * 2, 6);
      ctx.fillStyle = pal.window;
      ctx.fillRect(-d1Half - 2, d1Y - 2, (d1Half + 2) * 2, 2);
      ctx.fillRect(-d2Half - 1, d2Y - 2, (d2Half + 1) * 2, 2);

      ctx.fillStyle = pal.trim;
      ctx.beginPath();
      ctx.arc(0, d3Y, d3Half + 2, Math.PI, 0, false);
      ctx.fill();
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, d3Y - 2);
      ctx.lineTo(0, -H + 2);
      ctx.stroke();
      ctx.restore();
    }
    return;
  }

  if (id === 'chrysler') {
    const tiers = [
      { y0: 0, y1: -H * 0.16, w: W * 0.72 },
      { y0: -H * 0.16, y1: -H * 0.64, w: W * 0.48 },
      { y0: -H * 0.64, y1: -H * 0.71, w: W * 0.36 },
    ];
    tiers.forEach((t, idx) => {
      const th = Math.abs(t.y1 - t.y0);
      if (isBp) {
        ctx.strokeRect(-t.w / 2, t.y1, t.w, th);
      } else {
        ctx.fillStyle = idx % 2 === 0 ? pal.fillAlt : pal.fill;
        ctx.fillRect(-t.w / 2, t.y1, t.w, th);
        ctx.strokeStyle = 'rgba(255,255,255,0.22)';
        ctx.strokeRect(-t.w / 2, t.y1, t.w, th);
        if (!isMini && idx < 2) {
          const rows = Math.max(2, Math.floor(th / 11));
          ctx.fillStyle = pal.window;
          for (let r = 0; r < rows; r++) {
            ctx.fillRect(-t.w / 2 + 5, t.y1 + 4 + r * 10, t.w - 10, 3);
          }
        }
      }
    });

    // Terraced Nirosta Stainless Steel Sunburst Crown Arches
    const crownBaseY = -H * 0.71;
    for (let a = 0; a < 5; a++) {
      const archR = W * (0.18 - a * 0.028);
      const archY = crownBaseY - a * (H * 0.036);
      if (isBp) {
        ctx.beginPath();
        ctx.arc(0, archY, archR, Math.PI, 0, false);
        ctx.stroke();
      } else {
        ctx.fillStyle = a % 2 === 0 ? '#cbd5e1' : '#94a3b8';
        ctx.beginPath();
        ctx.arc(0, archY, archR, Math.PI, 0, false);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = pal.trim;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        // Triangular sunburst windows
        if (!isMini) {
          ctx.fillStyle = pal.window;
          for (let ang = -2; ang <= 2; ang++) {
            const rad = -Math.PI / 2 + ang * 0.36;
            const wx = Math.cos(rad) * archR * 0.72;
            const wy = archY + Math.sin(rad) * archR * 0.72;
            ctx.fillRect(wx - 1.5, wy - 1.5, 3, 3);
          }
        }
      }
    }
    // Vertex Needle Spire
    if (isBp) {
      ctx.beginPath();
      ctx.moveTo(0, -H * 0.87);
      ctx.lineTo(0, -H);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -H * 0.87);
      ctx.lineTo(0, -H + 2);
      ctx.stroke();
    }
    return;
  }

  if (id === 'empire_state') {
    const tiers = [
      { y0: 0, y1: -H * 0.14, w: W * 0.9 },
      { y0: -H * 0.14, y1: -H * 0.24, w: W * 0.68 },
      { y0: -H * 0.24, y1: -H * 0.64, w: W * 0.5 },
      { y0: -H * 0.64, y1: -H * 0.75, w: W * 0.35 },
      { y0: -H * 0.75, y1: -H * 0.82, w: W * 0.24 },
      { y0: -H * 0.82, y1: -H * 0.91, w: W * 0.12 },
    ];
    tiers.forEach((t, idx) => {
      const th = Math.abs(t.y1 - t.y0);
      if (isBp) {
        ctx.strokeRect(-t.w / 2, t.y1, t.w, th);
      } else {
        const g = ctx.createLinearGradient(-t.w / 2, 0, t.w / 2, 0);
        g.addColorStop(0, pal.fillAlt);
        g.addColorStop(0.5, pal.fill);
        g.addColorStop(1, pal.fillAlt);
        ctx.fillStyle = g;
        ctx.fillRect(-t.w / 2, t.y1, t.w, th);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.strokeRect(-t.w / 2, t.y1, t.w, th);
        if (!isMini && idx < 4) {
          const rows = Math.max(2, Math.floor(th / 11));
          ctx.fillStyle = pal.window;
          for (let r = 0; r < rows; r++) {
            const wy = t.y1 + 4 + r * 10;
            const wc = Math.max(2, Math.floor(t.w / 14));
            for (let c = 0; c < wc; c++) {
              const wx = -t.w / 2 + 6 + c * ((t.w - 12) / Math.max(1, wc - 1)) - 2;
              if ((r + c) % 3 !== 0) ctx.fillRect(wx, wy, 3.5, 5);
            }
          }
        }
        ctx.fillStyle = pal.trim;
        ctx.fillRect(-t.w / 2 - 1, t.y1, t.w + 2, 2);
      }
    });
    if (isBp) {
      ctx.beginPath();
      ctx.moveTo(0, -H * 0.91);
      ctx.lineTo(0, -H);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -H * 0.91);
      ctx.lineTo(0, -H + 3);
      ctx.stroke();
      ctx.fillStyle = Math.floor(timestamp / 450) % 2 === 0 ? '#ef4444' : '#7f1d1d';
      ctx.beginPath();
      ctx.arc(0, -H + 2, isMini ? 2 : 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (id === 'space_needle') {
    // Tripod hourglass legs + flying-saucer observation deck + tall spire
    const saucerY = -H * 0.72;
    const saucerW = W * 0.56;
    const baseHalf = W * 0.24;
    const waistHalf = W * 0.075;
    const waistY = -H * 0.44;

    const drawLegs = () => {
      ctx.beginPath();
      ctx.moveTo(-baseHalf, 0);
      ctx.quadraticCurveTo(-waistHalf, waistY, -W * 0.14, saucerY);
      ctx.lineTo(W * 0.14, saucerY);
      ctx.quadraticCurveTo(waistHalf, waistY, baseHalf, 0);
      ctx.closePath();
    };

    if (isBp) {
      drawLegs();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, saucerY, saucerW / 2, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, saucerY - 12);
      ctx.lineTo(0, -H);
      ctx.stroke();
    } else {
      ctx.fillStyle = pal.fillAlt;
      drawLegs();
      ctx.fill();
      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Central elevator core column
      ctx.fillStyle = pal.fill;
      ctx.fillRect(-4, saucerY, 8, Math.abs(saucerY));

      // Saucer observation deck + Halo Ring
      ctx.fillStyle = pal.fillAlt;
      ctx.beginPath();
      ctx.ellipse(0, saucerY + 4, saucerW * 0.42, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.fill;
      ctx.beginPath();
      ctx.ellipse(0, saucerY - 3, saucerW / 2, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.trim;
      ctx.stroke();
      ctx.fillStyle = pal.window;
      ctx.fillRect(-saucerW * 0.38, saucerY - 4, saucerW * 0.76, 3);

      // Dome & Spire
      ctx.fillStyle = pal.trim;
      ctx.beginPath();
      ctx.arc(0, saucerY - 8, W * 0.11, Math.PI, 0, false);
      ctx.fill();
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, saucerY - 12);
      ctx.lineTo(0, -H + 2);
      ctx.stroke();
    }
    return;
  }

  if (id === 'transamerica') {
    // Steep 4-sided pyramid + 2 opposing vertical external elevator wings mid-shaft
    const baseHalf = W * 0.34;
    const tipY = -H;
    const wingY0 = -H * 0.38;
    const wingY1 = -H * 0.78;
    const wingW = W * 0.08;

    const tracePyramid = () => {
      ctx.beginPath();
      ctx.moveTo(-baseHalf, 0);
      ctx.lineTo(-W * 0.03, tipY);
      ctx.lineTo(W * 0.03, tipY);
      ctx.lineTo(baseHalf, 0);
      ctx.closePath();
    };

    if (isBp) {
      tracePyramid();
      ctx.stroke();
      ctx.strokeRect(-W * 0.23, wingY1, wingW, Math.abs(wingY1 - wingY0));
      ctx.strokeRect(W * 0.23 - wingW, wingY1, wingW, Math.abs(wingY1 - wingY0));
    } else {
      ctx.fillStyle = pal.fill;
      tracePyramid();
      ctx.fill();
      // Right shaded pyramid facet
      ctx.fillStyle = pal.fillAlt;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, tipY);
      ctx.lineTo(W * 0.03, tipY);
      ctx.lineTo(baseHalf, 0);
      ctx.closePath();
      ctx.fill();

      // External vertical elevator wings
      ctx.fillStyle = pal.fillAlt;
      ctx.fillRect(-W * 0.22, wingY1, wingW, Math.abs(wingY1 - wingY0));
      ctx.fillRect(W * 0.22 - wingW, wingY1, wingW, Math.abs(wingY1 - wingY0));
      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-W * 0.22, wingY1, wingW, Math.abs(wingY1 - wingY0));
      ctx.strokeRect(W * 0.22 - wingW, wingY1, wingW, Math.abs(wingY1 - wingY0));

      if (!isMini) {
        ctx.fillStyle = pal.window;
        for (let r = 1; r <= 9; r++) {
          const wy = -H * 0.08 * r;
          const hw = baseHalf * (1 - r * 0.085);
          ctx.fillRect(-hw + 5, wy, (hw - 5) * 2, 2.5);
        }
      }
      // Illuminated glass spire tip
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(-W * 0.03, -H * 0.88);
      ctx.lineTo(0, tipY);
      ctx.lineTo(W * 0.03, -H * 0.88);
      ctx.closePath();
      ctx.fill();
    }
    return;
  }

  if (id === 'cn_tower') {
    // Tapered shaft + bulbous SkyPod + high broadcast spire
    const shaftY = -H * 0.72;
    const podY = -H * 0.6;
    const podW = W * 0.34;

    const traceShaft = () => {
      ctx.beginPath();
      ctx.moveTo(-W * 0.16, 0);
      ctx.lineTo(-W * 0.055, shaftY);
      ctx.lineTo(W * 0.055, shaftY);
      ctx.lineTo(W * 0.16, 0);
      ctx.closePath();
    };

    if (isBp) {
      traceShaft();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, podY, podW / 2, 13, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, shaftY);
      ctx.lineTo(0, -H);
      ctx.stroke();
    } else {
      ctx.fillStyle = pal.fill;
      traceShaft();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.stroke();

      // Main 7-story SkyPod collar
      ctx.fillStyle = pal.fillAlt;
      ctx.beginPath();
      ctx.ellipse(0, podY, podW / 2, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = pal.window;
      ctx.fillRect(-podW * 0.42, podY - 2, podW * 0.84, 4);

      // Upper Space Deck collar
      ctx.fillStyle = pal.fill;
      ctx.fillRect(-W * 0.08, shaftY - 4, W * 0.16, 10);

      // Red/White broadcast mast
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, shaftY - 4);
      ctx.lineTo(0, -H + 3);
      ctx.stroke();
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.arc(0, -H + 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (id === 'bank_of_china') {
    // I. M. Pei asymmetrical triangular prism crystal segments + diagonal X-bracing
    const w = W * 0.62;
    const h1 = -H * 0.42;
    const h2 = -H * 0.66;
    const h3 = -H * 0.88;

    const traceBody = () => {
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(-w / 2, h1);
      ctx.lineTo(-w * 0.16, h2);
      ctx.lineTo(-w * 0.16, h3);
      ctx.lineTo(w * 0.16, h2);
      ctx.lineTo(w / 2, h1);
      ctx.lineTo(w / 2, 0);
      ctx.closePath();
    };

    if (isBp) {
      traceBody();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-w * 0.12, h3);
      ctx.lineTo(-w * 0.12, -H);
      ctx.moveTo(w * 0.08, h2 + 8);
      ctx.lineTo(w * 0.08, -H * 0.94);
      ctx.stroke();
    } else {
      ctx.fillStyle = pal.fill;
      traceBody();
      ctx.fill();
      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // Iconic structural triangular X-bracing lines
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(w / 2, h1);
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(-w / 2, h1);
      ctx.moveTo(-w / 2, h1);
      ctx.lineTo(w * 0.16, h2);
      ctx.moveTo(w / 2, h1);
      ctx.lineTo(-w * 0.16, h2);
      ctx.moveTo(-w * 0.16, h2);
      ctx.lineTo(w * 0.16, h2);
      ctx.stroke();

      // Twin asymmetrical spires
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-w * 0.12, h3);
      ctx.lineTo(-w * 0.12, -H + 2);
      ctx.moveTo(w * 0.08, h2 + 8);
      ctx.lineTo(w * 0.08, -H * 0.94);
      ctx.stroke();
    }
    return;
  }

  if (id === 'petronas') {
    const span = W * 0.48;
    const baseTw = W * 0.3;
    [-span * 0.5, span * 0.5].forEach((cx) => {
      const tiers = [
        { y0: 0, y1: -H * 0.55, w: baseTw },
        { y0: -H * 0.55, y1: -H * 0.72, w: baseTw * 0.74 },
        { y0: -H * 0.72, y1: -H * 0.83, w: baseTw * 0.46 },
      ];
      tiers.forEach((t, tIdx) => {
        const th = Math.abs(t.y1 - t.y0);
        if (isBp) {
          ctx.strokeRect(cx - t.w / 2, t.y1, t.w, th);
        } else {
          ctx.fillStyle = tIdx % 2 === 0 ? pal.fill : pal.fillAlt;
          ctx.fillRect(cx - t.w / 2, t.y1, t.w, th);
          ctx.strokeStyle = 'rgba(255,255,255,0.28)';
          ctx.strokeRect(cx - t.w / 2, t.y1, t.w, th);
          if (!isMini) {
            const rows = Math.max(2, Math.floor(th / 10));
            ctx.fillStyle = pal.window;
            for (let r = 0; r < rows; r++) {
              ctx.fillRect(cx - t.w / 2 + 3, t.y1 + 4 + r * 9, t.w - 6, 2.5);
            }
          }
          if (tIdx === 2) {
            ctx.fillStyle = pal.trim;
            ctx.beginPath();
            ctx.moveTo(cx - t.w / 2, t.y1);
            ctx.lineTo(cx, -H * 0.9);
            ctx.lineTo(cx + t.w / 2, t.y1);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = '#f8fafc';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(cx, -H * 0.9);
            ctx.lineTo(cx, -H + 3);
            ctx.stroke();
          }
        }
      });
      if (isBp) {
        ctx.beginPath();
        ctx.moveTo(cx, -H * 0.83);
        ctx.lineTo(cx, -H);
        ctx.stroke();
      }
    });

    const bridgeY = -H * 0.44;
    const bridgeX0 = -span * 0.5 + baseTw * 0.48;
    const bridgeX1 = span * 0.5 - baseTw * 0.48;
    if (isBp) {
      ctx.strokeRect(bridgeX0, bridgeY - 4, bridgeX1 - bridgeX0, 8);
    } else {
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(bridgeX0, bridgeY - 4, bridgeX1 - bridgeX0, 8);
      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(bridgeX0, bridgeY + 14);
      ctx.lineTo(0, bridgeY + 4);
      ctx.lineTo(bridgeX1, bridgeY + 14);
      ctx.stroke();
    }
    return;
  }

  if (id === 'burj_al_arab') {
    // Billowing spinnaker sail curve + exoskeleton spine + cantilevered helipad
    const spineX = -W * 0.14;
    const topY = -H * 0.88;
    const traceSail = () => {
      ctx.beginPath();
      ctx.moveTo(spineX, 0);
      ctx.lineTo(spineX, topY);
      ctx.quadraticCurveTo(W * 0.48, -H * 0.56, spineX + W * 0.14, 0);
      ctx.closePath();
    };

    if (isBp) {
      traceSail();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(spineX, topY);
      ctx.lineTo(spineX, -H);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#e2e8f0';
      traceSail();
      ctx.fill();
      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Horizontal fiberglass sail ribs
      if (!isMini) {
        ctx.strokeStyle = pal.fill;
        ctx.lineWidth = 1.2;
        for (let i = 1; i <= 7; i++) {
          const ry = (topY * i) / 8;
          ctx.beginPath();
          ctx.moveTo(spineX, ry);
          ctx.lineTo(spineX + W * (0.34 - Math.abs(i - 3.5) * 0.05), ry);
          ctx.stroke();
        }
      }

      // Exoskeleton mast & cantilevered helipad near top
      ctx.fillStyle = pal.fillAlt;
      ctx.fillRect(spineX - 5, topY, 10, Math.abs(topY));
      ctx.fillStyle = pal.trim;
      ctx.fillRect(spineX + 3, -H * 0.78, W * 0.18, 4);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(spineX, topY);
      ctx.lineTo(spineX, -H + 3);
      ctx.stroke();
    }
    return;
  }

  if (id === 'taipei_101') {
    const podH = H * 0.18;
    const podW0 = W * 0.64;
    const podW1 = W * 0.42;
    if (isBp) {
      ctx.beginPath();
      ctx.moveTo(-podW0 / 2, 0);
      ctx.lineTo(-podW1 / 2, -podH);
      ctx.lineTo(podW1 / 2, -podH);
      ctx.lineTo(podW0 / 2, 0);
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.fillStyle = pal.fillAlt;
      ctx.beginPath();
      ctx.moveTo(-podW0 / 2, 0);
      ctx.lineTo(-podW1 / 2, -podH);
      ctx.lineTo(podW1 / 2, -podH);
      ctx.lineTo(podW0 / 2, 0);
      ctx.closePath();
      ctx.fill();
    }

    const numSegs = 8;
    const segH = (H * 0.84 - podH) / numSegs;
    for (let s = 0; s < numSegs; s++) {
      const yBot = -podH - s * segH;
      const yTop = yBot - segH;
      const wBot = podW1 * 0.86;
      const wTop = podW1 * 1.06;
      if (isBp) {
        ctx.beginPath();
        ctx.moveTo(-wBot / 2, yBot);
        ctx.lineTo(-wTop / 2, yTop);
        ctx.lineTo(wTop / 2, yTop);
        ctx.lineTo(wBot / 2, yBot);
        ctx.closePath();
        ctx.stroke();
      } else {
        ctx.fillStyle = s % 2 === 0 ? pal.fill : pal.fillAlt;
        ctx.beginPath();
        ctx.moveTo(-wBot / 2, yBot);
        ctx.lineTo(-wTop / 2, yTop);
        ctx.lineTo(wTop / 2, yTop);
        ctx.lineTo(wBot / 2, yBot);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = pal.trim;
        ctx.lineWidth = 1;
        ctx.stroke();
        if (!isMini) {
          ctx.fillStyle = '#fbbf24';
          ctx.beginPath();
          ctx.arc(0, (yBot + yTop) * 0.5, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    if (isBp) {
      ctx.beginPath();
      ctx.moveTo(0, -H * 0.84);
      ctx.lineTo(0, -H);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -H * 0.84);
      ctx.lineTo(0, -H + 2);
      ctx.stroke();
    }
    return;
  }

  if (id === 'shard') {
    const shards = [
      { x0: -W * 0.34, x1: -W * 0.13, topY: -H * 0.72, right0: -W * 0.05, right1: -W * 0.01 },
      { x0: -W * 0.2, x1: -W * 0.025, topY: -H, right0: W * 0.14, right1: W * 0.025 },
      { x0: W * 0.02, x1: W * 0.05, topY: -H * 0.9, right0: W * 0.32, right1: W * 0.12 },
    ];
    shards.forEach((sh, idx) => {
      const traceShard = () => {
        ctx.beginPath();
        ctx.moveTo(sh.x0, 0);
        ctx.lineTo(sh.x1, sh.topY);
        ctx.lineTo(sh.right1, sh.topY + 10);
        ctx.lineTo(sh.right0, 0);
        ctx.closePath();
      };
      if (isBp) {
        traceShard();
        ctx.stroke();
      } else {
        const g = ctx.createLinearGradient(sh.x0, 0, sh.right1, sh.topY);
        g.addColorStop(0, idx === 1 ? pal.fill : pal.fillAlt);
        g.addColorStop(1, idx === 1 ? pal.trim : pal.fill);
        ctx.fillStyle = g;
        traceShard();
        ctx.fill();
        ctx.strokeStyle = 'rgba(245, 208, 254, 0.55)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    });
    return;
  }

  if (id === 'one_wtc') {
    // Rotating square-to-octagon faceted glass prism + communications ring + spire
    const baseHalf = W * 0.3;
    const roofHalf = W * 0.2;
    const roofY = -H * 0.78;
    const traceBody = () => {
      ctx.beginPath();
      ctx.moveTo(-baseHalf, 0);
      ctx.lineTo(-roofHalf, roofY);
      ctx.lineTo(roofHalf, roofY);
      ctx.lineTo(baseHalf, 0);
      ctx.closePath();
    };
    if (isBp) {
      traceBody();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-baseHalf, 0);
      ctx.lineTo(0, roofY);
      ctx.lineTo(baseHalf, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, roofY);
      ctx.lineTo(0, -H);
      ctx.stroke();
    } else {
      ctx.fillStyle = pal.fill;
      traceBody();
      ctx.fill();
      // Rotating chamfered glass triangle center facet
      ctx.fillStyle = pal.trim;
      ctx.globalAlpha = 0.28;
      ctx.beginPath();
      ctx.moveTo(-baseHalf * 0.75, 0);
      ctx.lineTo(0, roofY);
      ctx.lineTo(baseHalf * 0.75, 0);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = 'rgba(186, 230, 253, 0.6)';
      ctx.lineWidth = 1.2;
      traceBody();
      ctx.stroke();
      // Communications ring + tall needle spire
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(-roofHalf * 0.6, roofY - 6, roofHalf * 1.2, 6);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, roofY - 6);
      ctx.lineTo(0, -H + 2);
      ctx.stroke();
    }
    return;
  }

  if (id === 'shanghai_tower') {
    const baseHalf = W * 0.34;
    const topHalf = W * 0.16;
    const crownY = -H * 0.92;
    const traceHelix = () => {
      ctx.beginPath();
      ctx.moveTo(-baseHalf, 0);
      ctx.bezierCurveTo(-baseHalf * 1.05, -H * 0.32, -topHalf * 1.45, -H * 0.65, -topHalf, crownY);
      ctx.lineTo(0, -H);
      ctx.lineTo(topHalf * 0.92, -H * 0.95);
      ctx.bezierCurveTo(topHalf * 1.35, -H * 0.62, baseHalf * 0.95, -H * 0.32, baseHalf, 0);
      ctx.closePath();
    };
    if (isBp) {
      traceHelix();
      ctx.stroke();
    } else {
      const g = ctx.createLinearGradient(-baseHalf, 0, baseHalf, -H);
      g.addColorStop(0, pal.fillAlt);
      g.addColorStop(0.5, pal.fill);
      g.addColorStop(1, pal.trim);
      ctx.fillStyle = g;
      traceHelix();
      ctx.fill();
      ctx.strokeStyle = 'rgba(207, 250, 254, 0.55)';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      if (!isMini) {
        ctx.save();
        traceHelix();
        ctx.clip();
        ctx.strokeStyle = pal.window;
        ctx.lineWidth = 1.2;
        for (let i = -3; i <= 5; i++) {
          const sy = -H * 0.14 * i;
          ctx.beginPath();
          ctx.moveTo(-baseHalf, sy);
          ctx.quadraticCurveTo(0, sy - H * 0.14, baseHalf, sy - H * 0.34);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    return;
  }

  // burj_khalifa
  const setbacks = [
    { y0: 0, y1: -H * 0.18, w: W * 0.84, offset: 0 },
    { y0: -H * 0.18, y1: -H * 0.34, w: W * 0.64, offset: -W * 0.035 },
    { y0: -H * 0.34, y1: -H * 0.49, w: W * 0.48, offset: W * 0.028 },
    { y0: -H * 0.49, y1: -H * 0.63, w: W * 0.34, offset: -W * 0.018 },
    { y0: -H * 0.63, y1: -H * 0.76, w: W * 0.22, offset: W * 0.012 },
    { y0: -H * 0.76, y1: -H * 0.86, w: W * 0.13, offset: 0 },
  ];
  setbacks.forEach((s) => {
    const sh = Math.abs(s.y1 - s.y0);
    const x = s.offset - s.w / 2;
    if (isBp) {
      ctx.strokeRect(x, s.y1, s.w, sh);
    } else {
      ctx.fillStyle = pal.fill;
      ctx.fillRect(x, s.y1, s.w, sh);
      ctx.strokeStyle = pal.trim;
      ctx.lineWidth = 1.4;
      ctx.strokeRect(x, s.y1, s.w, sh);
      if (!isMini) {
        ctx.fillStyle = pal.window;
        const rows = Math.max(1, Math.floor(sh / 9));
        for (let r = 0; r < rows; r++) {
          ctx.fillRect(x + 3, s.y1 + 3 + r * 8, Math.max(2, s.w - 6), 1.8);
        }
      }
    }
  });
  if (isBp) {
    ctx.beginPath();
    ctx.moveTo(0, -H * 0.86);
    ctx.lineTo(0, -H);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#e0e7ff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -H * 0.86);
    ctx.lineTo(0, -H + 2);
    ctx.stroke();
  }
}

function drawProceduralIntermediateTower(
  ctx: CanvasRenderingContext2D,
  blueprint: LevelBlueprint,
  W: number,
  H: number,
  pal: TowerPalette,
  mode: 'blueprint' | 'solid',
  isMini: boolean
) {
  const proc = blueprint.procedural!;
  const isBp = mode === 'blueprint';
  const baseW = W * 0.68;
  const topW = baseW * proc.taperRatio;
  const crownBaseY = -H * 0.84;

  const traceSilhouette = () => {
    ctx.beginPath();
    if (proc.silhouette === 'tapered') {
      ctx.moveTo(-baseW / 2, 0);
      ctx.lineTo(-topW / 2, crownBaseY);
      ctx.lineTo(topW / 2, crownBaseY);
      ctx.lineTo(baseW / 2, 0);
      ctx.closePath();
    } else if (proc.silhouette === 'diagrid') {
      ctx.moveTo(-baseW * 0.44, 0);
      ctx.quadraticCurveTo(-baseW * 0.56, crownBaseY * 0.45, -topW * 0.48, crownBaseY);
      ctx.lineTo(topW * 0.48, crownBaseY);
      ctx.quadraticCurveTo(baseW * 0.56, crownBaseY * 0.45, baseW * 0.44, 0);
      ctx.closePath();
    } else if (proc.silhouette === 'twin_core') {
      // Stepped podium supporting twin asymmetrical towers linked by skydeck
      const gap = W * 0.06;
      const colW = baseW * 0.36;
      ctx.rect(-baseW / 2, -H * 0.22, baseW, H * 0.22);
      ctx.rect(-gap - colW, crownBaseY, colW, Math.abs(crownBaseY) - H * 0.22);
      ctx.rect(gap, crownBaseY + H * 0.08, colW, Math.abs(crownBaseY + H * 0.08) - H * 0.22);
    } else if (proc.silhouette === 'cantilevered') {
      const segs = 4;
      const segH = Math.abs(crownBaseY) / segs;
      for (let s = 0; s < segs; s++) {
        const shift = (s % 2 === 0 ? -1 : 1) * W * 0.05;
        const sw = baseW * (1 - s * 0.11);
        ctx.rect(shift - sw / 2, -(s + 1) * segH, sw, segH);
      }
    } else {
      // stepped_setbacks
      const segs = proc.setbackCount;
      const segH = Math.abs(crownBaseY) / segs;
      for (let s = 0; s < segs; s++) {
        const sw = baseW - ((baseW - topW) * s) / segs;
        ctx.rect(-sw / 2, -(s + 1) * segH, sw, segH);
      }
    }
  };

  if (isBp) {
    traceSilhouette();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, crownBaseY);
    ctx.lineTo(0, -H);
    ctx.stroke();
    return;
  }

  // Solid architectural body
  const g = ctx.createLinearGradient(-baseW / 2, 0, baseW / 2, crownBaseY);
  g.addColorStop(0, pal.fillAlt);
  g.addColorStop(0.5, pal.fill);
  g.addColorStop(1, pal.fillAlt);
  ctx.fillStyle = g;
  traceSilhouette();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Procedural Facade Texture Clipped Inside Silhouette
  if (!isMini) {
    ctx.save();
    traceSilhouette();
    ctx.clip();

    if (proc.facade === 'vertical_fins') {
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 1.5;
      for (let fx = -baseW / 2 + 6; fx < baseW / 2; fx += 9) {
        ctx.beginPath();
        ctx.moveTo(fx, 0);
        ctx.lineTo(fx, crownBaseY);
        ctx.stroke();
      }
    } else if (proc.facade === 'diagonal_lattice') {
      ctx.strokeStyle = pal.trim;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 1.2;
      for (let dy = 0; dy > crownBaseY; dy -= 22) {
        ctx.beginPath();
        ctx.moveTo(-baseW / 2, dy);
        ctx.lineTo(baseW / 2, dy - 22);
        ctx.moveTo(baseW / 2, dy);
        ctx.lineTo(-baseW / 2, dy - 22);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else if (proc.facade === 'chevron_ribs') {
      ctx.strokeStyle = pal.trim;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 1.3;
      for (let dy = -10; dy > crownBaseY; dy -= 18) {
        ctx.beginPath();
        ctx.moveTo(-baseW / 2, dy);
        ctx.lineTo(0, dy - 10);
        ctx.lineTo(baseW / 2, dy);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      // curtain_grid / horizontal_bands
      ctx.fillStyle = pal.window;
      for (let wy = -12; wy > crownBaseY + 6; wy -= 11) {
        ctx.fillRect(-baseW * 0.42, wy, baseW * 0.84, proc.facade === 'horizontal_bands' ? 3 : 2);
      }
    }
    ctx.restore();
  }

  // Procedural Spire Crown
  ctx.fillStyle = pal.trim;
  ctx.strokeStyle = pal.trim;
  if (proc.crown === 'chamfered_crown') {
    ctx.beginPath();
    ctx.moveTo(-topW / 2, crownBaseY);
    ctx.lineTo(topW / 2, crownBaseY - H * 0.08);
    ctx.lineTo(topW / 2, crownBaseY);
    ctx.closePath();
    ctx.fill();
  } else if (proc.crown === 'crystalline_peak') {
    ctx.beginPath();
    ctx.moveTo(-topW / 2, crownBaseY);
    ctx.lineTo(0, -H);
    ctx.lineTo(topW / 2, crownBaseY);
    ctx.closePath();
    ctx.fill();
  } else if (proc.crown === 'helipad_halo') {
    ctx.fillRect(-topW * 0.56, crownBaseY - 4, topW * 1.12, 4);
    ctx.beginPath();
    ctx.ellipse(0, crownBaseY - 12, topW * 0.48, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (proc.crown === 'twin_antennas') {
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-topW * 0.24, crownBaseY);
    ctx.lineTo(-topW * 0.24, -H + 4);
    ctx.moveTo(topW * 0.24, crownBaseY);
    ctx.lineTo(topW * 0.24, -H);
    ctx.stroke();
  } else {
    // needle
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, crownBaseY);
    ctx.lineTo(0, -H + 2);
    ctx.stroke();
  }
}

export function drawSkyscraperBlueprint(
  ctx: CanvasRenderingContext2D,
  blueprint: LevelBlueprint,
  W: number,
  H: number,
  fillRatio: number,
  theme: CityThemeId,
  timestamp: number,
  options?: { isMini?: boolean; alpha?: number }
) {
  const pal = resolveTowerPalette(blueprint, theme, blueprint.prestige);
  const clamped = Math.max(0, Math.min(1, fillRatio));
  const isMini = Boolean(options?.isMini);

  // 1. CAD Blueprint Ghost Guide for remaining unbuilt tiers
  if (!isMini && clamped < 1) {
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    if (blueprint.isMilestone && blueprint.milestone) {
      drawMilestoneLandmark(ctx, blueprint.milestone.id, W, H, pal, timestamp, 'blueprint', false);
    } else {
      drawProceduralIntermediateTower(ctx, blueprint, W, H, pal, 'blueprint', false);
    }
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('100%', W * 0.45, -H + 6);
    ctx.fillText('50%', W * 0.45, -H * 0.5);
    ctx.restore();
  }

  // 2. Clipped Built Architectural Vector Structure up to active fillRatio
  if (clamped > 0.001) {
    ctx.save();
    if (options?.alpha !== undefined) {
      ctx.globalAlpha = options.alpha;
    }
    const builtH = H * clamped;
    ctx.beginPath();
    ctx.rect(-W, -builtH - 2, W * 2, builtH + 6);
    ctx.clip();

    if (blueprint.isMilestone && blueprint.milestone) {
      drawMilestoneLandmark(ctx, blueprint.milestone.id, W, H, pal, timestamp, 'solid', isMini);
    } else {
      drawProceduralIntermediateTower(ctx, blueprint, W, H, pal, 'solid', isMini);
    }
    ctx.restore();
  }
}
