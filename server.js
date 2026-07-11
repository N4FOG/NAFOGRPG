const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Configuração do mapa
const MAP_WIDTH = 200; // em tiles
const MAP_HEIGHT = 200; // em tiles
const TILE_SIZE = 32; // tamanho de cada quadrado em pixels

// Inicializar matriz do mapa com grama e obstáculos
const MAP_GRID = [];
for (let y = 0; y < MAP_HEIGHT; y++) {
  const row = [];
  for (let x = 0; x < MAP_WIDTH; x++) {
    // Bordas do mapa são muralhas de pedra
    if (x === 0 || y === 0 || x === MAP_WIDTH - 1 || y === MAP_HEIGHT - 1) {
      row.push(5); // Parede de pedra
    } else {
      // Geração procedural leve para o resto da grama/vegetação
      const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      const rand = hash - Math.floor(hash);
      if (rand < 0.04) row.push(2); // Flor amarela
      else if (rand < 0.08) row.push(3); // Flor vermelha
      else if (rand < 0.14) row.push(4); // Arbusto
      else if (rand < 0.28) row.push(1); // Grama escura
      else row.push(0); // Grama comum
    }
  }
  MAP_GRID.push(row);
}

// Criar Rio Horizontal (y = 100) e Rio Vertical (x = 100) dividindo o mapa em 4 quadrantes
for (let i = 1; i < MAP_WIDTH - 1; i++) {
  MAP_GRID[100][i] = 6; // Rio horizontal
  MAP_GRID[i][100] = 6; // Rio vertical
}

// Colocar Pontes de Madeira sobre os rios
// Ponte 1: Sobre o rio horizontal em (x = 98, y = 100)
MAP_GRID[100][98] = 9;
// Ponte 2: Sobre o rio vertical em (x = 100, y = 98)
MAP_GRID[98][100] = 9;

// Criar a Vila Central (área de x/y de 85 a 115)
// Desenhar ruas de paralelepípedos (tipo 10) que se cruzam e dão acesso às pontes
for (let i = 85; i <= 115; i++) {
  // Rua vertical principal alinhada com a ponte vertical (x = 98)
  if (MAP_GRID[i][98] !== 6 && MAP_GRID[i][98] !== 9) {
    MAP_GRID[i][98] = 10;
  }
  // Rua horizontal principal alinhada com a ponte horizontal (y = 98)
  if (MAP_GRID[98][i] !== 6 && MAP_GRID[98][i] !== 9) {
    MAP_GRID[98][i] = 10;
  }
}

// Adicionar 4 Casas ao redor do cruzamento principal da vila
const houseCoords = [
  { xStart: 90, xEnd: 95, yStart: 90, yEnd: 95, doorX: 92, doorY: 95 },   // Casa Superior Esquerda
  { xStart: 101, xEnd: 106, yStart: 90, yEnd: 95, doorX: 103, doorY: 95 }, // Casa Superior Direita
  { xStart: 90, xEnd: 95, yStart: 101, yEnd: 106, doorX: 92, doorY: 101 }, // Casa Inferior Esquerda
  { xStart: 101, xEnd: 106, yStart: 101, yEnd: 106, doorX: 103, doorY: 101 } // Casa Inferior Direita
];

houseCoords.forEach((house) => {
  for (let y = house.yStart; y <= house.yEnd; y++) {
    for (let x = house.xStart; x <= house.xEnd; x++) {
      if (x === house.xStart || x === house.xEnd || y === house.yStart || y === house.yEnd) {
        // Porta de entrada livre
        if (x === house.doorX && y === house.doorY) {
          MAP_GRID[y][x] = 7; // Entrada da casa (Chão de madeira)
        } else {
          MAP_GRID[y][x] = 8; // Parede da casa (Tijolo)
        }
      } else {
        MAP_GRID[y][x] = 7; // Chão interno de madeira
      }
    }
  }
});

// Cores pré-definidas para novos jogadores
const PLAYER_COLORS = [
  '#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', 
  '#1abc9c', '#3498db', '#9b59b6', '#34495e',
  '#ff007f', '#00ffff', '#7fff00', '#ffaa00'
];

// Função para buscar um local inicial seguro (perto da vila central)
function getRandomWalkableTile() {
  let attempts = 0;
  while (attempts < 150) {
    // Tenta spawnar dentro da praça central da vila (x/y: 95 a 105)
    const x = Math.floor(Math.random() * 10) + 94;
    const y = Math.floor(Math.random() * 10) + 94;
    const tile = MAP_GRID[y][x];
    // Evitar blocos de parede de pedra (5), água (6) ou parede de tijolo (8)
    if (tile !== 5 && tile !== 6 && tile !== 8) {
      return { x, y };
    }
    attempts++;
  }
  return { x: 98, y: 97 }; // Fallback na rua central da cidade
}

// Estado do jogo (jogadores conectados)
const players = {};

// Estado dos monstros no servidor
const monsters = {};
let monsterIdCounter = 0;

// Verificar se um bloco está ocupado por outro agente
function isTileOccupied(x, y) {
  for (const pid in players) {
    if (players[pid].x === x && players[pid].y === y) return true;
  }
  for (const mid in monsters) {
    if (monsters[mid].x === x && monsters[mid].y === y) return true;
  }
  return false;
}

// Buscar local livre ao redor de um ponto central
function getRandomWalkableTileAround(cx, cy, range) {
  let attempts = 0;
  while (attempts < 100) {
    const dx = Math.floor(Math.random() * (range * 2)) - range;
    const dy = Math.floor(Math.random() * (range * 2)) - range;
    const x = cx + dx;
    const y = cy + dy;
    if (x > 0 && x < MAP_WIDTH - 1 && y > 0 && y < MAP_HEIGHT - 1) {
      const tile = MAP_GRID[y][x];
      if (tile !== 5 && tile !== 6 && tile !== 8 && !isTileOccupied(x, y)) {
        return { x, y };
      }
    }
    attempts++;
  }
  return { x: cx, y: cy };
}

// Spawner de monstros para manter a quantidade mínima ativa
function spawnMonsters() {
  let ratsCount = 0;
  let orcsCount = 0;
  for (const id in monsters) {
    if (monsters[id].type === 'rat') ratsCount++;
    if (monsters[id].type === 'orc') orcsCount++;
  }
  
  // Manter 6 Rats na vila
  while (ratsCount < 6) {
    const id = `monster_${++monsterIdCounter}`;
    const pos = getRandomWalkableTileAround(98, 98, 20);
    monsters[id] = {
      id,
      type: 'rat',
      name: 'Rat',
      x: pos.x,
      y: pos.y,
      hp: 20,
      maxHp: 20,
      damage: 4,
      speed: 1200,
      lastMoveTime: 0,
      targetId: null
    };
    ratsCount++;
  }
  
  // Manter 3 Orcs
  while (orcsCount < 3) {
    const id = `monster_${++monsterIdCounter}`;
    const pos = getRandomWalkableTileAround(98, 98, 20);
    monsters[id] = {
      id,
      type: 'orc',
      name: 'Orc',
      x: pos.x,
      y: pos.y,
      hp: 60,
      maxHp: 60,
      damage: 10,
      speed: 1800,
      lastMoveTime: 0,
      targetId: null
    };
    orcsCount++;
  }
  
  io.emit('monsters_update', monsters);
}

// Obter estatísticas simplificadas do jogador
function getPlayerStats(player) {
  return {
    hp: player.hp,
    maxHp: player.maxHp,
    mana: player.mana,
    maxMana: player.maxMana,
    level: player.level,
    exp: player.exp
  };
}

// Inicializar spawn de criaturas
setTimeout(spawnMonsters, 1000);

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log(`Jogador conectado: ${socket.id}`);

  // Gerar dados iniciais para o novo jogador
  const playerColor = PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];
  const playerNumber = Math.floor(100 + Math.random() * 900);
  const playerName = `Hero_${playerNumber}`;
  
  // Posicionar jogador aleatoriamente dentro do grid usando local seguro com status vital
  const startPos = getRandomWalkableTile();
  players[socket.id] = {
    id: socket.id,
    name: playerName,
    color: playerColor,
    x: startPos.x,
    y: startPos.y,
    hp: 150,
    maxHp: 150,
    mana: 80,
    maxMana: 80,
    level: 1,
    exp: 0,
    targetId: null,
    lastAttackTime: 0
  };

  // Enviar configurações do mapa, matriz do grid, monstros e estado dos jogadores para o jogador conectado
  socket.emit('init', {
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    tileSize: TILE_SIZE,
    playerId: socket.id,
    players: players,
    mapGrid: MAP_GRID,
    monsters: monsters
  });

  // Enviar os status iniciais do próprio jogador
  socket.emit('player_update', getPlayerStats(players[socket.id]));

  // Notificar outros jogadores que um novo jogador entrou
  socket.broadcast.emit('player_joined', players[socket.id]);

  // Mensagem do sistema no chat avisando sobre a entrada
  io.emit('chat_message', {
    sender: 'Sistema',
    text: `${playerName} entrou no jogo!`,
    color: '#2ecc71',
    system: true
  });

  // Escutar movimento do jogador
  socket.on('move', (direction) => {
    const player = players[socket.id];
    if (!player) return;

    let nextX = player.x;
    let nextY = player.y;

    switch (direction) {
      case 'up':
        nextY -= 1;
        break;
      case 'down':
        nextY += 1;
        break;
      case 'left':
        nextX -= 1;
        break;
      case 'right':
        nextX += 1;
        break;
      default:
        return;
    }

    // Validar limites do mapa e colisões
    if (nextX >= 0 && nextX < MAP_WIDTH && nextY >= 0 && nextY < MAP_HEIGHT) {
      const tile = MAP_GRID[nextY][nextX];
      // Impedir movimento em paredes de pedra (5), água (6) e paredes de tijolo (8)
      if (tile !== 5 && tile !== 6 && tile !== 8) {
        player.x = nextX;
        player.y = nextY;

        // Broadcast da nova posição para todos os jogadores conectados
        io.emit('player_moved', {
          id: socket.id,
          x: player.x,
          y: player.y
        });
      }
    }
  });

  // Escutar mensagens de chat
  socket.on('chat_message', (text) => {
    const player = players[socket.id];
    if (!player || !text || text.trim() === '') return;

    // Limitar o tamanho da mensagem para evitar abusos
    const sanitizedText = text.substring(0, 100);
    const trimmedText = sanitizedText.trim().toLowerCase();

    // --- MAGIAS DE TIBIA ---
    // Cura (Exura)
    if (trimmedText === 'exura') {
      if (player.mana >= 20) {
        player.mana -= 20;
        const heal = Math.floor(Math.random() * 20) + 25; // 25 a 45 de cura
        player.hp = Math.min(player.maxHp, player.hp + heal);

        io.emit('floating_effect', {
          x: player.x,
          y: player.y,
          text: `+${heal}`,
          color: '#2ecc71'
        });

        io.emit('spell_effect', {
          x: player.x,
          y: player.y,
          type: 'exura'
        });

        socket.emit('player_update', getPlayerStats(player));

        io.emit('chat_message', {
          sender: player.name,
          text: 'Exura',
          color: '#2ecc71',
          system: false
        });
      } else {
        socket.emit('chat_message', {
          sender: 'Sistema',
          text: 'Mana insuficiente! (Custo: 20 Mana)',
          color: '#e74c3c',
          system: true
        });
      }
      return;
    }

    // Dano em Área (Exori)
    if (trimmedText === 'exori') {
      if (player.mana >= 30) {
        player.mana -= 30;

        io.emit('spell_effect', {
          x: player.x,
          y: player.y,
          type: 'exori'
        });

        let monstersUpdated = false;
        for (const mid in monsters) {
          const monster = monsters[mid];
          const dist = Math.max(Math.abs(player.x - monster.x), Math.abs(player.y - monster.y));
          if (dist <= 1) {
            const dmg = Math.floor(Math.random() * 21) + 30; // 30 a 50 de dano
            monster.hp = Math.max(0, monster.hp - dmg);
            monstersUpdated = true;

            io.emit('floating_effect', {
              x: monster.x,
              y: monster.y,
              text: dmg.toString(),
              color: '#e67e22'
            });

            if (monster.hp <= 0) {
              delete monsters[monster.id];
              if (player.targetId === monster.id) {
                player.targetId = null;
                socket.emit('target_lost');
              }

              const expGained = monster.type === 'rat' ? 10 : 35;
              player.exp += expGained;
              socket.emit('chat_message', {
                sender: 'Loot',
                text: `Voce ganhou ${expGained} pontos de experiencia ao derrotar um ${monster.name}.`,
                color: '#e2e8f0',
                system: true
              });

              // Level Up
              const expNeeded = player.level * 100;
              if (player.exp >= expNeeded) {
                player.exp -= expNeeded;
                player.level += 1;
                player.maxHp += 15;
                player.maxMana += 10;
                player.hp = player.maxHp;
                player.mana = player.maxMana;

                io.emit('chat_message', {
                  sender: 'Sistema',
                  text: `${player.name} subiu para o Level ${player.level}!`,
                  color: '#f1c40f',
                  system: true
                });

                io.emit('spell_effect', {
                  x: player.x,
                  y: player.y,
                  type: 'levelup'
                });
              }
            }
          }
        }

        socket.emit('player_update', getPlayerStats(player));

        if (monstersUpdated) {
          io.emit('monsters_update', monsters);
          spawnMonsters();
        }

        io.emit('chat_message', {
          sender: player.name,
          text: 'Exori',
          color: '#e67e22',
          system: false
        });
      } else {
        socket.emit('chat_message', {
          sender: 'Sistema',
          text: 'Mana insuficiente! (Custo: 30 Mana)',
          color: '#e74c3c',
          system: true
        });
      }
      return;
    }

    // Retransmitir mensagem de chat comum para todos
    io.emit('chat_message', {
      sender: player.name,
      text: sanitizedText,
      color: player.color,
      system: false
    });
  });

  // Escutar pings de latência do cliente e responder
  socket.on('ping_latency', (startTime) => {
    socket.emit('pong_latency', startTime);
  });

  // Receber marcação de alvo (target)
  socket.on('set_target', (monsterId) => {
    const player = players[socket.id];
    if (player) {
      if (monsterId === null || monsters[monsterId]) {
        player.targetId = monsterId;
      }
    }
  });

  // Tratar desconexão do jogador
  socket.on('disconnect', () => {
    console.log(`Jogador desconectado: ${socket.id}`);
    const player = players[socket.id];
    if (player) {
      const name = player.name;
      delete players[socket.id];

      // Notificar remoção do jogador
      io.emit('player_left', socket.id);

      // Mensagem do sistema avisando sobre a saída
      io.emit('chat_message', {
        sender: 'Sistema',
        text: `${name} saiu do jogo.`,
        color: '#e74c3c',
        system: true
      });
    }
  });
});

// --- LOOPS GLOBAIS DE PVE E COMBATE ---

// 1. Loop Vital: Regeneração de HP/Mana a cada 3 segundos
setInterval(() => {
  for (const pid in players) {
    const player = players[pid];
    let changed = false;

    if (player.hp < player.maxHp) {
      player.hp = Math.min(player.maxHp, player.hp + 2);
      changed = true;
    }
    if (player.mana < player.maxMana) {
      player.mana = Math.min(player.maxMana, player.mana + 3);
      changed = true;
    }

    if (changed) {
      const socket = io.sockets.sockets.get(player.id);
      if (socket) {
        socket.emit('player_update', getPlayerStats(player));
      }
    }
  }
}, 3000);

// 2. Loop de Ataque Automático do Jogador (Turno de 2s)
setInterval(() => {
  const now = Date.now();
  let monstersUpdated = false;

  for (const pid in players) {
    const player = players[pid];
    if (!player.targetId) continue;

    // Cooldown de ataque
    if (now - player.lastAttackTime < 2000) continue;

    const monster = monsters[player.targetId];
    if (!monster) {
      player.targetId = null;
      const socket = io.sockets.sockets.get(player.id);
      if (socket) socket.emit('target_lost');
      continue;
    }

    // Ataque corpo a corpo (distância <= 1)
    const dist = Math.max(Math.abs(player.x - monster.x), Math.abs(player.y - monster.y));
    if (dist <= 1) {
      const dmg = Math.floor(Math.random() * 8) + 1; // 1 a 8 de dano físico
      monster.hp = Math.max(0, monster.hp - dmg);
      player.lastAttackTime = now;
      monstersUpdated = true;

      // Dano flutuante no monstro (Amarelo)
      io.emit('floating_effect', {
        x: monster.x,
        y: monster.y,
        text: dmg.toString(),
        color: '#ffcc00'
      });

      // Morte do monstro
      if (monster.hp <= 0) {
        delete monsters[monster.id];
        player.targetId = null;

        const socket = io.sockets.sockets.get(player.id);
        if (socket) {
          socket.emit('target_lost');
          const expGained = monster.type === 'rat' ? 10 : 35;
          player.exp += expGained;

          socket.emit('chat_message', {
            sender: 'Loot',
            text: `Voce ganhou ${expGained} pontos de experiencia ao derrotar um ${monster.name}.`,
            color: '#e2e8f0',
            system: true
          });

          // Level Up
          const expNeeded = player.level * 100;
          if (player.exp >= expNeeded) {
            player.exp -= expNeeded;
            player.level += 1;
            player.maxHp += 15;
            player.maxMana += 10;
            player.hp = player.maxHp;
            player.mana = player.maxMana;

            io.emit('chat_message', {
              sender: 'Sistema',
              text: `${player.name} subiu para o Level ${player.level}!`,
              color: '#f1c40f',
              system: true
            });

            io.emit('spell_effect', {
              x: player.x,
              y: player.y,
              type: 'levelup'
            });
          }

          socket.emit('player_update', getPlayerStats(player));
        }

        spawnMonsters();
      }
    }
  }

  if (monstersUpdated) {
    io.emit('monsters_update', monsters);
  }
}, 500);

// 3. Loop de IA e Ataque dos Monstros
setInterval(() => {
  const now = Date.now();
  let updated = false;

  for (const mid in monsters) {
    const monster = monsters[mid];
    if (now - monster.lastMoveTime < monster.speed) continue;

    // Buscar jogador mais próximo para atacar
    let nearestPlayer = null;
    let minDist = 7; // Raio de agressão

    for (const pid in players) {
      const player = players[pid];
      const dist = Math.max(Math.abs(player.x - monster.x), Math.abs(player.y - monster.y));
      if (dist < minDist) {
        minDist = dist;
        nearestPlayer = player;
      }
    }

    if (nearestPlayer) {
      monster.targetId = nearestPlayer.id;
      const dist = Math.max(Math.abs(nearestPlayer.x - monster.x), Math.abs(nearestPlayer.y - monster.y));

      if (dist === 1) {
        // Atacar jogador
        const dmg = Math.floor(Math.random() * monster.damage) + 1;
        nearestPlayer.hp = Math.max(0, nearestPlayer.hp - dmg);
        monster.lastMoveTime = now;

        // Efeito flutuante vermelho no jogador
        io.emit('floating_effect', {
          x: nearestPlayer.x,
          y: nearestPlayer.y,
          text: dmg.toString(),
          color: '#ff3333'
        });

        // Enviar atualização vital para o jogador atacado
        const socket = io.sockets.sockets.get(nearestPlayer.id);
        if (socket) {
          socket.emit('player_update', getPlayerStats(nearestPlayer));
        }

        // Morte do Jogador (Teleporta e recupera HP)
        if (nearestPlayer.hp <= 0) {
          const startPos = getRandomWalkableTile();
          nearestPlayer.x = startPos.x;
          nearestPlayer.y = startPos.y;
          nearestPlayer.hp = nearestPlayer.maxHp;
          nearestPlayer.mana = nearestPlayer.maxMana;

          io.emit('chat_message', {
            sender: 'Sistema',
            text: `${nearestPlayer.name} foi derrotado por um ${monster.name}!`,
            color: '#ff3333',
            system: true
          });

          io.emit('player_moved', { id: nearestPlayer.id, x: nearestPlayer.x, y: nearestPlayer.y });
          if (socket) {
            socket.emit('player_update', getPlayerStats(nearestPlayer));
          }
        }
      } else {
        // Mover em direção ao jogador
        let dx = Math.sign(nearestPlayer.x - monster.x);
        let dy = Math.sign(nearestPlayer.y - monster.y);

        if (dx !== 0 && dy !== 0) {
          if (Math.random() < 0.5) dx = 0;
          else dy = 0;
        }

        const nextX = monster.x + dx;
        const nextY = monster.y + dy;

        if (nextX >= 0 && nextX < MAP_WIDTH && nextY >= 0 && nextY < MAP_HEIGHT) {
          const tile = MAP_GRID[nextY][nextX];
          if (tile !== 5 && tile !== 6 && tile !== 8 && !isTileOccupied(nextX, nextY)) {
            monster.x = nextX;
            monster.y = nextY;
            updated = true;
          }
        }
      }
    } else {
      // Andar aleatório se não houver agro
      monster.targetId = null;
      const directions = [{ x: 0, y: -1 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 1, y: 0 }];
      const dir = directions[Math.floor(Math.random() * directions.length)];
      const nextX = monster.x + dir.x;
      const nextY = monster.y + dir.y;

      if (nextX >= 0 && nextX < MAP_WIDTH && nextY >= 0 && nextY < MAP_HEIGHT) {
        const tile = MAP_GRID[nextY][nextX];
        if (tile !== 5 && tile !== 6 && tile !== 8 && !isTileOccupied(nextX, nextY)) {
          monster.x = nextX;
          monster.y = nextY;
          updated = true;
        }
      }
    }
    monster.lastMoveTime = now;
  }

  if (updated) {
    io.emit('monsters_update', monsters);
  }
}, 300);

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
