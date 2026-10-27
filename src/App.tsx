import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine, GameState } from './game/engine';

function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const joystickRef = useRef<HTMLDivElement>(null);
  const joystickKnobRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>({
    playerHealth: 100,
    wantedLevel: 0,
    inVehicle: false,
    speed: 0,
    score: 0,
    message: '',
    nearVehicle: false,
    nearNPC: false,
    missionText: '',
    missionActive: false
  });
  const [showInstructions, setShowInstructions] = useState(true);
  const joystickActive = useRef(false);
  const joystickCenter = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (containerRef.current && !engineRef.current) {
      const engine = new GameEngine(containerRef.current);
      engineRef.current = engine;
      
      engine.onStateChange((state) => {
        setGameState(state);
      });
    }

    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
      }
    };
  }, []);

  const handleJoystickStart = useCallback((clientX: number, clientY: number) => {
    if (!joystickRef.current) return;
    joystickActive.current = true;
    const rect = joystickRef.current.getBoundingClientRect();
    joystickCenter.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    handleJoystickMove(clientX, clientY);
  }, []);

  const handleJoystickMove = useCallback((clientX: number, clientY: number) => {
    if (!joystickActive.current || !joystickKnobRef.current) return;
    
    const dx = clientX - joystickCenter.current.x;
    const dy = clientY - joystickCenter.current.y;
    const maxDist = 40;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, maxDist);
    const angle = Math.atan2(dy, dx);
    
    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;
    
    joystickKnobRef.current.style.transform = `translate(${knobX}px, ${knobY}px)`;
    
    const normalizedX = knobX / maxDist;
    const normalizedY = knobY / maxDist;
    
    if (engineRef.current) {
      engineRef.current.setJoystickInput(normalizedX, normalizedY);
    }
  }, []);

  const handleJoystickEnd = useCallback(() => {
    joystickActive.current = false;
    if (joystickKnobRef.current) {
      joystickKnobRef.current.style.transform = 'translate(0px, 0px)';
    }
    if (engineRef.current) {
      engineRef.current.setJoystickInput(0, 0);
    }
  }, []);

  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (joystickRef.current) {
        const rect = joystickRef.current.getBoundingClientRect();
        if (touch.clientX >= rect.left - 50 && touch.clientX <= rect.right + 50 &&
            touch.clientY >= rect.top - 50 && touch.clientY <= rect.bottom + 50) {
          e.preventDefault();
          handleJoystickStart(touch.clientX, touch.clientY);
        }
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (joystickActive.current) {
        e.preventDefault();
        const touch = e.touches[0];
        handleJoystickMove(touch.clientX, touch.clientY);
      }
    };

    const handleTouchEnd = () => {
      handleJoystickEnd();
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleJoystickStart, handleJoystickMove, handleJoystickEnd]);

  const handleFight = () => {
    if (engineRef.current) {
      engineRef.current.startFight();
    }
  };

  const handleEnterVehicle = () => {
    if (engineRef.current) {
      engineRef.current.tryEnterVehicle();
    }
  };

  const handleRespawn = () => {
    if (engineRef.current) {
      engineRef.current.respawn();
    }
  };

  const wantedStars = '⭐'.repeat(gameState.wantedLevel) + '☆'.repeat(5 - gameState.wantedLevel);

  return (
    <div className="w-screen h-screen overflow-hidden relative bg-black">
      {/* Game canvas container */}
      <div ref={containerRef} className="w-full h-full" />
      
      {/* HUD */}
      <div className="absolute top-0 left-0 right-0 p-4 pointer-events-none">
        <div className="flex justify-between items-start">
          {/* Health bar */}
          <div className="bg-black/50 rounded-lg p-3 backdrop-blur-sm">
            <div className="text-white text-sm font-bold mb-1">ЗДОРОВЬЕ</div>
            <div className="w-40 h-4 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{ 
                  width: `${gameState.playerHealth}%`,
                  backgroundColor: gameState.playerHealth > 50 ? '#22c55e' : gameState.playerHealth > 25 ? '#eab308' : '#ef4444'
                }}
              />
            </div>
          </div>
          
          {/* Wanted level */}
          <div className="bg-black/50 rounded-lg p-3 backdrop-blur-sm text-center">
            <div className="text-white text-sm font-bold mb-1">РОЗЫСК</div>
            <div className="text-xl">{wantedStars}</div>
          </div>
          
          {/* Score */}
          <div className="bg-black/50 rounded-lg p-3 backdrop-blur-sm">
            <div className="text-white text-sm font-bold mb-1">СЧЁТ</div>
            <div className="text-green-400 text-xl font-bold">${gameState.score.toLocaleString()}</div>
          </div>
        </div>
        
        {/* Speed indicator when in vehicle */}
        {gameState.inVehicle && (
          <div className="absolute top-20 right-4 bg-black/50 rounded-lg p-3 backdrop-blur-sm">
            <div className="text-white text-sm font-bold mb-1">СКОРОСТЬ</div>
            <div className="text-yellow-400 text-2xl font-bold">{gameState.speed} <span className="text-sm">км/ч</span></div>
          </div>
        )}
      </div>
      
      {/* Message */}
      {gameState.message && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="bg-black/70 text-white text-xl font-bold px-6 py-3 rounded-lg backdrop-blur-sm animate-pulse">
            {gameState.message}
          </div>
        </div>
      )}
      
      {/* Virtual Joystick */}
      <div 
        ref={joystickRef}
        className="absolute bottom-8 left-8 w-32 h-32 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center backdrop-blur-sm pointer-events-auto touch-none"
      >
        <div 
          ref={joystickKnobRef}
          className="w-14 h-14 rounded-full bg-white/60 border-2 border-white/80 shadow-lg transition-none"
        />
      </div>
      
      {/* Action buttons */}
      <div className="absolute bottom-8 right-8 flex flex-col gap-3 pointer-events-auto">
        {/* Fight button */}
        <button
          onClick={handleFight}
          className="w-16 h-16 rounded-full bg-red-500/70 border-2 border-red-300 text-white font-bold text-xl flex items-center justify-center active:bg-red-600 active:scale-95 transition-all backdrop-blur-sm shadow-lg"
          title="Удар (F)"
        >
          👊
        </button>
        
        {/* Enter/Exit vehicle button */}
        <button
          onClick={handleEnterVehicle}
          className="w-16 h-16 rounded-full bg-blue-500/70 border-2 border-blue-300 text-white font-bold text-xl flex items-center justify-center active:bg-blue-600 active:scale-95 transition-all backdrop-blur-sm shadow-lg"
          title="Сесть/Выйти (E)"
        >
          🚗
        </button>
        
        {/* Respawn button */}
        {gameState.playerHealth <= 0 && (
          <button
            onClick={handleRespawn}
            className="w-16 h-16 rounded-full bg-green-500/70 border-2 border-green-300 text-white font-bold text-sm flex items-center justify-center active:bg-green-600 active:scale-95 transition-all backdrop-blur-sm shadow-lg animate-bounce"
          >
            ↺
          </button>
        )}
      </div>
      
      {/* Vehicle mode indicator */}
      {gameState.inVehicle && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-black/50 rounded-lg px-4 py-2 backdrop-blur-sm pointer-events-none">
          <div className="text-white text-sm text-center">
            🚗 В машине | Стрелки/WASD - управление | E - выйти
          </div>
        </div>
      )}
      
      {/* Proximity hints */}
      {!gameState.inVehicle && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 pointer-events-none">
          {gameState.nearVehicle && (
            <div className="bg-blue-500/70 text-white text-sm font-bold px-4 py-2 rounded-lg backdrop-blur-sm mb-2 animate-pulse">
              🚗 Нажмите E чтобы сесть в машину
            </div>
          )}
          {gameState.nearNPC && (
            <div className="bg-red-500/70 text-white text-sm font-bold px-4 py-2 rounded-lg backdrop-blur-sm animate-pulse">
              👊 Нажмите F чтобы ударить
            </div>
          )}
        </div>
      )}
      
      {/* Mission indicator */}
      {gameState.missionActive && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-yellow-500/80 text-white text-sm font-bold px-6 py-3 rounded-lg backdrop-blur-sm border border-yellow-300">
            <div className="text-center">🎯 МИССИЯ</div>
            <div className="text-center text-xs mt-1">{gameState.missionText}</div>
          </div>
        </div>
      )}
      
      {/* Instructions overlay */}
      {showInstructions && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-gray-900/95 rounded-2xl p-8 max-w-md mx-4 border border-gray-700 shadow-2xl">
            <h1 className="text-3xl font-bold text-white mb-2 text-center">🎮 GTA 3D</h1>
            <p className="text-gray-400 text-center mb-6">Открытый мир</p>
            
            <div className="space-y-4 text-gray-300">
              <div className="bg-gray-800/50 rounded-lg p-3">
                <h3 className="text-yellow-400 font-bold mb-2">🚶 Пешком:</h3>
                <ul className="text-sm space-y-1">
                  <li>• <span className="text-white">Джойстик</span> - движение</li>
                  <li>• <span className="text-white">F</span> - удар</li>
                  <li>• <span className="text-white">E</span> - сесть в машину</li>
                </ul>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-3">
                <h3 className="text-blue-400 font-bold mb-2">🚗 В машине:</h3>
                <ul className="text-sm space-y-1">
                  <li>• <span className="text-white">↑↓</span> - газ/тормоз</li>
                  <li>• <span className="text-white">←→</span> - поворот</li>
                  <li>• <span className="text-white">E</span> - выйти</li>
                </ul>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-3">
                <h3 className="text-yellow-400 font-bold mb-2">🎯 Миссии:</h3>
                <ul className="text-sm space-y-1">
                  <li>• Подъезжайте к цветным маркерам</li>
                  <li>• 🟢 Доставка, 🔴 Гонка, 🟡 Сбор</li>
                  <li>• Выполняйте миссии за деньги!</li>
                </ul>
              </div>
              
              <div className="bg-gray-800/50 rounded-lg p-3">
                <h3 className="text-red-400 font-bold mb-2">⚠️ Важно:</h3>
                <ul className="text-sm space-y-1">
                  <li>• Не нападайте на NPC - полиция будет преследовать!</li>
                  <li>• Уровни розыска: ⭐ до ⭐⭐⭐⭐⭐</li>
                  <li>• Полиция стреляет при высоком розыске</li>
                </ul>
              </div>
            </div>
            
            <button
              onClick={() => setShowInstructions(false)}
              className="mt-6 w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold rounded-lg text-lg hover:from-green-600 hover:to-emerald-700 transition-all active:scale-95 shadow-lg"
            >
              ▶ ИГРАТЬ
            </button>
          </div>
        </div>
      )}
      
      {/* Mini map */}
      <div className="absolute bottom-8 left-44 w-24 h-24 bg-black/60 rounded-lg border border-gray-600 overflow-hidden pointer-events-none backdrop-blur-sm hidden md:block">
        <div className="w-full h-full relative">
          <div className="absolute inset-0 bg-green-900/50" />
          {/* Roads */}
          {[-3, -2, -1, 0, 1, 2, 3].map(i => (
            <div key={`h${i}`}>
              <div className="absolute bg-gray-600/50" style={{
                left: 0, right: 0, top: `${50 + i * 14}%`, height: '2px'
              }} />
              <div className="absolute bg-gray-600/50" style={{
                top: 0, bottom: 0, left: `${50 + i * 14}%`, width: '2px'
              }} />
            </div>
          ))}
          {/* Player dot */}
          <div className="absolute w-2 h-2 bg-white rounded-full animate-pulse" 
            style={{ 
              left: '50%', top: '50%', 
              transform: 'translate(-50%, -50%)' 
            }} 
          />
        </div>
      </div>
    </div>
  );
}

export default App;
