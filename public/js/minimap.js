import { gameState } from './state.js';

// Off-screen canvas para carregar o minimapa em background estático
const minimapBgCanvas = document.createElement('canvas');
minimapBgCanvas.width = 200;
minimapBgCanvas.height = 200;
const minimapBgCtx = minimapBgCanvas.getContext('2d');

export function generateMinimapBackground() {
  const { mapWidth, mapHeight, mapGrid } = gameState;
  minimapBgCtx.clearRect(0, 0, 200, 200);
  if (!mapGrid || mapGrid.length === 0) return;
  
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
export function drawMinimap() {
  const mmCanvas = document.getElementById('minimap-canvas');
  if (!mmCanvas) return;
  const ctxMm = mmCanvas.getContext('2d');

  // Desenhar o fundo estático do minimapa pré-renderizado
  ctxMm.drawImage(minimapBgCanvas, 0, 0);

  const { players, myId } = gameState;

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
