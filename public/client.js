const socket = io();

// Elementos da UI
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const playerCountText = document.getElementById('player-count');
const pingValueText = document.getElementById('ping-value');
const charNameText = document.getElementById('char-name');
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

// Estado do Jogo no Cliente
let mapWidth = 200;
let mapHeight = 200;
let tileSize = 32;
let mapGrid = [];
let myId = null;
let players = {};
let lastMoveTime = 0;
const moveCooldown = 150; // milissegundos entre passos
const VISIBLE_TILES = 17; // Quantidade de blocos visíveis na tela (17x17)

// Controle de Combate, Efeitos e Monstros
let monsters = {};
let targetId = null;
const floatingEffects = [];
const spellEffects = [];

// Off-screen canvas para carregar o minimapa em background estático
const minimapBgCanvas = document.createElement('canvas');
minimapBgCanvas.width = 200;
minimapBgCanvas.height = 200;
const minimapBgCtx = minimapBgCanvas.getContext('2d');

// Teclas pressionadas
const keysPressed = {};

// Inicialização da conexão
socket.on('init', (data) => {
  mapWidth = data.mapWidth;
  mapHeight = data.mapHeight;
  tileSize = data.tileSize;
  mapGrid = data.mapGrid;
  myId = data.playerId;
  players = data.players;
  monsters = data.monsters || {}; // Carregar lista inicial de monstros

  // Ajustar dimensões do canvas para a viewport visível (17 * 32 = 544px)
  canvas.width = VISIBLE_TILES * tileSize;
  canvas.height = VISIBLE_TILES * tileSize;

  // Configurar nome do jogador na barra lateral
  if (players[myId]) {
    charNameText.textContent = players[myId].name;
    const vocalName = ['Royal Paladin', 'Elite Knight', 'Master Sorcerer', 'Elder Druid'][Math.floor(Math.random() * 4)];
    document.querySelector('.char-vocation').textContent = `${vocalName} (Lv. 1)`;
  }

  // Desenhar a base estática do minimapa em background
  generateMinimapBackground();
});

// Outro jogador entrou
socket.on('player_joined', (player) => {
  players[player.id] = player;
  updateOnlineCount();
});

// Jogador desconectou
socket.on('player_left', (playerId) => {
  delete players[playerId];
  updateOnlineCount();
});

// Jogador moveu
socket.on('player_moved', (data) => {
  if (players[data.id]) {
    players[data.id].x = data.x;
    players[data.id].y = data.y;
  }
});

// Receber mensagem no chat
socket.on('chat_message', (msg) => {
  const msgElement = document.createElement('div');
  msgElement.classList.add('chat-message');
  
  if (msg.system) {
    msgElement.classList.add('system');
    msgElement.style.color = msg.color;
    msgElement.innerHTML = `<span class="text">${msg.text}</span>`;
  } else {
    msgElement.innerHTML = `
      <span class="sender" style="color: ${msg.color}">${msg.sender}:</span>
      <span class="text" style="color: #e2e8f0">${msg.text}</span>
    `;
  }

  chatMessages.appendChild(msgElement);
  chatMessages.scrollTop = chatMessages.scrollHeight;
});

// Atualizar número de jogadores online
function updateOnlineCount() {
  const count = Object.keys(players).length;
  playerCountText.textContent = `Online: ${count}`;
}

// Medidor de Latência (Ping)
setInterval(() => {
  const startTime = Date.now();
  socket.emit('ping_latency', startTime);
}, 2000);

socket.on('pong_latency', (startTime) => {
  const ping = Date.now() - startTime;
  pingValueText.textContent = `${ping} ms`;
});

// --- EVENTOS DE COMBATE E MONSTROS ---

// Atualizar status vital do jogador (HP, Mana, Vocações)
socket.on('player_update', (stats) => {
  document.getElementById('hp-text').textContent = `${stats.hp} / ${stats.maxHp}`;
  document.querySelector('.hp-bar .bar-inner').style.width = `${(stats.hp / stats.maxHp) * 100}%`;
  
  document.getElementById('mana-text').textContent = `${stats.mana} / ${stats.maxMana}`;
  document.querySelector('.mana-bar .bar-inner').style.width = `${(stats.mana / stats.maxMana) * 100}%`;
  
  document.querySelector('.character-identity .char-vocation').textContent = `Royal Paladin (Lv. ${stats.level})`;
});

// Sincronizar monstros
socket.on('monsters_update', (data) => {
  monsters = data;
});

// Perda de alvo ativo
socket.on('target_lost', () => {
  targetId = null;
});

// Receber efeito de dano flutuante
socket.on('floating_effect', (data) => {
  floatingEffects.push({
    x: data.x,
    y: data.y,
    text: data.text,
    color: data.color,
    startTime: Date.now(),
    lifeTime: 1000
  });
});

// Receber efeitos visuais de magias/subida de nível
socket.on('spell_effect', (data) => {
  spellEffects.push({
    x: data.x,
    y: data.y,
    type: data.type,
    startTime: Date.now(),
    lifeTime: data.type === 'levelup' ? 1000 : 500
  });
});

// Detecção de cliques no canvas para selecionar monstros como alvo (Target)
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  const clickX = mouseX * scaleX;
  const clickY = mouseY * scaleY;
  
  const screenX = Math.floor(clickX / tileSize);
  const screenY = Math.floor(clickY / tileSize);
  
  const myPlayer = players[myId];
  if (!myPlayer) return;
  
  const halfVisible = Math.floor(VISIBLE_TILES / 2);
  const startX = myPlayer.x - halfVisible;
  const startY = myPlayer.y - halfVisible;
  
  const targetMapX = startX + screenX;
  const targetMapY = startY + screenY;
  
  // Identificar se clicou em algum monstro ativo
  let clickedMonsterId = null;
  for (const mid in monsters) {
    const monster = monsters[mid];
    if (monster.x === targetMapX && monster.y === targetMapY) {
      clickedMonsterId = monster.id;
      break;
    }
  }
  
  // Definir target e enviar ao servidor
  targetId = clickedMonsterId;
  socket.emit('set_target', targetId);
});

// --- CONTROLES DE MOVIMENTO E TECLADO ---

// Impedir que a janela role com as setas quando o jogador estiver focado no jogo
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && document.activeElement !== chatInput) {
    e.preventDefault();
  }
  keysPressed[e.code] = true;
});

window.addEventListener('keyup', (e) => {
  keysPressed[e.code] = false;
});

// Processar teclas e enviar movimento com cooldown
function handleMovementInput() {
  // Não mover se o jogador estiver digitando no chat
  if (document.activeElement === chatInput) return;

  const now = Date.now();
  if (now - lastMoveTime < moveCooldown) return;

  let direction = null;

  if (keysPressed['ArrowUp'] || keysPressed['KeyW']) {
    direction = 'up';
  } else if (keysPressed['ArrowDown'] || keysPressed['KeyS']) {
    direction = 'down';
  } else if (keysPressed['ArrowLeft'] || keysPressed['KeyA']) {
    direction = 'left';
  } else if (keysPressed['ArrowRight'] || keysPressed['KeyD']) {
    direction = 'right';
  }

  if (direction) {
    socket.emit('move', direction);
    lastMoveTime = now;
  }
}

// --- ENVIO DO CHAT ---
chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (text !== '') {
    socket.emit('chat_message', text);
    chatInput.value = '';
  }
  canvas.focus(); // Devolver foco para o jogo
});

// --- RENDERIZAÇÃO E GRÁFICOS (CANVAS) ---

// Obter tipo de bloco com base na matriz do mapa enviada pelo servidor
function getTileType(x, y) {
  if (!mapGrid || !mapGrid[y] || mapGrid[y][x] === undefined) {
    return 'grass';
  }

  const tileNum = mapGrid[y][x];
  switch (tileNum) {
    case 0: return 'grass';
    case 1: return 'dark_grass';
    case 2: return 'flower_yellow';
    case 3: return 'flower_red';
    case 4: return 'bush';
    case 5: return 'wall';          // Parede de pedra das bordas
    case 6: return 'water';         // Rio
    case 7: return 'wood_floor';    // Chão da casa
    case 8: return 'brick_wall';    // Paredes da casa
    case 9: return 'bridge';        // Ponte sobre o rio
    case 10: return 'cobblestone_street'; // Ruas da vila
    default: return 'grass';
  }
}

// Desenhar um Tile específico
function drawTile(ctx, type, x, y, size) {
  const px = x * size;
  const py = y * size;

  switch (type) {
    case 'wall':
      // Bloco de pedra das bordas
      ctx.fillStyle = '#4a5568';
      ctx.fillRect(px, py, size, size);
      
      // Detalhes da pedra
      ctx.strokeStyle = '#2d3748';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
      
      ctx.fillStyle = '#718096';
      ctx.fillRect(px + 4, py + 4, 8, 8);
      ctx.fillRect(px + 16, py + 16, 8, 8);
      break;

    case 'brick_wall':
      // Parede de tijolo da casa
      ctx.fillStyle = '#a93226'; // Vermelho tijolo
      ctx.fillRect(px, py, size, size);
      
      // Linhas do cimento (padrão de tijolos)
      ctx.strokeStyle = '#fadbd8';
      ctx.lineWidth = 1;
      
      // Linhas horizontais
      ctx.beginPath();
      ctx.moveTo(px, py + 8); ctx.lineTo(px + size, py + 8);
      ctx.moveTo(px, py + 16); ctx.lineTo(px + size, py + 16);
      ctx.moveTo(px, py + 24); ctx.lineTo(px + size, py + 24);
      
      // Juntas verticais alternadas
      // Linha 1
      ctx.moveTo(px + 8, py); ctx.lineTo(px + 8, py + 8);
      ctx.moveTo(px + 24, py); ctx.lineTo(px + 24, py + 8);
      // Linha 2
      ctx.moveTo(px + 16, py + 8); ctx.lineTo(px + 16, py + 16);
      // Linha 3
      ctx.moveTo(px + 8, py + 16); ctx.lineTo(px + 8, py + 24);
      ctx.moveTo(px + 24, py + 16); ctx.lineTo(px + 24, py + 24);
      // Linha 4
      ctx.moveTo(px + 16, py + 24); ctx.lineTo(px + 16, py + size);
      
      ctx.stroke();
      break;

    case 'water':
      // Água profunda (Rio)
      ctx.fillStyle = '#1b4f72';
      ctx.fillRect(px, py, size, size);
      
      // Ondas da água sutilmente onduladas com o tempo
      const rippleOffset = Math.sin((Date.now() / 600) + x + y) * 1.5;
      ctx.strokeStyle = '#2874a6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px + 4, py + 12 + rippleOffset);
      ctx.quadraticCurveTo(px + 10, py + 8 + rippleOffset, px + 16, py + 12 + rippleOffset);
      
      ctx.moveTo(px + 14, py + 24 - rippleOffset);
      ctx.quadraticCurveTo(px + 20, py + 20 - rippleOffset, px + 26, py + 24 - rippleOffset);
      ctx.stroke();
      break;

    case 'wood_floor':
      // Chão de madeira interna
      ctx.fillStyle = '#784212'; // Marrom clássico
      ctx.fillRect(px, py, size, size);
      
      // Ripas de madeira
      ctx.strokeStyle = '#4d2800';
      ctx.lineWidth = 1;
      
      // Linhas horizontais (ripas)
      ctx.beginPath();
      ctx.moveTo(px, py + 10); ctx.lineTo(px + size, py + 10);
      ctx.moveTo(px, py + 20); ctx.lineTo(px + size, py + 20);
      ctx.moveTo(px, py + 30); ctx.lineTo(px + size, py + 30);
      
      // Juntas verticais das ripas
      ctx.moveTo(px + 12, py); ctx.lineTo(px + 12, py + 10);
      ctx.moveTo(px + 24, py + 10); ctx.lineTo(px + 24, py + 20);
      ctx.moveTo(px + 6, py + 20); ctx.lineTo(px + 6, py + 30);
      ctx.moveTo(px + 18, py + 30); ctx.lineTo(px + 18, py + size);
      
      ctx.stroke();
      break;

    case 'bridge':
      // Ponte sobre o rio (madeira transitável)
      ctx.fillStyle = '#a04000';
      ctx.fillRect(px, py, size, size);
      
      // Pranchas de madeira horizontais
      ctx.strokeStyle = '#5e2300';
      ctx.lineWidth = 2;
      ctx.strokeRect(px, py, size, size);
      
      ctx.beginPath();
      ctx.moveTo(px, py + 8); ctx.lineTo(px + size, py + 8);
      ctx.moveTo(px, py + 16); ctx.lineTo(px + size, py + 16);
      ctx.moveTo(px, py + 24); ctx.lineTo(px + size, py + 24);
      
      // Corrimão lateral nas bordas da ponte
      ctx.fillStyle = '#5e2300';
      ctx.fillRect(px, py, size, 3);
      ctx.fillRect(px, py + size - 3, size, 3);
      
      ctx.stroke();
      break;

    case 'cobblestone_street':
      // Chão de paralelepípedos/ruas da vila
      ctx.fillStyle = '#566573'; // Cinza escuro base
      ctx.fillRect(px, py, size, size);
      
      // Desenhar pedrinhas arredondadas individuais
      ctx.fillStyle = '#7f8c8d'; // Cinza claro para as pedras
      ctx.strokeStyle = '#2c3539'; // Divisórias escuras
      ctx.lineWidth = 1;
      
      // Desenho detalhado de paralelepípedos na rua
      ctx.beginPath(); ctx.arc(px + 8, py + 8, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(px + 24, py + 8, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(px + 16, py + 20, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(px + 6, py + 26, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(px + 26, py + 26, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      break;

    case 'dark_grass':
      // Grama escura
      ctx.fillStyle = '#1e824c';
      ctx.fillRect(px, py, size, size);
      
      // Pequenas folhas
      ctx.fillStyle = '#145a32';
      ctx.fillRect(px + 8, py + 12, 3, 3);
      ctx.fillRect(px + 20, py + 24, 3, 3);
      break;

    case 'flower_yellow':
      // Grama base
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(px, py, size, size);
      
      // Flor amarela
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(px + 16, py + 16, 3, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'flower_red':
      // Grama base
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(px, py, size, size);
      
      // Flor vermelha
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(px + 12, py + 20, 3, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'bush':
      // Grama base
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(px, py, size, size);
      
      // Arbusto arredondado com efeito 3D
      ctx.fillStyle = '#196f3d';
      ctx.beginPath();
      ctx.arc(px + 16, py + 16, 11, 0, Math.PI * 2);
      ctx.fill();
      
      // Detalhe claro superior (brilho)
      ctx.fillStyle = '#229954';
      ctx.beginPath();
      ctx.arc(px + 13, py + 13, 5, 0, Math.PI * 2);
      ctx.fill();
      break;

    case 'grass':
    default:
      // Grama padrão
      ctx.fillStyle = '#2ecc71';
      ctx.fillRect(px, py, size, size);
      
      // Detalhes da grama
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(px + 12, py + 8, 2, 4);
      ctx.fillRect(px + 24, py + 20, 2, 4);
      break;
  }
}

// Desenhar Jogador com Sprite Moderno e Detalhado
function drawPlayer(ctx, player, screenX, screenY, size, isMe) {
  const px = screenX * size;
  const py = screenY * size;
  const radius = size / 2.6;
  const centerX = px + size / 2;
  const centerY = py + size / 2;

  // 1. Sombra do Personagem (para dar profundidade 3D)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + radius - 2, radius * 1.1, radius * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // 2. Indicador pulsante do próprio jogador (Aura Dourada)
  if (isMe) {
    ctx.strokeStyle = '#f1c40f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 5, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(241, 196, 15, 0.08)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 5 + Math.sin(Date.now() / 150) * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Pernas/Botas
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(centerX - 6, centerY + 4, 4, 6);
  ctx.fillRect(centerX + 2, centerY + 4, 4, 6);
  
  // Botas
  ctx.fillStyle = '#5c3a21'; // Marrom escuro para botas
  ctx.fillRect(centerX - 7, centerY + 8, 5, 3);
  ctx.fillRect(centerX + 2, centerY + 8, 5, 3);

  // 4. Corpo/Armadura (túnica colorida com borda escura)
  ctx.fillStyle = player.color;
  ctx.strokeStyle = '#111111';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Cinto da Armadura
  ctx.fillStyle = '#111111';
  ctx.fillRect(centerX - radius + 1, centerY + 2, radius * 2 - 2, 2.5);
  ctx.fillStyle = '#f1c40f'; // Fivela dourada
  ctx.fillRect(centerX - 2, centerY + 1.5, 4, 3.5);

  // 5. Cabeça/Rosto (Tom de pele)
  const faceRadius = radius * 0.65;
  ctx.fillStyle = '#fddcbe'; // Cor de pele
  ctx.beginPath();
  ctx.arc(centerX, centerY - 4, faceRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Olhos expressivos
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(centerX - 5, centerY - 6, 3, 3);
  ctx.fillRect(centerX + 2, centerY - 6, 3, 3);
  ctx.fillStyle = '#2980b9'; // Olhos azuis brilhantes
  ctx.fillRect(centerX - 4, centerY - 5, 2, 2);
  ctx.fillRect(centerX + 3, centerY - 5, 2, 2);

  // Cabelo estiloso
  ctx.fillStyle = '#e67e22'; // Cabelo laranja/ruivo
  ctx.beginPath();
  ctx.arc(centerX, centerY - 9, faceRadius * 0.9, Math.PI, 0); // Topo do cabelo
  ctx.fill();
  ctx.fillRect(centerX - 7, centerY - 9, 3, 5);
  ctx.fillRect(centerX + 4, centerY - 9, 3, 5);

  // 6. Equipamentos Visuais Segurando (Espada e Escudo)
  // Mão Direita: Espada de Aço angulada
  ctx.save();
  ctx.translate(centerX - 10, centerY + 2);
  ctx.rotate(-Math.PI / 4);
  // Lâmina
  ctx.fillStyle = '#d5dbdb';
  ctx.fillRect(-2, -12, 4, 12);
  ctx.fillStyle = '#bdc3c7'; // Sombra da lâmina
  ctx.fillRect(0, -12, 2, 12);
  // Guarda
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(-4, 0, 8, 2);
  // Cabo
  ctx.fillStyle = '#784212';
  ctx.fillRect(-1, 2, 2, 4);
  ctx.restore();

  // Mão Esquerda: Escudo medieval
  ctx.fillStyle = '#2980b9'; // Centro azul
  ctx.strokeStyle = '#bdc3c7'; // Borda de ferro
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(centerX + 11, centerY + 3, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Detalhe central no escudo
  ctx.fillStyle = '#f1c40f'; // Detalhe dourado
  ctx.beginPath();
  ctx.arc(centerX + 11, centerY + 3, 2, 0, Math.PI * 2);
  ctx.fill();

  // --- BARRA DE VIDA ACIMA DO JOGADOR (Estilo Tibia) ---
  const barW = 28;
  const barH = 4;
  const barX = centerX - barW / 2;
  const barY = py - 6;

  // Fundo vermelho
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(barX, barY, barW, barH);
  
  // Frente verde
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect(barX, barY, barW, barH);

  // Borda preta fina
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);

  // --- NICKNAME DO JOGADOR (Estilo Tibia) ---
  ctx.font = 'bold 10px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  
  // Sombra de texto preta para legibilidade
  ctx.fillStyle = '#000000';
  const nameY = py - 12;
  ctx.fillText(player.name, centerX - 1, nameY);
  ctx.fillText(player.name, centerX + 1, nameY);
  ctx.fillText(player.name, centerX, nameY - 1);
  ctx.fillText(player.name, centerX, nameY + 1);

  // Cor do Nome: Verde para outros, Amarelo para si mesmo
  ctx.fillStyle = isMe ? '#f1c40f' : '#00ff00';
  ctx.fillText(player.name, centerX, nameY);
}

// Renderizar a imagem estática do minimapa em memória
function generateMinimapBackground() {
  minimapBgCtx.clearRect(0, 0, 200, 200);
  for (let y = 0; y < mapHeight; y++) {
    for (let x = 0; x < mapWidth; x++) {
      const tileNum = mapGrid[y][x];
      let color = '#2ecc71'; // grass
      switch (tileNum) {
        case 0: color = '#2ecc71'; break; // grass
        case 1: color = '#1e824c'; break; // dark_grass
        case 2: color = '#27ae60'; break; // flower_yellow
        case 3: color = '#27ae60'; break; // flower_red
        case 4: color = '#196f3d'; break; // bush
        case 5: color = '#4a5568'; break; // stone wall (muralha)
        case 6: color = '#1b4f72'; break; // water
        case 7: color = '#784212'; break; // wood floor
        case 8: color = '#a93226'; break; // brick wall
        case 9: color = '#a04000'; break; // bridge
        case 10: color = '#566573'; break; // cobblestone street
      }
      minimapBgCtx.fillStyle = color;
      minimapBgCtx.fillRect(x, y, 1, 1);
    }
  }
}

// Desenhar o estado em tempo real no canvas do minimapa (jogadores e coordenadas)
function drawMinimap() {
  const mmCanvas = document.getElementById('minimap-canvas');
  if (!mmCanvas) return;
  const ctxMm = mmCanvas.getContext('2d');

  // Desenhar o fundo estático do minimapa pré-renderizado
  ctxMm.drawImage(minimapBgCanvas, 0, 0);

  // Desenhar os outros jogadores conectados no minimapa (pixel vermelho)
  for (const id in players) {
    if (id !== myId) {
      const player = players[id];
      ctxMm.fillStyle = '#ff3333';
      ctxMm.fillRect(player.x - 1, player.y - 1, 3, 3);
    }
  }

  // Desenhar o jogador local (ponto amarelo/branco piscante)
  const myPlayer = players[myId];
  if (myPlayer) {
    const flash = Math.floor(Date.now() / 250) % 2 === 0;
    ctxMm.fillStyle = flash ? '#f1c40f' : '#ffffff';
    ctxMm.fillRect(myPlayer.x - 1, myPlayer.y - 1, 3, 3);

    // Atualizar as coordenadas textuais na UI
    const coordsText = document.getElementById('minimap-coords');
    if (coordsText) {
      coordsText.textContent = `X: ${myPlayer.x}, Y: ${myPlayer.y}`;
    }
  }
}

// Desenhar Criatura (Monstro: Rat ou Orc) de forma bonita e detalhada
function drawMonster(ctx, monster, screenX, screenY, size) {
  const px = screenX * size;
  const py = screenY * size;
  const centerX = px + size / 2;
  const centerY = py + size / 2;

  // 1. Moldura de Alvo Ativo (Red Square - Estilo Tibia)
  if (monster.id === targetId) {
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]); // Linhas tracejadas estilo Tibia
    ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
    ctx.setLineDash([]); // Reset
  }

  // 2. Sombra do Monstro
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  if (monster.type === 'rat') {
    ctx.ellipse(centerX, centerY + 8, 10, 4, 0, 0, Math.PI * 2);
  } else {
    ctx.ellipse(centerX, centerY + 10, 12, 5, 0, 0, Math.PI * 2);
  }
  ctx.fill();

  if (monster.type === 'rat') {
    // --- DESENHAR RAT (Cinza escuro, olhos vermelhos, cauda) ---
    // Cauda rosa
    ctx.strokeStyle = '#ffb3ba';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(centerX - 10, centerY + 4);
    ctx.quadraticCurveTo(centerX - 16, centerY + 2, centerX - 18, centerY + 8);
    ctx.stroke();

    // Corpo oval
    ctx.fillStyle = '#7f8c8d';
    ctx.strokeStyle = '#2c3e50';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY + 2, 11, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cabeça
    ctx.fillStyle = '#6c7a89';
    ctx.beginPath();
    ctx.ellipse(centerX + 6, centerY - 1, 6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Orelhas de rato
    ctx.fillStyle = '#ffb3ba'; // Rosa interna da orelha
    ctx.beginPath(); ctx.arc(centerX + 3, centerY - 6, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(centerX + 8, centerY - 6, 2.5, 0, Math.PI * 2); ctx.fill();

    // Olhos vermelhos brilhantes (Tibia Rat!)
    ctx.fillStyle = '#ff3333';
    ctx.fillRect(centerX + 6, centerY - 3, 2, 2);

    // Bigodes (Whiskers)
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(centerX + 11, centerY - 1); ctx.lineTo(centerX + 16, centerY - 3);
    ctx.moveTo(centerX + 11, centerY + 1); ctx.lineTo(centerX + 16, centerY + 3);
    ctx.stroke();

  } else if (monster.type === 'orc') {
    // --- DESENHAR ORC (Verde, capacete de ferro, machado) ---
    // Pernas cinza
    ctx.fillStyle = '#34495e';
    ctx.fillRect(centerX - 5, centerY + 4, 3, 6);
    ctx.fillRect(centerX + 2, centerY + 4, 3, 6);

    // Corpo verde (Orc Warrior)
    ctx.fillStyle = '#27ae60';
    ctx.strokeStyle = '#1e824c';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 8.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Ombros e Armadura de Couro
    ctx.fillStyle = '#784212';
    ctx.fillRect(centerX - 9, centerY + 1, 18, 3);

    // Cabeça
    ctx.fillStyle = '#2ecc71';
    ctx.beginPath();
    ctx.arc(centerX, centerY - 5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Olhos amarelos raivosos
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(centerX - 4, centerY - 7, 2, 2);
    ctx.fillRect(centerX + 2, centerY - 7, 2, 2);

    // Capacete de ferro (Tibia style)
    ctx.fillStyle = '#7f8c8d';
    ctx.strokeStyle = '#34495e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY - 7, 6, Math.PI, 0); // Arco superior
    ctx.fill();
    ctx.stroke();
    // Chifres do capacete
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(centerX - 5, centerY - 8); ctx.lineTo(centerX - 9, centerY - 12); ctx.lineTo(centerX - 3, centerY - 9);
    ctx.moveTo(centerX + 5, centerY - 8); ctx.lineTo(centerX + 9, centerY - 12); ctx.lineTo(centerX + 3, centerY - 9);
    ctx.fill();

    // Arma (Machado de Orc) na mão direita
    ctx.fillStyle = '#95a5a6'; // Lâmina de ferro
    ctx.fillRect(centerX - 12, centerY - 8, 4, 5);
    ctx.fillStyle = '#784212'; // Cabo de madeira
    ctx.fillRect(centerX - 11, centerY - 3, 2, 8);
  }

  // --- BARRA DE VIDA DO MONSTRO (Estilo Tibia - Vermelha) ---
  const barW = 24;
  const barH = 3;
  const barX = centerX - barW / 2;
  const barY = py - 6;

  // Fundo preto
  ctx.fillStyle = '#000000';
  ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

  // Fundo vermelho (HP restante)
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(barX, barY, barW, barH);
  
  // Frente verde (vida atual)
  const hpPercent = monster.hp / monster.maxHp;
  ctx.fillStyle = hpPercent > 0.4 ? '#2ecc71' : '#f1c40f'; // Fica amarelo com menos de 40%
  ctx.fillRect(barX, barY, barW * hpPercent, barH);

  // Nome do Monstro em azul claro discreto acima da barra
  ctx.font = '8px "Outfit", sans-serif';
  ctx.fillStyle = '#00ffff';
  ctx.textAlign = 'center';
  ctx.fillText(monster.name, centerX, py - 11);
}

// Loop Principal de Atualização Visual (Render Loop com Câmera Viewport)
function gameLoop() {
  // Limpar tela
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const myPlayer = players[myId];
  if (!myPlayer) {
    requestAnimationFrame(gameLoop);
    return;
  }

  // Calcular offsets da Câmera (Viewport)
  const halfVisible = Math.floor(VISIBLE_TILES / 2);
  const startX = myPlayer.x - halfVisible;
  const startY = myPlayer.y - halfVisible;

  // 1. Desenhar o chão do mapa que está visível
  for (let screenY = 0; screenY < VISIBLE_TILES; screenY++) {
    for (let screenX = 0; screenX < VISIBLE_TILES; screenX++) {
      const mapX = startX + screenX;
      const mapY = startY + screenY;

      let type = 'wall'; // Desenha parede de pedra das bordas se estiver fora dos limites do mapa
      if (mapX >= 0 && mapX < mapWidth && mapY >= 0 && mapY < mapHeight) {
        type = getTileType(mapX, mapY);
      }
      drawTile(ctx, type, screenX, screenY, tileSize);
    }
  }

  // 2. Tratar inputs de movimento continuamente
  handleMovementInput();

  // 2.5. Desenhar monstros que estão visíveis na tela
  for (const mid in monsters) {
    const monster = monsters[mid];
    const screenX = monster.x - startX;
    const screenY = monster.y - startY;

    if (screenX >= 0 && screenX < VISIBLE_TILES && screenY >= 0 && screenY < VISIBLE_TILES) {
      drawMonster(ctx, monster, screenX, screenY, tileSize);
    }
  }

  // 3. Desenhar todos os jogadores conectados que estão visíveis na tela
  for (const id in players) {
    const player = players[id];
    const screenX = player.x - startX;
    const screenY = player.y - startY;

    // Apenas desenhar se estiver visível no visor da câmera
    if (screenX >= 0 && screenX < VISIBLE_TILES && screenY >= 0 && screenY < VISIBLE_TILES) {
      const isMe = (id === myId);
      drawPlayer(ctx, player, screenX, screenY, tileSize, isMe);
    }
  }

  // 3.5. Desenhar efeitos de feitiço e partículas
  const now = Date.now();
  for (let i = spellEffects.length - 1; i >= 0; i--) {
    const effect = spellEffects[i];
    const elapsed = now - effect.startTime;
    if (elapsed > effect.lifeTime) {
      spellEffects.splice(i, 1);
      continue;
    }

    const screenX = effect.x - startX;
    const screenY = effect.y - startY;

    if (screenX >= 0 && screenX < VISIBLE_TILES && screenY >= 0 && screenY < VISIBLE_TILES) {
      const px = screenX * tileSize + tileSize / 2;
      const py = screenY * tileSize + tileSize / 2;
      const progress = elapsed / effect.lifeTime;

      ctx.save();
      if (effect.type === 'exura') {
        // Exura: partículas de cura verde subindo
        ctx.fillStyle = 'rgba(46, 204, 113, ' + (1 - progress) + ')';
        for (let j = 0; j < 8; j++) {
          const angle = (j / 8) * Math.PI * 2 + progress * 2;
          const radius = progress * 24;
          const sparkX = px + Math.cos(angle) * radius;
          const sparkY = py + Math.sin(angle) * radius - progress * 10;
          ctx.fillRect(sparkX - 2, sparkY - 2, 4, 4);
        }
      } else if (effect.type === 'exori') {
        // Exori: expansão explosiva laranja e vermelha
        ctx.strokeStyle = 'rgba(230, 126, 34, ' + (1 - progress) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(px, py, progress * 48, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(231, 76, 60, ' + (1 - progress) + ')';
        for (let j = 0; j < 12; j++) {
          const angle = (j / 12) * Math.PI * 2 - progress;
          const radius = progress * 40;
          const sparkX = px + Math.cos(angle) * radius;
          const sparkY = py + Math.sin(angle) * radius;
          ctx.fillRect(sparkX - 3, sparkY - 3, 6, 6);
        }
      } else if (effect.type === 'levelup') {
        // Level Up: anel dourado e estrelas
        ctx.strokeStyle = 'rgba(241, 196, 15, ' + (1 - progress) + ')';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(px, py, progress * 36, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = 'rgba(241, 196, 15, ' + (1 - progress) + ')';
        ctx.font = 'bold 9px "Press Start 2P", monospace';
        ctx.textAlign = 'center';
        ctx.fillText("LEVEL UP!", px, py - 20 - progress * 15);
      }
      ctx.restore();
    }
  }

  // 3.6. Desenhar efeitos de números de dano flutuantes (Tibia hit values)
  for (let i = floatingEffects.length - 1; i >= 0; i--) {
    const effect = floatingEffects[i];
    const elapsed = now - effect.startTime;
    if (elapsed > effect.lifeTime) {
      floatingEffects.splice(i, 1);
      continue;
    }

    const screenX = effect.x - startX;
    const screenY = effect.y - startY;

    if (screenX >= 0 && screenX < VISIBLE_TILES && screenY >= 0 && screenY < VISIBLE_TILES) {
      const px = screenX * tileSize + tileSize / 2;
      const py = screenY * tileSize - 8 - (elapsed / effect.lifeTime) * 22;

      ctx.save();
      ctx.globalAlpha = 1 - (elapsed / effect.lifeTime);
      ctx.font = 'bold 12px "Press Start 2P", monospace';
      ctx.textAlign = 'center';

      // Sombra preta para leitura
      ctx.fillStyle = '#000000';
      ctx.fillText(effect.text, px - 1, py);
      ctx.fillText(effect.text, px + 1, py);
      ctx.fillText(effect.text, px, py - 1);
      ctx.fillText(effect.text, px, py + 1);

      // Valor colorido
      ctx.fillStyle = effect.color;
      ctx.fillText(effect.text, px, py);
      ctx.restore();
    }
  }

  // 4. Desenhar o minimapa na barra lateral
  drawMinimap();

  // Chamar o próximo frame
  requestAnimationFrame(gameLoop);
}

// Iniciar renderização assim que o script for executado
requestAnimationFrame(gameLoop);
