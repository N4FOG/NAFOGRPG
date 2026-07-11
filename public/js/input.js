import { 
  socket, 
  canvas, 
  chatForm, 
  chatInput, 
  gameState, 
  tileWidth, 
  tileHeight, 
  moveCooldown, 
  updateTargetId, 
  updateLastMoveTime 
} from './state.js';

// Impedir que a janela role com as setas quando o jogador estiver focado no jogo
window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) && document.activeElement !== chatInput) {
    e.preventDefault();
  }
  gameState.keysPressed[e.code] = true;
});

window.addEventListener('keyup', (e) => {
  gameState.keysPressed[e.code] = false;
});

// Detecção de cliques no canvas com conversão para o plano isométrico 2.5D
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const mouseY = e.clientY - rect.top;
  
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  const clickX = mouseX * scaleX;
  const clickY = mouseY * scaleY;
  
  const myPlayer = gameState.players[gameState.myId];
  if (!myPlayer) return;
  
  // Usar coordenadas visuais interpoladas para determinar o centro exato da câmera
  const camX = myPlayer.visualX !== undefined ? myPlayer.visualX : myPlayer.x;
  const camY = myPlayer.visualY !== undefined ? myPlayer.visualY : myPlayer.y;
  
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  const relX = clickX - centerX;
  const relY = clickY - centerY;
  
  // Conversão inversa de coordenadas Isométricas para Cartesianas
  const dx = Math.floor((relY / tileHeight) + (relX / tileWidth));
  const dy = Math.floor((relY / tileHeight) - (relX / tileWidth));
  
  const targetMapX = Math.round(camX) + dx;
  const targetMapY = Math.round(camY) + dy;
  
  // Identificar se clicou em algum monstro ativo no grid
  let clickedMonsterId = null;
  for (const mid in gameState.monsters) {
    const monster = gameState.monsters[mid];
    if (monster.x === targetMapX && monster.y === targetMapY) {
      clickedMonsterId = monster.id;
      break;
    }
  }
  
  // Definir target e enviar ao servidor
  updateTargetId(clickedMonsterId);
  socket.emit('set_target', gameState.targetId);
});

// Processar teclas e enviar movimento com cooldown
export function handleMovementInput() {
  if (document.activeElement === chatInput) return;

  const now = Date.now();
  if (now - gameState.lastMoveTime < moveCooldown) return;

  let direction = null;

  // Mapeamento isométrico de controles (rotação de 45 graus para manter a coerência visual)
  if (gameState.keysPressed['ArrowUp'] || gameState.keysPressed['KeyW']) {
    direction = 'up'; 
  } else if (gameState.keysPressed['ArrowDown'] || gameState.keysPressed['KeyS']) {
    direction = 'down'; 
  } else if (gameState.keysPressed['ArrowLeft'] || gameState.keysPressed['KeyA']) {
    direction = 'left'; 
  } else if (gameState.keysPressed['ArrowRight'] || gameState.keysPressed['KeyD']) {
    direction = 'right'; 
  }

  if (direction) {
    socket.emit('move', direction);
    updateLastMoveTime(now);
  }
}

// Inicializar envio de chat e foco
export function initInput() {
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text !== '') {
      socket.emit('chat_message', text);
      chatInput.value = '';
    }
    canvas.focus(); // Devolver foco para o jogo
  });
}
