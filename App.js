import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ==========================================
// CONFIGURACIÓN Y PARÁMETROS (Fácil de modificar en sustentación)
// ==========================================
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GROUND_HEIGHT = 80;
const PLAYER_SIZE = 45;
const PLAYER_X = 60;
const GRAVITY = 1.1;
const JUMP_FORCE = -18;
const OBSTACLE_WIDTH = 35;

// Configuración de los 3 niveles de dificultad
const DIFFICULTIES = {
  FACIL: { name: 'Fácil', speed: 6, spawnRate: 1800, pointsPerJump: 10, color: '#2ecc71' },
  MEDIO: { name: 'Medio', speed: 9, spawnRate: 1400, pointsPerJump: 20, color: '#f1c40f' },
  DIFICIL: { name: 'Difícil', speed: 13, spawnRate: 1000, pointsPerJump: 35, color: '#e74c3c' },
};

const STORAGE_KEY = '@cyber_runner_highscore';

export default function App() {
  // Estados de navegación y juego
  const [screen, setScreen] = useState('START'); // 'START', 'PLAYING', 'GAMEOVER'
  const [difficulty, setDifficulty] = useState(DIFFICULTIES.MEDIO);
  
  // Estados de métricas
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [secondsPlayed, setSecondsPlayed] = useState(0);

  // Estados de físicas (Renderizado)
  const [playerY, setPlayerY] = useState(0);
  const [obstacles, setObstacles] = useState([]);

  // Referencias para el bucle de juego (60 FPS sin re-renderizados innecesarios)
  const playerYRef = useRef(0);
  const velocityYRef = useRef(0);
  const isJumpingRef = useRef(false);
  const obstaclesRef = useRef([]);
  const scoreRef = useRef(0);

  // Cargar el mejor puntaje desde AsyncStorage al iniciar
  useEffect(() => {
    loadHighScore();
  }, []);

  const loadHighScore = async () => {
    try {
      const savedScore = await AsyncStorage.getItem(STORAGE_KEY);
      if (savedScore !== null) {
        setHighScore(parseInt(savedScore, 10));
      }
    } catch (error) {
      console.error('Error cargando puntaje:', error);
    }
  };

  const saveHighScore = async (newScore) => {
    try {
      if (newScore > highScore) {
        setHighScore(newScore);
        await AsyncStorage.setItem(STORAGE_KEY, newScore.toString());
      }
    } catch (error) {
      console.error('Error guardando puntaje:', error);
    }
  };

  // Iniciar o reiniciar partida
  const startGame = () => {
    setScore(0);
    scoreRef.current = 0;
    setSecondsPlayed(0);
    playerYRef.current = 0;
    velocityYRef.current = 0;
    isJumpingRef.current = false;
    obstaclesRef.current = [];
    setPlayerY(0);
    setObstacles([]);
    setScreen('PLAYING');
  };

  // Control táctil de salto
  const handleJump = () => {
    if (!isJumpingRef.current && screen === 'PLAYING') {
      velocityYRef.current = JUMP_FORCE;
      isJumpingRef.current = true;
    }
  };

  // Temporizador de supervivencia (cuenta segundos indefinidamente hasta perder)
  useEffect(() => {
    let timerInterval;
    if (screen === 'PLAYING') {
      timerInterval = setInterval(() => {
        setSecondsPlayed((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timerInterval);
  }, [screen]);

  // Generador de obstáculos
  useEffect(() => {
    let spawnInterval;
    if (screen === 'PLAYING') {
      spawnInterval = setInterval(() => {
        const isTall = Math.random() > 0.5;
        const newObstacle = {
          id: Date.now(),
          x: SCREEN_WIDTH + 50,
          height: isTall ? 65 : 40,
          passed: false,
        };
        obstaclesRef.current.push(newObstacle);
      }, difficulty.spawnRate);
    }
    return () => clearInterval(spawnInterval);
  }, [screen, difficulty]);

  // Bucle principal de físicas y colisiones (Game Loop a 60 FPS)
  useEffect(() => {
    let gameLoop;
    if (screen === 'PLAYING') {
      gameLoop = setInterval(() => {
        // 1. Física del jugador (Gravedad y Salto)
        if (isJumpingRef.current || playerYRef.current < 0) {
          playerYRef.current += velocityYRef.current;
          velocityYRef.current += GRAVITY;

          // Tocar el suelo
          if (playerYRef.current >= 0) {
            playerYRef.current = 0;
            velocityYRef.current = 0;
            isJumpingRef.current = false;
          }
          setPlayerY(playerYRef.current);
        }

        // 2. Movimiento de obstáculos y detección de colisiones
        const updatedObstacles = [];
        for (let obs of obstaclesRef.current) {
          obs.x -= difficulty.speed;

          // Detección de colisión (Caja AABB)
          const playerBottom = Math.abs(playerYRef.current);
          const horizontalHit =
            PLAYER_X + PLAYER_SIZE - 8 > obs.x &&
            PLAYER_X + 8 < obs.x + OBSTACLE_WIDTH;
          const verticalHit = playerBottom < obs.height - 5;

          if (horizontalHit && verticalHit) {
            endGame();
            return;
          }

          // Sumar puntos al esquivar el obstáculo
          if (!obs.passed && obs.x + OBSTACLE_WIDTH < PLAYER_X) {
            obs.passed = true;
            scoreRef.current += difficulty.pointsPerJump;
            setScore(scoreRef.current);
          }

          // Mantener obstáculo si sigue en pantalla
          if (obs.x + OBSTACLE_WIDTH > -50) {
            updatedObstacles.push(obs);
          }
        }

        obstaclesRef.current = updatedObstacles;
        setObstacles([...updatedObstacles]);
      }, 1000 / 60);
    }
    return () => clearInterval(gameLoop);
  }, [screen, difficulty]);

  const endGame = () => {
    saveHighScore(scoreRef.current);
    setScreen('GAMEOVER');
  };

  // ==========================================
  // RENDERIZADO DE PANTALLAS
  // ==========================================

  // 1. PANTALLA DE INICIO
  if (screen === 'START') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Text style={styles.title}>CYBER RUNNER</Text>
        <Text style={styles.highScoreText}>🏆 Récord Local: {highScore} pts</Text>

        <View style={styles.card}>
          <Text style={styles.subtitle}>Instrucciones:</Text>
          <Text style={styles.instructions}>
            • Toca cualquier parte de la pantalla para saltar.{'\n'}
            • Esquiva los bloques de neón para sumar puntos.{'\n'}
            • Modo infinito: ¡Sobrevive todo lo que puedas!
          </Text>
        </View>

        <Text style={styles.subtitle}>Selecciona Dificultad:</Text>
        <View style={styles.difficultyContainer}>
          {Object.values(DIFFICULTIES).map((level) => (
            <TouchableOpacity
              key={level.name}
              style={[
                styles.diffButton,
                { borderColor: level.color },
                difficulty.name === level.name && { backgroundColor: level.color },
              ]}
              onPress={() => setDifficulty(level)}
            >
              <Text
                style={[
                  styles.diffText,
                  difficulty.name === level.name && { color: '#121212' },
                ]}
              >
                {level.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.playButton} onPress={startGame}>
          <Text style={styles.playButtonText}>INICIAR JUEGO</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // 2. PANTALLA DE JUEGO
  if (screen === 'PLAYING') {
    return (
      <TouchableOpacity
        activeOpacity={1}
        style={styles.gameContainer}
        onPress={handleJump}
      >
        <StatusBar barStyle="light-content" />
        
        {/* HUD Superior */}
        <View style={styles.hud}>
          <Text style={styles.hudText}>Puntos: {score}</Text>
          <Text style={styles.hudText}>Tiempo: {secondsPlayed}s</Text>
          <Text style={[styles.hudText, { color: difficulty.color }]}>
            {difficulty.name}
          </Text>
        </View>

        {/* Área de juego */}
        <View style={styles.playArea}>
          {/* Jugador */}
          <View
            style={[
              styles.player,
              {
                bottom: GROUND_HEIGHT - playerY,
              },
            ]}
          />

          {/* Obstáculos */}
          {obstacles.map((obs) => (
            <View
              key={obs.id}
              style={[
                styles.obstacle,
                {
                  left: obs.x,
                  height: obs.height,
                  backgroundColor: difficulty.color,
                },
              ]}
            />
          ))}

          {/* Suelo */}
          <View style={styles.ground} />
        </View>
      </TouchableOpacity>
    );
  }

  // 3. PANTALLA DE GAME OVER
  return (
    <SafeAreaView style={styles.container}>
      <Text style={[styles.title, { color: '#e74c3c' }]}>GAME OVER</Text>
      <Text style={styles.subtitle}>Chocaste contra un obstáculo</Text>

      <View style={styles.card}>
        <Text style={styles.resultText}>Puntaje Final: {score}</Text>
        <Text style={styles.resultText}>Tiempo Sobrevivido: {secondsPlayed}s</Text>
        <Text style={styles.highScoreText}>🏆 Mejor Puntaje: {highScore}</Text>
      </View>

      <TouchableOpacity style={styles.playButton} onPress={startGame}>
        <Text style={styles.playButtonText}>REINICIAR PARTIDA</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => setScreen('START')}
      >
        <Text style={styles.secondaryButtonText}>Cambiar Dificultad</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ==========================================
// ESTILOS DE LA INTERFAZ
// ==========================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  gameContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#38bdf8',
    letterSpacing: 2,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e2e8f0',
    marginBottom: 10,
  },
  highScoreText: {
    fontSize: 18,
    color: '#fbbf24',
    fontWeight: 'bold',
    marginVertical: 10,
  },
  card: {
    backgroundColor: '#1e293b',
    padding: 20,
    borderRadius: 12,
    width: '100%',
    marginVertical: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  instructions: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 24,
  },
  difficultyContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 25,
  },
  diffButton: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 5,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
  },
  diffText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  playButton: {
    backgroundColor: '#38bdf8',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginTop: 10,
  },
  playButtonText: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    marginTop: 15,
    padding: 10,
  },
  secondaryButtonText: {
    color: '#94a3b8',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#1e293b',
  },
  hudText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: 'bold',
  },
  playArea: {
    flex: 1,
    position: 'relative',
  },
  player: {
    position: 'absolute',
    left: PLAYER_X,
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    backgroundColor: '#38bdf8',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  obstacle: {
    position: 'absolute',
    bottom: GROUND_HEIGHT,
    width: OBSTACLE_WIDTH,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
  },
  ground: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    height: GROUND_HEIGHT,
    backgroundColor: '#334155',
    borderTopWidth: 3,
    borderTopColor: '#38bdf8',
  },
  resultText: {
    color: '#f8fafc',
    fontSize: 18,
    marginVertical: 5,
  },
});
