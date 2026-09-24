import type { Entity, GameMap, GameState } from '@/game/types';
import { isDoorOpen, mapStateOf, terrainAt } from '@/game/world';
import { getItem } from '@/content/items';
import { TILE_SIZE } from './constants';
import { drawNpc } from './ck';
import { blit } from './pixel';
import { itemSprite, propSprite } from './sprites';

const T = TILE_SIZE;

function shadow(ctx: CanvasRenderingContext2D, px: number, py: number, w = 0.34): void {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(px + T / 2, py + T * 0.86, T * w, T * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawDoor(ctx: CanvasRenderingContext2D, entity: Extract<Entity, { kind: 'door' }>, px: number, py: number, open: boolean): void {
  if (open) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(px + T * 0.12, py, T * 0.76, T);
    return;
  }
  if (entity.requiresArtifact === 'moon_seal') {
    // A round stone door with a moon-shaped socket.
    ctx.fillStyle = '#3a4252';
    ctx.fillRect(px, py, T, T);
    ctx.fillStyle = '#6a7488';
    ctx.beginPath();
    ctx.arc(px + T / 2, py + T / 2, T * 0.46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1f2a';
    ctx.beginPath();
    ctx.arc(px + T / 2, py + T / 2, T * 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9aa8bf';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px + T / 2, py + T / 2, T * 0.34, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }
  if (entity.opensWhenBlocksOn) {
    // A plain, heavy stone slab.
    ctx.fillStyle = '#2a303c';
    ctx.fillRect(px, py, T, T);
    ctx.fillStyle = '#4a5262';
    ctx.fillRect(px + 3, py + 2, T - 6, T - 4);
    ctx.fillStyle = '#2a303c';
    for (let i = 1; i < 4; i++) ctx.fillRect(px + 3, py + (i * T) / 4, T - 6, 2);
    return;
  }
  // A bronze-banded wooden door.
  ctx.fillStyle = '#4a3618';
  ctx.fillRect(px + T * 0.06, py, T * 0.88, T);
  ctx.fillStyle = '#8a6a35';
  ctx.fillRect(px + T * 0.12, py + 2, T * 0.76, T - 2);
  ctx.fillStyle = '#c98a3f';
  ctx.fillRect(px + T * 0.12, py + T * 0.25, T * 0.76, 3);
  ctx.fillRect(px + T * 0.12, py + T * 0.7, T * 0.76, 3);
  ctx.fillStyle = '#1a140e';
  ctx.fillRect(px + T * 0.46, py + T * 0.44, 4, 7);
}

export function drawEntity(ctx: CanvasRenderingContext2D, map: GameMap, entity: Entity, x: number, y: number, state: GameState, time: number): void {
  const px = x * T;
  const py = y * T;

  switch (entity.kind) {
    case 'npc': {
      shadow(ctx, px, py, entity.sprite === 'bat' ? 0.2 : 0.34);
      drawNpc(ctx, entity.sprite, px, py, T, time);
      break;
    }
    case 'item': {
      const def = getItem(entity.itemId);
      const bob = Math.sin(time * 3 + x + y) * T * 0.06;
      shadow(ctx, px, py, 0.22);
      blit(ctx, itemSprite(def?.sprite ?? 'coin'), px + T * 0.12, py + T * 0.06 + bob, T * 0.76);
      // A periodic glint so things on the floor catch the eye.
      const glint = (time * 0.7 + (x * 7 + y * 13) * 0.1) % 2.4;
      if (glint < 0.25) {
        const s = Math.sin((glint / 0.25) * Math.PI) * 4;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(px + T * 0.7 - s / 2, py + T * 0.2, s, 1.5);
        ctx.fillRect(px + T * 0.7 - 0.75, py + T * 0.2 - s / 2, 1.5, s);
      }
      break;
    }
    case 'door':
      drawDoor(ctx, entity, px, py, isDoorOpen(entity, state, map));
      break;
    case 'switch': {
      const on = !!state.flags[entity.setsFlag];
      ctx.fillStyle = '#3a3f45';
      ctx.fillRect(px + T * 0.28, py + T * 0.6, T * 0.44, T * 0.3);
      ctx.strokeStyle = '#8a8e98';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px + T / 2, py + T * 0.68);
      ctx.lineTo(px + T * (on ? 0.72 : 0.28), py + T * 0.2);
      ctx.stroke();
      ctx.fillStyle = on ? '#7fbf6a' : '#c0392b';
      ctx.beginPath();
      ctx.arc(px + T * (on ? 0.72 : 0.28), py + T * 0.2, T * 0.1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'block': {
      const sunk = terrainAt(map, { x, y }) === 'hazard';
      if (sunk) {
        // Wedged into the pit: a flush stone bridge.
        ctx.fillStyle = '#6a6250';
        ctx.fillRect(px + 1, py + 1, T - 2, T - 2);
        ctx.fillStyle = '#8a8068';
        ctx.fillRect(px + 3, py + 3, T - 6, 3);
        break;
      }
      shadow(ctx, px, py, 0.42);
      ctx.fillStyle = '#5c5444';
      ctx.fillRect(px + 2, py + 2, T - 4, T - 4);
      ctx.fillStyle = '#8a7e62';
      ctx.fillRect(px + 2, py + 2, T - 4, T * 0.62);
      ctx.fillStyle = '#a89a7a';
      ctx.fillRect(px + 4, py + 4, T - 8, 3);
      // The keepers' eared circle, carved into every block.
      ctx.strokeStyle = '#5c5444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px + T / 2, py + T * 0.38, T * 0.13, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'trap': {
      if (entity.trapType === 'dart') {
        // Dart holes in the wall — readable, if you look.
        ctx.fillStyle = '#120c08';
        for (let i = 0; i < 3; i++) ctx.fillRect(px + T * 0.3 + i * T * 0.16, py + T * 0.45, 3, 3);
      } else {
        // A cracked ceiling stone over a loose plate: pebbles on the floor.
        ctx.fillStyle = 'rgba(160,170,190,0.55)';
        for (const [dx, dy] of [
          [0.25, 0.3],
          [0.7, 0.25],
          [0.55, 0.72],
          [0.2, 0.7],
        ] as const) {
          ctx.fillRect(px + T * dx, py + T * dy, 3, 2);
        }
      }
      break;
    }
    case 'clueNote': {
      const read = state.clues.includes(entity.clueId);
      const flutter = read ? 0 : Math.sin(time * 2.4 + x) * 1.2;
      shadow(ctx, px, py, 0.24);
      ctx.fillStyle = read ? '#c9c2b0' : '#f4eedc';
      ctx.fillRect(px + T * 0.26, py + T * 0.24 + flutter, T * 0.48, T * 0.56);
      ctx.fillStyle = '#8a8062';
      for (let i = 0; i < 3; i++) ctx.fillRect(px + T * 0.32, py + T * (0.34 + i * 0.13) + flutter, T * 0.36, 2);
      if (!read) {
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(px + T * 0.62, py + T * 0.2 + flutter, 4, 4);
      }
      break;
    }
    case 'decoration': {
      const used = !!mapStateOf(state, map.id).usedDecorations[entity.id];
      let alt = used;
      if (entity.spriteId === 'brazier') alt = state.inventory.includes('idol_sunstone');
      if (!entity.walkable && entity.spriteId !== 'rug') shadow(ctx, px, py, 0.4);
      blit(ctx, propSprite(entity.spriteId, alt), px, py, T);
      if (entity.spriteId === 'brazier' && alt) {
        const f = Math.sin(time * 14 + x) * 1.5;
        ctx.fillStyle = 'rgba(255,200,90,0.9)';
        ctx.fillRect(px + T * 0.44, py + T * 0.12 + f, 3, 4);
      }
      break;
    }
  }
}
