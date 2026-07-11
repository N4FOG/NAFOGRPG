import { sprites } from './state.js';

// Funções auxiliares para desenho geométrico isométrico
export function drawIsoDiamond(ctx, x, y, w, h, fillStyle, strokeStyle, strokeWidth) {
  ctx.beginPath();
  ctx.moveTo(x, y - h / 2);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x, y + h / 2);
  ctx.lineTo(x - w / 2, y);
  ctx.closePath();
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = strokeWidth || 1;
    ctx.stroke();
  }
}

export function drawIsoBlock(ctx, x, y, w, h, blockHeight, topColor, leftColor, rightColor, strokeColor) {
  const H = blockHeight;
  
  // 1. Desenhar a Face Esquerda (Left Face)
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.lineTo(x, y + h / 2);
  ctx.lineTo(x, y + h / 2 - H);
  ctx.lineTo(x - w / 2, y - H);
  ctx.closePath();
  ctx.fillStyle = leftColor;
  ctx.fill();
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 2. Desenhar a Face Direita (Right Face)
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y - H);
  ctx.lineTo(x, y + h / 2 - H);
  ctx.closePath();
  ctx.fillStyle = rightColor;
  ctx.fill();
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 3. Desenhar a Face Superior (Top Face / Teto)
  ctx.beginPath();
  ctx.moveTo(x, y - H - h / 2);
  ctx.lineTo(x + w / 2, y - H);
  ctx.lineTo(x, y - H + h / 2);
  ctx.lineTo(x - w / 2, y - H);
  ctx.closePath();
  ctx.fillStyle = topColor;
  ctx.fill();
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

// Renderizar o chão do bloco isométrico
export function drawIsoTileFloor(ctx, type, x, y, w, h) {
  if (sprites.grass && ['grass', 'dark_grass', 'flower_yellow', 'flower_red', 'bush'].includes(type)) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y - h / 2);
    ctx.lineTo(x + w / 2, y);
    ctx.lineTo(x, y + h / 2);
    ctx.lineTo(x - w / 2, y);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(sprites.grass, x - w / 2, y - h / 2, w, h);
    ctx.restore();
    
    // Desenhar elementos decorativos adicionais sobre o sprite da grama
    if (type === 'flower_yellow') {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'flower_red') {
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath(); ctx.arc(x - 4, y + 2, 2.5, 0, Math.PI * 2); ctx.fill();
    } else if (type === 'bush') {
      ctx.fillStyle = '#196f3d';
      ctx.beginPath(); ctx.arc(x, y - 6, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#229954';
      ctx.beginPath(); ctx.arc(x - 3, y - 9, 6, 0, Math.PI * 2); ctx.fill();
    }
    return;
  }

  switch (type) {
    case 'water':
      // Água com efeito de ondulação animada
      drawIsoDiamond(ctx, x, y, w, h, '#1b4f72');
      const rippleOffset = Math.sin((Date.now() / 600) + x + y) * 1.5;
      ctx.strokeStyle = '#2874a6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - w / 4, y + rippleOffset);
      ctx.quadraticCurveTo(x, y - h / 4 + rippleOffset, x + w / 4, y + rippleOffset);
      ctx.stroke();
      break;

    case 'wood_floor':
      // Chão de madeira interno (com ripas)
      drawIsoDiamond(ctx, x, y, w, h, '#784212');
      ctx.strokeStyle = '#4d2800';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - w / 4, y - h / 4);
      ctx.lineTo(x + w / 4, y + h / 4);
      ctx.moveTo(x, y - h / 2);
      ctx.lineTo(x + w / 2, y);
      ctx.moveTo(x - w / 2, y);
      ctx.lineTo(x, y + h / 2);
      ctx.stroke();
      break;

    case 'bridge':
      // Ponte sobre a água
      drawIsoDiamond(ctx, x, y, w, h, '#a04000', '#5e2300', 1.5);
      ctx.strokeStyle = '#5e2300';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // Tábuas de madeira
      ctx.moveTo(x - w / 2 + 8, y + h / 2 - 4);
      ctx.lineTo(x + w / 2 - 8, y - h / 2 + 4);
      ctx.stroke();
      break;

    case 'cobblestone_street':
      // Paralelepípedos
      drawIsoDiamond(ctx, x, y, w, h, '#566573');
      ctx.fillStyle = '#7f8c8d';
      ctx.strokeStyle = '#2c3539';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.arc(x - w / 4, y - h / 8, 3, 0, Math.PI * 2);
      ctx.arc(x + w / 4, y + h / 8, 3, 0, Math.PI * 2);
      ctx.arc(x - w / 8, y + h / 4, 2.5, 0, Math.PI * 2);
      ctx.arc(x + w / 8, y - h / 4, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;

    case 'dark_grass':
      drawIsoDiamond(ctx, x, y, w, h, '#1e824c');
      ctx.fillStyle = '#145a32';
      ctx.fillRect(x - 4, y - 2, 2, 2);
      ctx.fillRect(x + 6, y + 2, 2, 2);
      break;

    case 'flower_yellow':
      drawIsoDiamond(ctx, x, y, w, h, '#27ae60');
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'flower_red':
      drawIsoDiamond(ctx, x, y, w, h, '#27ae60');
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(x - 4, y + 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'bush':
      drawIsoDiamond(ctx, x, y, w, h, '#27ae60');
      // Arbusto elevado em 2.5D
      ctx.fillStyle = '#196f3d';
      ctx.beginPath();
      ctx.arc(x, y - 6, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#229954';
      ctx.beginPath();
      ctx.arc(x - 3, y - 9, 6, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'grass':
    default:
      drawIsoDiamond(ctx, x, y, w, h, '#2ecc71');
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(x - 6, y - 3, 2, 3);
      ctx.fillRect(x + 8, y + 3, 2, 3);
      break;
  }
}

// Renderizar blocos sólidos em 2.5D (Paredes)
export function drawIsoTileObstacle(ctx, type, x, y, w, h) {
  if (type === 'wall' && sprites.wall) {
    ctx.drawImage(sprites.wall, x - 32, y - 48, 64, 64);
    return;
  }
  
  if (type === 'wall') {
    // Muralha de pedra
    drawIsoBlock(ctx, x, y, w, h, 36, '#718096', '#4a5568', '#2d3748', '#1a202c');
  } else if (type === 'brick_wall') {
    // Parede de tijolo da casa
    drawIsoBlock(ctx, x, y, w, h, 36, '#fadbd8', '#a93226', '#7b241c', '#511f1f');
  }
}

// Desenhar Jogador com visual isométrico
export function drawIsoPlayer(ctx, player, isoX, isoY, w, h, isMe) {
  const centerX = isoX;
  const centerY = isoY - 10;
  const radius = h / 2.6;

  // 1. Sombra do Personagem
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(centerX, isoY + 4, w / 4, h / 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Indicador pulsante (Aura Dourada do jogador local)
  if (isMe) {
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(centerX, isoY + 4, w / 4 + 4, h / 4 + 2, 0, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(241, 196, 15, 0.08)';
    ctx.beginPath();
    ctx.ellipse(centerX, isoY + 4, w / 4 + 4 + Math.sin(Date.now() / 150) * 1.5, h / 4 + 2 + Math.sin(Date.now() / 150) * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Pernas, Corpo e Equipamentos (ou o sprite de imagem como prioridade)
  if (sprites.player) {
    ctx.drawImage(sprites.player, centerX - 32, isoY - 48, 64, 64);
  } else {
    // Pernas/Botas
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(centerX - 6, centerY + 4, 4, 6);
    ctx.fillRect(centerX + 2, centerY + 4, 4, 6);
    
    ctx.fillStyle = '#5c3a21'; // Botas
    ctx.fillRect(centerX - 7, centerY + 8, 5, 3);
    ctx.fillRect(centerX + 2, centerY + 8, 5, 3);

    // Corpo/Armadura
    ctx.fillStyle = player.color;
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cinto
    ctx.fillStyle = '#111111';
    ctx.fillRect(centerX - radius + 1, centerY + 2, radius * 2 - 2, 2.5);
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(centerX - 2, centerY + 1.5, 4, 3.5);

    // Cabeça/Rosto (Usa o Emoji da Classe ou o Rosto Padrão)
    if (player.classEmoji) {
      ctx.save();
      ctx.font = '16px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(player.classEmoji, centerX, centerY - 5);
      ctx.restore();
    } else {
      const faceRadius = radius * 0.65;
      ctx.fillStyle = '#fddcbe';
      ctx.beginPath();
      ctx.arc(centerX, centerY - 4, faceRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Olhos
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(centerX - 5, centerY - 6, 3, 3);
      ctx.fillRect(centerX + 2, centerY - 6, 3, 3);
      ctx.fillStyle = '#2980b9';
      ctx.fillRect(centerX - 4, centerY - 5, 2, 2);
      ctx.fillRect(centerX + 3, centerY - 5, 2, 2);

      // Cabelo
      ctx.fillStyle = '#e67e22';
      ctx.beginPath();
      ctx.arc(centerX, centerY - 9, faceRadius * 0.9, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(centerX - 7, centerY - 9, 3, 5);
      ctx.fillRect(centerX + 4, centerY - 9, 3, 5);
    }

    // Equipamentos (Espada e Escudo)
    ctx.save();
    ctx.translate(centerX - 10, centerY + 2);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#d5dbdb';
    ctx.fillRect(-2, -12, 4, 12);
    ctx.fillStyle = '#bdc3c7';
    ctx.fillRect(0, -12, 2, 12);
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(-4, 0, 8, 2);
    ctx.fillStyle = '#784212';
    ctx.fillRect(-1, 2, 2, 4);
    ctx.restore();

    ctx.fillStyle = '#2980b9';
    ctx.strokeStyle = '#bdc3c7';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX + 11, centerY + 3, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f1c40f';
    ctx.beginPath();
    ctx.arc(centerX + 11, centerY + 3, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- BARRA DE VIDA ACIMA ---
  const barW = 28;
  const barH = 4;
  const barX = centerX - barW / 2;
  const barY = centerY - radius - 10;

  ctx.fillStyle = '#c0392b';
  ctx.fillRect(barX, barY, barW, barH);
  
  const hpPercent = player.hp / player.maxHp;
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(barX, barY, barW * hpPercent, barH);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  // --- NICKNAME ---
  ctx.font = 'bold 10px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  const nameY = barY - 6;
  ctx.fillText(player.name, centerX - 1, nameY);
  ctx.fillText(player.name, centerX + 1, nameY);
  ctx.fillText(player.name, centerX, nameY - 1);
  ctx.fillText(player.name, centerX, nameY + 1);

  ctx.fillStyle = isMe ? '#f1c40f' : '#00ff00';
  ctx.fillText(player.name, centerX, nameY);
}

// Desenhar Monstros com visual isométrico
export function drawIsoMonster(ctx, monster, isoX, isoY, w, h, targetId) {
  const centerX = isoX;
  const centerY = monster.type === 'rat' ? isoY + 2 : isoY - 10;

  // 1. Moldura de Alvo Ativo (Red Diamond)
  if (monster.id === targetId) {
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    drawIsoDiamond(ctx, isoX, isoY, w + 4, h + 2, null, '#ff3333', 1.5);
    ctx.setLineDash([]);
  }

  // 2. Sombra do Monstro
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  if (monster.type === 'rat') {
    ctx.ellipse(centerX, isoY + 4, w / 5, h / 5, 0, 0, Math.PI * 2);
  } else {
    ctx.ellipse(centerX, isoY + 4, w / 4, h / 4, 0, 0, Math.PI * 2);
  }
  ctx.fill();

  if (monster.type === 'rat') {
    // Cauda rosa
    ctx.strokeStyle = '#ffb3ba';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX - 8, centerY + 3);
    ctx.quadraticCurveTo(centerX - 14, centerY + 1, centerX - 16, centerY + 6);
    ctx.stroke();

    // Corpo oval
    ctx.fillStyle = '#7f8c8d';
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 1, 10, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cabeça
    ctx.fillStyle = '#6c7a89';
    ctx.beginPath();
    ctx.ellipse(centerX + 5, centerY - 1, 5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Orelhas
    ctx.fillStyle = '#ffb3ba';
    ctx.beginPath(); ctx.arc(centerX + 2, centerY - 5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(centerX + 6, centerY - 5, 2, 0, Math.PI * 2); ctx.fill();

    // Olhos vermelhos
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(centerX + 5, centerY - 2, 1.5, 1.5);

    // Bigodes
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(centerX + 9, centerY - 1); ctx.lineTo(centerX + 13, centerY - 2);
    ctx.moveTo(centerX + 9, centerY + 1); ctx.lineTo(centerX + 13, centerY + 2);
    ctx.stroke();

  } else if (monster.type === 'orc') {
    // Pernas
    ctx.fillStyle = '#34495e';
    ctx.fillRect(centerX - 5, centerY + 4, 3, 6);
    ctx.fillRect(centerX + 2, centerY + 4, 3, 6);

    // Corpo verde (Orc)
    ctx.fillStyle = '#27ae60';
    ctx.strokeStyle = '#1e824c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Armadura
    ctx.fillStyle = '#784212';
    ctx.fillRect(centerX - 8, centerY + 1, 16, 3);

    // Cabeça
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(centerX, centerY - 5, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Olhos amarelos
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(centerX - 3, centerY - 7, 1.5, 1.5);
    ctx.fillRect(centerX + 1.5, centerY - 7, 1.5, 1.5);

    // Capacete
    ctx.fillStyle = '#7f8c8d';
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY - 7, 5.5, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    // Chifres
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(centerX - 4, centerY - 8); ctx.lineTo(centerX - 8, centerY - 11); ctx.lineTo(centerX - 2, centerY - 9);
    ctx.moveTo(centerX + 4, centerY - 8); ctx.lineTo(centerX + 8, centerY - 11); ctx.lineTo(centerX + 2, centerY - 9);
    ctx.fill();

    // Machado
    ctx.fillStyle = '#95a5a6';
    ctx.fillRect(centerX - 11, centerY - 7, 3, 4);
    ctx.fillStyle = '#784212';
    ctx.fillRect(centerX - 10, centerY - 3, 1.5, 7);
  }

  // --- BARRA DE VIDA ---
  const barW = 24;
  const barH = 3;
  const barX = centerX - barW / 2;
  const barY = monster.type === 'rat' ? centerY - 10 : centerY - 15;

  ctx.fillStyle = '#000000';
  ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

  ctx.fillStyle = '#c0392b';
  ctx.fillRect(barX, barY, barW, barH);
  
  const hpPercent = monster.hp / monster.maxHp;
  ctx.fillStyle = hpPercent > 0.4 ? '#2ecc71' : '#f1c40f';
  ctx.fillRect(barX, barY, barW * hpPercent, barH);

  // Nome do Monstro
  ctx.font = '8px "Outfit", sans-serif';
  ctx.fillStyle = '#00ffff';
  ctx.textAlign = 'center';
  ctx.fillText(monster.name, centerX, barY - 5);
}

// Desenhar efeitos de magias/partículas isométricas
export function drawIsoSpellEffect(ctx, effect, isoX, isoY, w, h) {
  const now = Date.now();
  const elapsed = now - effect.startTime;
  const progress = elapsed / effect.lifeTime;
  if (progress > 1) return;

  const px = isoX;
  const py = isoY - 10; 

  ctx.save();
  if (effect.type === 'exura') {
    // Cura verde subindo
    ctx.fillStyle = 'rgba(46, 204, 113, ' + (1 - progress) + ')';
    for (let j = 0; j < 8; j++) {
      const angle = (j / 8) * Math.PI * 2 + progress * 2;
      const radius = progress * 24;
      const sparkX = px + Math.cos(angle) * radius;
      const sparkY = py + Math.sin(angle) * radius * 0.5 - progress * 15;
      ctx.fillRect(sparkX - 2, sparkY - 2, 4, 4);
    }
  } else if (effect.type === 'exori') {
    // Explosão vermelha expansiva isométrica (elipse)
    ctx.strokeStyle = 'rgba(230, 126, 34, ' + (1 - progress) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(px, py + 10, progress * 48, progress * 24, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(231, 76, 60, ' + (1 - progress) + ')';
    for (let j = 0; j < 12; j++) {
      const angle = (j / 12) * Math.PI * 2 - progress;
      const radius = progress * 40;
      const sparkX = px + Math.cos(angle) * radius;
      const sparkY = py + 10 + Math.sin(angle) * radius * 0.5;
      ctx.fillRect(sparkX - 3, sparkY - 3, 6, 6);
    }
  } else if (effect.type === 'levelup') {
    // Efeito Level Up
    ctx.strokeStyle = 'rgba(241, 196, 15, ' + (1 - progress) + ')';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(px, py + 10, progress * 36, progress * 18, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(241, 196, 15, ' + (1 - progress) + ')';
    ctx.font = 'bold 9px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText("LEVEL UP!", px, py - 20 - progress * 15);
  }
  ctx.restore();
}

// Desenhar dano flutuante em visão isométrica
export function drawIsoFloatingEffect(ctx, effect, isoX, isoY, w, h) {
  const now = Date.now();
  const elapsed = now - effect.startTime;
  const progress = elapsed / effect.lifeTime;
  if (progress > 1) return;

  const px = isoX;
  const py = isoY - 18 - progress * 22;

  ctx.save();
  ctx.globalAlpha = 1 - progress;
  ctx.font = 'bold 12px "Press Start 2P", monospace';
  ctx.textAlign = 'center';

  // Contorno preto
  ctx.fillStyle = '#000000';
  ctx.fillText(effect.text, px - 1, py);
  ctx.fillText(effect.text, px + 1, py);
  ctx.fillText(effect.text, px, py - 1);
  ctx.fillText(effect.text, px, py + 1);

  // Texto colorido
  ctx.fillStyle = effect.color;
  ctx.fillText(effect.text, px, py);
  ctx.restore();
}
