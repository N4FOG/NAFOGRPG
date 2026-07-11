// Elemento de conexão Socket.io global
export const socket = io();

// Elementos da UI
export const chatMessages = document.getElementById('chat-messages');
export const chatForm = document.getElementById('chat-form');
export const chatInput = document.getElementById('chat-input');
export const playerCountText = document.getElementById('player-count');
export const pingValueText = document.getElementById('ping-value');
export const charNameText = document.getElementById('char-name');
export const canvas = document.getElementById('game-canvas');
export const ctx = canvas.getContext('2d');

// Configurações do Jogo
export const VISIBLE_TILES = 17;
export const tileSize = 32;
export const tileWidth = 64;
export const tileHeight = 32;
export const moveCooldown = 150; // milissegundos entre passos

// Estado Dinâmico compartilhado
export const gameState = {
  mapWidth: 200,
  mapHeight: 200,
  mapGrid: [],
  myId: null,
  players: {},
  monsters: {},
  targetId: null,
  lastMoveTime: 0,
  keysPressed: {},
  floatingEffects: [],
  spellEffects: []
};

// Funções utilitárias para atualização do estado de forma limpa
export function updateTargetId(id) {
  gameState.targetId = id;
}

export function updateLastMoveTime(time) {
  gameState.lastMoveTime = time;
}

export function initMap(width, height, grid) {
  gameState.mapWidth = width;
  gameState.mapHeight = height;
  gameState.mapGrid = grid;
}

// --- CARREGAMENTO DE SPRITES COM CORTE DE FUNDO (CHROMA KEY) ---
export const sprites = {};

const spriteSources = {
  player: '/assets/sprites/player.jpg',
  orc: '/assets/sprites/orc.jpg',
  rat: '/assets/sprites/rat.jpg',
  grass: '/assets/sprites/grass.jpg',
  wall: '/assets/sprites/wall.jpg'
};

function chromaKeyImage(src, callback) {
  const img = new Image();
  img.src = src;
  img.onload = () => {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    tempCtx.drawImage(img, 0, 0);
    
    const imgData = tempCtx.getImageData(0, 0, img.width, img.height);
    const data = imgData.data;
    
    // Ler cor do pixel do canto superior esquerdo (fundo)
    const keyR = data[0];
    const keyG = data[1];
    const keyB = data[2];
    
    const threshold = 40; // Limiar de diferença de cor para remover artefatos do JPG
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      const diff = Math.sqrt((r-keyR)**2 + (g-keyG)**2 + (b-keyB)**2);
      if (diff < threshold) {
        data[i+3] = 0; // Torna transparente
      }
    }
    tempCtx.putImageData(imgData, 0, 0);
    
    const cleanImg = new Image();
    cleanImg.src = tempCanvas.toDataURL();
    cleanImg.onload = () => callback(cleanImg);
  };
  img.onerror = () => {
    console.warn('Falha ao carregar sprite:', src);
    callback(null);
  };
}

export function loadAllSprites(onComplete) {
  let loadedCount = 0;
  const keys = Object.keys(spriteSources);
  for (const key of keys) {
    chromaKeyImage(spriteSources[key], (cleanImg) => {
      if (cleanImg) {
        sprites[key] = cleanImg;
      }
      loadedCount++;
      if (loadedCount === keys.length) {
        if (onComplete) onComplete();
      }
    });
  }
}
