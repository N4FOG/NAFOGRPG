import { 
  socket, 
  canvas, 
  ctx, 
  VISIBLE_TILES, 
  tileWidth, 
  tileHeight, 
  gameState, 
  initMap, 
  updateTargetId, 
  charNameText, 
  playerCountText, 
  pingValueText, 
  chatMessages
} from './js/state.js';

import { 
  initInput, 
  handleMovementInput 
} from './js/input.js';

import { 
  generateMinimapBackground, 
  drawMinimap 
} from './js/minimap.js';

import { 
  drawIsoTileFloor, 
  drawIsoTileObstacle, 
  drawIsoPlayer, 
  drawIsoMonster, 
  drawIsoSpellEffect, 
  drawIsoFloatingEffect 
} from './js/rendering.js';

// Função para mapear tipos de blocos
function getTileType(x, y) {
  if (!gameState.mapGrid || !gameState.mapGrid[y] || gameState.mapGrid[y][x] === undefined) {
    return 'grass';
  }

  const tileNum = gameState.mapGrid[y][x];
  switch (tileNum) {
    case 0: return 'grass';
    case 1: return 'dark_grass';
    case 2: return 'flower_yellow';
    case 3: return 'flower_red';
    case 4: return 'bush';
    case 5: return 'wall';          // Parede de pedra
    case 6: return 'water';         // Rio
    case 7: return 'wood_floor';    // Chão da casa
    case 8: return 'brick_wall';    // Paredes da casa
    case 9: return 'bridge';        // Ponte
    case 10: return 'cobblestone_street'; // Paralelepípedo
    default: return 'grass';
  }
}

// --- CONEXÃO E LISTENERS DO SOCKET.IO ---

// Inicialização da conexão
socket.on('init', (data) => {
  initMap(data.mapWidth, data.mapHeight, data.mapGrid);
  gameState.myId = data.playerId;
  gameState.players = data.players;
  gameState.monsters = data.monsters || {};

  // Redimensionar canvas para viewport isométrica (17 * 32 = 544px)
  canvas.width = VISIBLE_TILES * 32;
  canvas.height = VISIBLE_TILES * 32;

  // Gerar minimapa de fundo
  generateMinimapBackground();
  updateOnlineCount();

  // Verificar se há personagem salvo para continuar
  checkSavedCharacter();
});

// Confirmação de entrada bem sucedida (Login)
socket.on('join_success', (data) => {
  gameState.myId = data.playerId;
  gameState.players = data.players;

  // Ocultar as telas de carregamento / criação
  document.getElementById('start-screen-overlay').classList.add('hidden');
  document.getElementById('char-creation-overlay').classList.add('hidden');

  const myPlayer = gameState.players[gameState.myId];
  if (myPlayer) {
    charNameText.textContent = myPlayer.name;
    document.querySelector('.character-identity .char-vocation').textContent = `${myPlayer.className} (Lv. ${myPlayer.level})`;
    document.documentElement.style.setProperty('--selected-house-color', myPlayer.color);
  }
  updateOnlineCount();
});

// Jogador entrou
socket.on('player_joined', (player) => {
  gameState.players[player.id] = player;
  updateOnlineCount();
});

// Jogador saiu
socket.on('player_left', (playerId) => {
  delete gameState.players[playerId];
  if (gameState.targetId === playerId) {
    updateTargetId(null);
  }
  updateOnlineCount();
});

// Jogador moveu no grid
socket.on('player_moved', (data) => {
  if (gameState.players[data.id]) {
    gameState.players[data.id].x = data.x;
    gameState.players[data.id].y = data.y;
  }
});

// Mensagem de chat recebida
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

// Atualização de Status Vital (Vida/Mana)
socket.on('player_update', (stats) => {
  document.getElementById('hp-text').textContent = `${stats.hp} / ${stats.maxHp}`;
  document.querySelector('.hp-bar .bar-inner').style.width = `${(stats.hp / stats.maxHp) * 100}%`;
  
  document.getElementById('mana-text').textContent = `${stats.mana} / ${stats.maxMana}`;
  document.querySelector('.mana-bar .bar-inner').style.width = `${(stats.mana / stats.maxMana) * 100}%`;
  
  document.querySelector('.character-identity .char-vocation').textContent = `Royal Paladin (Lv. ${stats.level})`;
});

// Sincronização dos Monstros
socket.on('monsters_update', (data) => {
  // Mesclar as novas propriedades dos monstros mantendo os campos de interpolação visual se existirem
  for (const id in data) {
    if (gameState.monsters[id]) {
      gameState.monsters[id].x = data[id].x;
      gameState.monsters[id].y = data[id].y;
      gameState.monsters[id].hp = data[id].hp;
      gameState.monsters[id].maxHp = data[id].maxHp;
    } else {
      gameState.monsters[id] = data[id];
    }
  }
  
  // Limpar monstros deletados do servidor
  for (const id in gameState.monsters) {
    if (!data[id]) {
      delete gameState.monsters[id];
      if (gameState.targetId === id) {
        updateTargetId(null);
      }
    }
  }
});

// Perda do Target ativo
socket.on('target_lost', () => {
  updateTargetId(null);
});

// Efeito de dano/cura flutuante
socket.on('floating_effect', (data) => {
  gameState.floatingEffects.push({
    x: data.x,
    y: data.y,
    text: data.text,
    color: data.color,
    startTime: Date.now(),
    lifeTime: 1000
  });
});

// Efeito de magia
socket.on('spell_effect', (data) => {
  gameState.spellEffects.push({
    x: data.x,
    y: data.y,
    type: data.type,
    startTime: Date.now(),
    lifeTime: data.type === 'levelup' ? 1000 : 500
  });
});

// Função online count
function updateOnlineCount() {
  const count = Object.keys(gameState.players).length;
  playerCountText.textContent = `Online: ${count}`;
}

// Medidor de latência (Ping)
setInterval(() => {
  const startTime = Date.now();
  socket.emit('ping_latency', startTime);
}, 2000);

socket.on('pong_latency', (startTime) => {
  const ping = Date.now() - startTime;
  pingValueText.textContent = `${ping} ms`;
});

// --- LOOP PRINCIPAL DE RENDERIZAÇÃO ISOMÉTRICA ---

function gameLoop() {
  // Limpar tela
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Interpolação de coordenadas visuais para rolagem suave (Estilo Balrum)
  const lerpSpeed = 0.15;
  for (const id in gameState.players) {
    const p = gameState.players[id];
    if (p.visualX === undefined) {
      p.visualX = p.x;
      p.visualY = p.y;
    } else {
      p.visualX += (p.x - p.visualX) * lerpSpeed;
      p.visualY += (p.y - p.visualY) * lerpSpeed;
    }
  }
  for (const mid in gameState.monsters) {
    const m = gameState.monsters[mid];
    if (m.visualX === undefined) {
      m.visualX = m.x;
      m.visualY = m.y;
    } else {
      m.visualX += (m.x - m.visualX) * lerpSpeed;
      m.visualY += (m.y - m.visualY) * lerpSpeed;
    }
  }

  const myPlayer = gameState.players[gameState.myId];
  if (!myPlayer) {
    requestAnimationFrame(gameLoop);
    return;
  }

  // Posição de câmera contínua/interpolada do jogador
  const camX = myPlayer.visualX;
  const camY = myPlayer.visualY;

  // Centro carteseano da tela
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;

  // Bloco central no grid
  const centerMapX = Math.round(camX);
  const centerMapY = Math.round(camY);

  // 2. Renderizar o Chão do Mapa primeiro (para ficar debaixo de tudo)
  const drawRadius = 12; // Cobre confortavelmente a tela de 544x544 isometricamente
  for (let dy = -drawRadius; dy <= drawRadius; dy++) {
    for (let dx = -drawRadius; dx <= drawRadius; dx++) {
      const mapX = centerMapX + dx;
      const mapY = centerMapY + dy;

      const isoX = centerX + (mapX - camX - (mapY - camY)) * (tileWidth / 2);
      const isoY = centerY + (mapX - camX + (mapY - camY)) * (tileHeight / 2);

      // Limite visível do Canvas com margem de segurança de um bloco
      if (isoX >= -64 && isoX <= canvas.width + 64 && isoY >= -64 && isoY <= canvas.height + 64) {
        let type = 'wall'; // Borda de parede se fora dos limites do mapa
        if (mapX >= 0 && mapX < gameState.mapWidth && mapY >= 0 && mapY < gameState.mapHeight) {
          type = getTileType(mapX, mapY);
        }

        // Desenhar apenas chão, paredes sólidas desenhamos no Y-sorting
        if (type !== 'wall' && type !== 'brick_wall') {
          drawIsoTileFloor(ctx, type, isoX, isoY, tileWidth, tileHeight);
        } else {
          // Desenhar grama de base sob a parede para evitar vazios
          drawIsoTileFloor(ctx, 'grass', isoX, isoY, tileWidth, tileHeight);
        }
      }
    }
  }

  // 3. Coleta e ordenação de Elementos Verticais 2.5D (Y-sorting para sobreposição correta)
  const drawList = [];

  // A. Coletar Paredes de Pedra/Tijolo
  for (let dy = -drawRadius; dy <= drawRadius; dy++) {
    for (let dx = -drawRadius; dx <= drawRadius; dx++) {
      const mapX = centerMapX + dx;
      const mapY = centerMapY + dy;

      let type = 'wall';
      if (mapX >= 0 && mapX < gameState.mapWidth && mapY >= 0 && mapY < gameState.mapHeight) {
        type = getTileType(mapX, mapY);
      }

      if (type === 'wall' || type === 'brick_wall') {
        const isoX = centerX + (mapX - camX - (mapY - camY)) * (tileWidth / 2);
        const isoY = centerY + (mapX - camX + (mapY - camY)) * (tileHeight / 2);

        if (isoX >= -64 && isoX <= canvas.width + 64 && isoY >= -64 && isoY <= canvas.height + 64) {
          drawList.push({
            type: 'wall',
            subType: type,
            x: isoX,
            y: isoY,
            sortY: isoY // A base do bloco determina a prioridade de profundidade
          });
        }
      }
    }
  }

  // B. Coletar Jogadores
  for (const id in gameState.players) {
    const p = gameState.players[id];
    const isoX = centerX + (p.visualX - camX - (p.visualY - camY)) * (tileWidth / 2);
    const isoY = centerY + (p.visualX - camX + (p.visualY - camY)) * (tileHeight / 2);

    if (isoX >= -64 && isoX <= canvas.width + 64 && isoY >= -64 && isoY <= canvas.height + 64) {
      drawList.push({
        type: 'player',
        data: p,
        isMe: (id === gameState.myId),
        x: isoX,
        y: isoY,
        sortY: isoY
      });
    }
  }

  // C. Coletar Monstros
  for (const mid in gameState.monsters) {
    const m = gameState.monsters[mid];
    const isoX = centerX + (m.visualX - camX - (m.visualY - camY)) * (tileWidth / 2);
    const isoY = centerY + (m.visualX - camX + (m.visualY - camY)) * (tileHeight / 2);

    if (isoX >= -64 && isoX <= canvas.width + 64 && isoY >= -64 && isoY <= canvas.height + 64) {
      drawList.push({
        type: 'monster',
        data: m,
        x: isoX,
        y: isoY,
        sortY: isoY
      });
    }
  }

  // D. Ordenar a lista de desenho pela coordenada Y (Painter's Algorithm)
  drawList.sort((a, b) => a.sortY - b.sortY);

  // E. Renderizar a fila ordenada
  for (const item of drawList) {
    if (item.type === 'wall') {
      drawIsoTileObstacle(ctx, item.subType, item.x, item.y, tileWidth, tileHeight);
    } else if (item.type === 'player') {
      drawIsoPlayer(ctx, item.data, item.x, item.y, tileWidth, tileHeight, item.isMe);
    } else if (item.type === 'monster') {
      drawIsoMonster(ctx, item.data, item.x, item.y, tileWidth, tileHeight, gameState.targetId);
    }
  }

  // 4. Renderizar Efeitos de Magia
  const now = Date.now();
  for (let i = gameState.spellEffects.length - 1; i >= 0; i--) {
    const effect = gameState.spellEffects[i];
    if (now - effect.startTime > effect.lifeTime) {
      gameState.spellEffects.splice(i, 1);
      continue;
    }
    const isoX = centerX + (effect.x - camX - (effect.y - camY)) * (tileWidth / 2);
    const isoY = centerY + (effect.x - camX + (effect.y - camY)) * (tileHeight / 2);

    if (isoX >= -64 && isoX <= canvas.width + 64 && isoY >= -64 && isoY <= canvas.height + 64) {
      drawIsoSpellEffect(ctx, effect, isoX, isoY, tileWidth, tileHeight);
    }
  }

  // 5. Renderizar Efeitos Flutuantes de Dano/Cura
  for (let i = gameState.floatingEffects.length - 1; i >= 0; i--) {
    const effect = gameState.floatingEffects[i];
    if (now - effect.startTime > effect.lifeTime) {
      gameState.floatingEffects.splice(i, 1);
      continue;
    }
    const isoX = centerX + (effect.x - camX - (effect.y - camY)) * (tileWidth / 2);
    const isoY = centerY + (effect.x - camX + (effect.y - camY)) * (tileHeight / 2);

    if (isoX >= -64 && isoX <= canvas.width + 64 && isoY >= -64 && isoY <= canvas.height + 64) {
      drawIsoFloatingEffect(ctx, effect, isoX, isoY, tileWidth, tileHeight);
    }
  }

  // 6. Atualizar inputs de movimento continuamente
  handleMovementInput();

  // 7. Atualizar o minimapa na barra lateral
  drawMinimap();

  // Agendar próximo frame
  requestAnimationFrame(gameLoop);
}

// --- DADOS E LÓGICA DE CRIAÇÃO DE PERSONAGEM ---

const CLASSES_DATA = {
  humans: [
    { name: "Cavaleiro das Trevas", emoji: "🛡️", perk: "Dano +30% contra inimigos com menos de 30% de HP" },
    { name: "Assassino Sombrio", emoji: "🗡️", perk: "Crítico Furtivo: Chance extra de crítico de +20%" },
    { name: "Gladiador", emoji: "🔱", perk: "+2% de dano por sequência de vitórias (até +40%)" },
    { name: "Atirador de Elite", emoji: "🏹", perk: "+25% de chance de crítico; ignora 30% de defesa" },
    { name: "Escudeiro Real", emoji: "💂‍♂️", perk: "Proteção de Ferro: Reduz 15% de todo o dano na Arena" },
    { name: "Mercador Viajante", emoji: "👑", perk: "+20% de ouro obtido e 10% de desconto na loja" },
    { name: "Minerador Ancião", emoji: "⛏️", perk: "+35% de chance de achar gemas raras" },
    { name: "Sábio Ancião", emoji: "📜", perk: "+20% de ganho de XP global" },
    { name: "Aprendiz", emoji: "🎓", perk: "Ganha o dobro de XP em habilidades abaixo do nível 30" }
  ],
  fantastic: [
    { name: "Elfo", emoji: "🧝‍♂️", perk: "+15% de velocidade de ataque permanente" },
    { name: "Berserker", emoji: "🪓", perk: "Dano aumenta conforme sua vida cai, até +50%" },
    { name: "Golem de Pedra", emoji: "🗿", perk: "+50% de defesa dos itens, mas -20% vel. de ataque" },
    { name: "Cavaleiro Tartaruga", emoji: "🐢", perk: "+1 de Defesa permanente a cada 50 vitórias" },
    { name: "Mímico", emoji: "🎭", perk: "+50% de chance de duplicar recursos coletados" }
  ],
  darkness: [
    { name: "Vampiro", emoji: "🧛‍♂️", perk: "Sanguessuga: Roubo de vida (recupera 5% do dano causado)" },
    { name: "Escorpião Rei", emoji: "🦂", perk: "Efeitos de veneno causam +20% de dano" },
    { name: "Espectro", emoji: "🌫️", perk: "+15% de chance de esquivar de ataques" },
    { name: "Zumbi", emoji: "🧟‍♂️", perk: "Ignora 5 de dano de qualquer ataque físico inimigo" }
  ],
  celestials: [
    { name: "Gênio", emoji: "🧞‍♂️", perk: "+20% de dano/cura com habilidades de classe" },
    { name: "Alquimista Dourado", emoji: "🪙", perk: "Toque de Midas: Converte 5% do dano em ouro na Arena" },
    { name: "Vidente", emoji: "🔮", perk: "+15% de chance de criar itens épicos/lendários" },
    { name: "Mente Brilhante", emoji: "🧠", perk: "+25% de velocidade de XP na Biblioteca" },
    { name: "Reencarnado", emoji: "🔄", perk: "Segunda Chance: Revive uma vez por batalha com 30% HP" }
  ],
  differents: [
    { name: "Autômato", emoji: "🤖", perk: "+15% de eficácia para trabalhadores ativos" },
    { name: "Alienígena", emoji: "👽", perk: "Metabolismo Cósmico: Efeitos de poções duram +50%" },
    { name: "Ciborgue", emoji: "🦾", perk: "+15% de chance de duplicar itens na Ferraria/Alquimia" },
    { name: "Ilusionista", emoji: "🎭", perk: "Reduz o cooldown das habilidades em 1 turno" },
    { name: "Bardo", emoji: "🎪", perk: "+10% de velocidade dos trabalhadores passivos" },
    { name: "Coringa", emoji: "🃏", perk: "+10% de chance de duplicar os drops de chefes" }
  ]
};

const HOUSES_DATA = [
  { name: "Guardião do Norte", shield: "🐺❄️", color: "#aaccff", glow: "rgba(170, 204, 255, 0.4)", perk: "+30 HP Máximo inicial; +25% XP em Coleta; +15% vel. ataque" },
  { name: "Senhor das Riquezas", shield: "🦁👑", color: "#ffd700", glow: "rgba(255, 215, 0, 0.4)", perk: "+500 ouro extra inicial; +40% de ouro obtido; +2 slots de inventário" },
  { name: "Sangue do Dragão", shield: "🐉🔥", color: "#ff6644", glow: "rgba(255, 102, 68, 0.4)", perk: "+30% de dano em combate; +20% chance de crítico; +25% XP global" },
  { name: "Navegador do Abismo", shield: "🚢🌊", color: "#00ffd2", glow: "rgba(0, 255, 210, 0.4)", perk: "Começa com Vara de Pesca; +35% XP em Pesca; +25% de chance de colheita dupla" },
  { name: "Herborista Arcano", shield: "🌹🍃", color: "#4aff4a", glow: "rgba(74, 255, 74, 0.4)", perk: "Começa com 30 poções; regenera +5 vida por turno; +30% XP em Herbolaria/Alquimia" },
  { name: "Defensor Inabalável", shield: "⚜️🛡️", color: "#d4a373", glow: "rgba(212, 163, 115, 0.4)", perk: "Começa com Escudo; +50 de Vida Máxima; reduz em 15% todo dano recebido" }
];

// Estado da Criação
let selectedGender = 'M';
let selectedRace = 'humans';
let selectedClass = null;
let selectedHouse = null;

// Elementos da UI de Criação
const nameInput = document.getElementById('char-name-input');
const startBtn = document.getElementById('btn-start-adventure');
const classPerkBox = document.getElementById('class-perk-box');
const housePerkBox = document.getElementById('house-perk-box');

// Obter substituições de gênero
function getGenderModifiedClass(classObj, gender) {
  let name = classObj.name;
  let emoji = classObj.emoji;

  if (gender === 'F') {
    if (name === "Cavaleiro das Trevas") name = "Cavaleira das Trevas";
    else if (name === "Assassino Sombrio") name = "Assassina Sombria";
    else if (name === "Gladiador") name = "Gladiadora";
    else if (name === "Atirador de Elite") name = "Atiradora de Elite";
    else if (name === "Escudeiro Real") { name = "Escudeira Real"; emoji = "💂‍♀️"; }
    else if (name === "Mercador Viajante") name = "Mercadora Viajante";
    else if (name === "Minerador Ancião") name = "Mineradora Anciã";
    else if (name === "Sábio Ancião") name = "Sábia Anciã";
    else if (name === "Elfo") { name = "Elfa"; emoji = "🧝‍♀️"; }
    else if (name === "Mímico") name = "Mímica";
    else if (name === "Vampiro") { name = "Vampira"; emoji = "🧛‍♀️"; }
    else if (name === "Zumbi") { emoji = "🧟‍♀️"; }
    else if (name === "Gênio") { name = "Gênia"; emoji = "🧞‍♀️"; }
    else if (name === "Alquimista Dourado") name = "Alquimista Dourada";
    else if (name === "Reencarnado") name = "Reencarnada";
    else if (name === "Autômato") name = "Autômata";
    else if (name === "Bardo") name = "Barda";
  } else {
    if (name === "Elfo") emoji = "🧝‍♂️";
    else if (name === "Escudeiro Real") emoji = "💂‍♂️";
    else if (name === "Vampiro") emoji = "🧛‍♂️";
    else if (name === "Zumbi") emoji = "🧟‍♂️";
    else if (name === "Gênio") emoji = "🧞‍♂️";
  }

  return { name, emoji, perk: classObj.perk };
}

// Verificar se botão de Iniciar Aventura pode ser habilitado
function validateForm() {
  const name = nameInput.value.trim();
  const isValidName = name.length >= 3 && name.length <= 20;
  
  if (isValidName && selectedClass && selectedHouse) {
    startBtn.classList.remove('disabled');
    startBtn.disabled = false;
    startBtn.classList.add('primary');
  } else {
    startBtn.classList.add('disabled');
    startBtn.disabled = true;
    startBtn.classList.remove('primary');
  }
}

// Renderizar lista de classes com base na raça e gênero
function renderClasses() {
  const classesList = document.getElementById('classes-list');
  classesList.innerHTML = '';
  
  const currentClasses = CLASSES_DATA[selectedRace];
  currentClasses.forEach(c => {
    const genderClass = getGenderModifiedClass(c, selectedGender);
    
    const card = document.createElement('div');
    card.className = 'class-card';
    if (selectedClass && selectedClass.rawName === c.name) {
      card.classList.add('active');
    }
    
    card.innerHTML = `
      <span class="avatar-emoji">${genderClass.emoji}</span>
      <span class="class-name">${genderClass.name}</span>
    `;
    
    card.addEventListener('click', () => {
      document.querySelectorAll('.class-card').forEach(x => x.classList.remove('active'));
      card.classList.add('active');
      
      selectedClass = {
        rawName: c.name,
        name: genderClass.name,
        emoji: genderClass.emoji,
        perk: genderClass.perk
      };
      
      classPerkBox.innerHTML = `Passiva da Classe: <strong>${selectedClass.perk}</strong>`;
      validateForm();
    });
    
    classesList.appendChild(card);
  });
}

// Renderizar casas feudais
function renderHouses() {
  const housesList = document.getElementById('houses-list');
  housesList.innerHTML = '';
  
  HOUSES_DATA.forEach(h => {
    const card = document.createElement('div');
    card.className = 'house-card';
    if (selectedHouse && selectedHouse.name === h.name) {
      card.classList.add('active');
    }
    
    card.innerHTML = `
      <span class="house-shield">${h.shield}</span>
      <span class="house-title" style="color: ${h.color}">${h.name}</span>
    `;
    
    card.addEventListener('click', () => {
      document.querySelectorAll('.house-card').forEach(x => x.classList.remove('active'));
      card.classList.add('active');
      
      selectedHouse = h;
      
      // Aplicar cor selecionada dinamicamente
      document.documentElement.style.setProperty('--selected-house-color', h.color);
      document.documentElement.style.setProperty('--selected-house-glow', h.glow);
      
      housePerkBox.innerHTML = `Benefício Feudal: <strong>${h.perk}</strong>`;
      validateForm();
    });
    
    housesList.appendChild(card);
  });
}

// Tabs de raças
document.querySelectorAll('#race-tabs .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#race-tabs .tab-btn').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    selectedRace = btn.getAttribute('data-race');
    renderClasses();
  });
});

// Gênero
document.querySelectorAll('.radio-group button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.radio-group button').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
    selectedGender = btn.getAttribute('data-gender');
    
    // Atualizar classe selecionada se houver
    if (selectedClass) {
      const origClass = CLASSES_DATA[selectedRace].find(x => x.name === selectedClass.rawName);
      if (origClass) {
        const mod = getGenderModifiedClass(origClass, selectedGender);
        selectedClass.name = mod.name;
        selectedClass.emoji = mod.emoji;
      }
    }
    
    renderClasses();
    validateForm();
  });
});

// Input de Nome
nameInput.addEventListener('input', validateForm);

// Botão Criar Personagem abrir tela
document.getElementById('btn-create-char').addEventListener('click', () => {
  document.getElementById('start-screen-overlay').classList.add('hidden');
  document.getElementById('char-creation-overlay').classList.remove('hidden');
  renderClasses();
  renderHouses();
});

// Continuar com personagem salvo
function checkSavedCharacter() {
  const saved = localStorage.getItem('gravity_tibia_char');
  const btnContinue = document.getElementById('btn-continue');
  if (saved && btnContinue) {
    btnContinue.classList.remove('disabled');
    btnContinue.disabled = false;
    btnContinue.classList.add('primary');
  }
}

document.getElementById('btn-continue').addEventListener('click', () => {
  const saved = localStorage.getItem('gravity_tibia_char');
  if (saved) {
    const charData = JSON.parse(saved);
    socket.emit('join_game', charData);
  }
});

// Botão Iniciar Aventura
startBtn.addEventListener('click', () => {
  if (startBtn.classList.contains('disabled')) return;
  
  const charData = {
    name: nameInput.value.trim(),
    gender: selectedGender,
    className: selectedClass.name,
    classEmoji: selectedClass.emoji,
    houseName: selectedHouse.name,
    houseColor: selectedHouse.color
  };
  
  // Salvar no LocalStorage para o "Continuar"
  localStorage.setItem('gravity_tibia_char', JSON.stringify(charData));
  
  // Enviar para o servidor
  socket.emit('join_game', charData);
});

// Inicializações básicas do cliente
initInput();
requestAnimationFrame(gameLoop);
