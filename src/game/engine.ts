import * as THREE from 'three';

// Game constants
const WORLD_SIZE = 500;
const BUILDING_COUNT = 80;
const VEHICLE_COUNT = 15;
const NPC_COUNT = 20;
const POLICE_COUNT = 5;
const PLAYER_SPEED = 0.15;
const VEHICLE_SPEED = 0.4;
const VEHICLE_TURN_SPEED = 0.03;
const FIGHT_RANGE = 3;
const ENTER_VEHICLE_RANGE = 5;

export interface GameState {
  playerHealth: number;
  wantedLevel: number;
  inVehicle: boolean;
  speed: number;
  score: number;
  message: string;
  nearVehicle: boolean;
  nearNPC: boolean;
  missionText: string;
  missionActive: boolean;
}

export class GameEngine {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private player!: THREE.Group;
  private vehicles: THREE.Group[] = [];
  private npcs: THREE.Group[] = [];
  private police: THREE.Group[] = [];
  private buildings: THREE.Mesh[] = [];
  private trees: THREE.Group[] = [];
  
  private playerVelocity = new THREE.Vector3();
  private playerRotation = 0;
  private playerHealth = 100;
  private wantedLevel = 0;
  private inVehicle = false;
  private currentVehicle: THREE.Group | null = null;
  private vehicleVelocity = new THREE.Vector3();
  private vehicleRotation = 0;
  
  private joystickInput = { x: 0, y: 0 };
  private arrowKeys = { up: false, down: false, left: false, right: false };
  private isFighting = false;
  private fightCooldown = 0;
  
  private clock = new THREE.Clock();
  private stateCallback: ((state: GameState) => void) | null = null;
  private score = 0;
  private message = '';
  private messageTimeout = 0;
  
  private npcTargets: Map<THREE.Group, THREE.Vector3> = new Map();
  private policeTargets: Map<THREE.Group, THREE.Vector3> = new Map();
  private npcStates: Map<THREE.Group, string> = new Map();
  
  // Mission system
  private missionMarkers: THREE.Mesh[] = [];
  private missionText = '';
  private missionActive = false;
  private missionTarget: THREE.Vector3 | null = null;
  private missionType = '';
  private missionTimer = 0;
  
  // Visual effects
  private particles: THREE.Mesh[] = [];
  private npcHealth: Map<THREE.Group, number> = new Map();
  
  // Audio
  private audioCtx: AudioContext | null = null;

  constructor(container: HTMLElement) {
    // Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    this.scene.fog = new THREE.Fog(0x87CEEB, 100, 400);

    // Camera
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Lighting
    this.setupLighting();
    
    // Create world
    this.createGround();
    this.createRoads();
    this.createBuildings();
    this.createStreetLights();
    this.createTrafficLights();
    this.createTrees();
    this.createPlayer();
    this.createVehicles();
    this.createNPCs();
    this.createPolice();

    // Create missions
    this.createMissions();

    // Event listeners
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));

    // Start game loop
    this.animate();
  }

  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0x87CEEB, 0x3d5c3d, 0.3);
    this.scene.add(hemisphereLight);
  }

  private createGround() {
    const groundGeometry = new THREE.PlaneGeometry(WORLD_SIZE * 2, WORLD_SIZE * 2);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x4a7c4a });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private createRoads() {
    const roadMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });

    // Main roads grid
    for (let i = -3; i <= 3; i++) {
      // Horizontal roads
      const hRoad = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE * 2, 16), roadMaterial);
      hRoad.rotation.x = -Math.PI / 2;
      hRoad.position.set(0, 0.01, i * 70);
      hRoad.receiveShadow = true;
      this.scene.add(hRoad);

      // Road lines
      const hLine = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_SIZE * 2, 0.5), lineMaterial);
      hLine.rotation.x = -Math.PI / 2;
      hLine.position.set(0, 0.02, i * 70);
      this.scene.add(hLine);

      // Vertical roads
      const vRoad = new THREE.Mesh(new THREE.PlaneGeometry(16, WORLD_SIZE * 2), roadMaterial);
      vRoad.rotation.x = -Math.PI / 2;
      vRoad.position.set(i * 70, 0.01, 0);
      vRoad.receiveShadow = true;
      this.scene.add(vRoad);

      // Road lines
      const vLine = new THREE.Mesh(new THREE.PlaneGeometry(0.5, WORLD_SIZE * 2), lineMaterial);
      vLine.rotation.x = -Math.PI / 2;
      vLine.position.set(i * 70, 0.02, 0);
      this.scene.add(vLine);
    }

    // Sidewalks along roads
    const sidewalkMaterial = new THREE.MeshLambertMaterial({ color: 0x999999 });
    for (let i = -3; i <= 3; i++) {
      for (let side = -1; side <= 1; side += 2) {
        const hSidewalk = new THREE.Mesh(new THREE.BoxGeometry(WORLD_SIZE * 2, 0.3, 3), sidewalkMaterial);
        hSidewalk.position.set(0, 0.15, i * 70 + side * 9.5);
        hSidewalk.receiveShadow = true;
        this.scene.add(hSidewalk);

        const vSidewalk = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, WORLD_SIZE * 2), sidewalkMaterial);
        vSidewalk.position.set(i * 70 + side * 9.5, 0.15, 0);
        vSidewalk.receiveShadow = true;
        this.scene.add(vSidewalk);
      }
    }
  }

  private createBuildings() {
    const buildingColors = [0x8B4513, 0x696969, 0x4682B4, 0x8FBC8F, 0xCD853F, 0x708090, 0xA0522D, 0x556B2F];
    
    for (let i = 0; i < BUILDING_COUNT; i++) {
      const width = 10 + Math.random() * 20;
      const depth = 10 + Math.random() * 20;
      const height = 10 + Math.random() * 50;
      
      const geometry = new THREE.BoxGeometry(width, height, depth);
      const material = new THREE.MeshLambertMaterial({ 
        color: buildingColors[Math.floor(Math.random() * buildingColors.length)] 
      });
      const building = new THREE.Mesh(geometry, material);
      
      // Position buildings away from roads
      let x, z;
      do {
        x = (Math.random() - 0.5) * WORLD_SIZE * 1.5;
        z = (Math.random() - 0.5) * WORLD_SIZE * 1.5;
      } while (this.isOnRoad(x, z));
      
      building.position.set(x, height / 2, z);
      building.castShadow = true;
      building.receiveShadow = true;
      this.scene.add(building);
      this.buildings.push(building);

      // Windows
      const windowMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFF99 });
      const windowRows = Math.floor(height / 4);
      const windowCols = Math.floor(width / 4);
      for (let row = 0; row < windowRows; row++) {
        for (let col = 0; col < windowCols; col++) {
          if (Math.random() > 0.3) {
            const windowGeom = new THREE.PlaneGeometry(1.5, 2);
            const windowMesh = new THREE.Mesh(windowGeom, Math.random() > 0.5 ? windowMaterial : new THREE.MeshBasicMaterial({ color: 0x333355 }));
            windowMesh.position.set(
              x - width/2 + 2 + col * 4,
              2 + row * 4,
              z + depth/2 + 0.01
            );
            this.scene.add(windowMesh);
          }
        }
      }
    }
  }

  private createStreetLights() {
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffaa });
    
    for (let i = -3; i <= 3; i++) {
      for (let j = -5; j <= 5; j++) {
        // Along horizontal roads
        const pole1 = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 8), poleMat);
        pole1.position.set(j * 40, 4, i * 70 + 11);
        pole1.castShadow = true;
        this.scene.add(pole1);
        
        const lamp1 = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), lightMat);
        lamp1.position.set(j * 40, 8.2, i * 70 + 11);
        this.scene.add(lamp1);
        
        // Point light for atmosphere
        const pLight = new THREE.PointLight(0xffffaa, 0.3, 20);
        pLight.position.set(j * 40, 8, i * 70 + 11);
        this.scene.add(pLight);
      }
    }
  }

  private createTrafficLights() {
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.1, 5),
          new THREE.MeshLambertMaterial({ color: 0x333333 })
        );
        pole.position.set(i * 70 + 9, 2.5, j * 70 + 9);
        this.scene.add(pole);
        
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 1.5, 0.5),
          new THREE.MeshLambertMaterial({ color: 0x222222 })
        );
        box.position.set(i * 70 + 9, 5.5, j * 70 + 9);
        this.scene.add(box);
        
        // Lights
        const colors = [0xff0000, 0xffff00, 0x00ff00];
        colors.forEach((color, idx) => {
          const light = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 8, 8),
            new THREE.MeshBasicMaterial({ color })
          );
          light.position.set(i * 70 + 9, 6 - idx * 0.5, j * 70 + 9.3);
          this.scene.add(light);
        });
      }
    }
  }

  private createTrees() {
    for (let i = 0; i < 60; i++) {
      const tree = new THREE.Group();
      
      const trunkGeom = new THREE.CylinderGeometry(0.3, 0.5, 4);
      const trunkMat = new THREE.MeshLambertMaterial({ color: 0x4a2f00 });
      const trunk = new THREE.Mesh(trunkGeom, trunkMat);
      trunk.position.y = 2;
      trunk.castShadow = true;
      tree.add(trunk);
      
      const leavesGeom = new THREE.SphereGeometry(2.5, 8, 6);
      const leavesMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });
      const leaves = new THREE.Mesh(leavesGeom, leavesMat);
      leaves.position.y = 5;
      leaves.castShadow = true;
      tree.add(leaves);
      
      let x, z;
      do {
        x = (Math.random() - 0.5) * WORLD_SIZE * 1.5;
        z = (Math.random() - 0.5) * WORLD_SIZE * 1.5;
      } while (this.isOnRoad(x, z));
      
      tree.position.set(x, 0, z);
      this.scene.add(tree);
      this.trees.push(tree);
    }
  }

  private createPlayer() {
    this.player = new THREE.Group();
    
    // Body
    const bodyGeom = new THREE.BoxGeometry(1, 1.5, 0.8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2244aa });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 1.75;
    body.castShadow = true;
    this.player.add(body);
    
    // Head
    const headGeom = new THREE.SphereGeometry(0.4, 8, 8);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xFFDBAC });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.y = 2.9;
    head.castShadow = true;
    this.player.add(head);
    
    // Legs
    const legGeom = new THREE.BoxGeometry(0.35, 1, 0.35);
    const legMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const leftLeg = new THREE.Mesh(legGeom, legMat);
    leftLeg.position.set(-0.25, 0.5, 0);
    leftLeg.castShadow = true;
    this.player.add(leftLeg);
    
    const rightLeg = new THREE.Mesh(legGeom, legMat);
    rightLeg.position.set(0.25, 0.5, 0);
    rightLeg.castShadow = true;
    this.player.add(rightLeg);
    
    // Arms
    const armGeom = new THREE.BoxGeometry(0.3, 1.2, 0.3);
    const armMat = new THREE.MeshLambertMaterial({ color: 0x2244aa });
    const leftArm = new THREE.Mesh(armGeom, armMat);
    leftArm.position.set(-0.7, 1.8, 0);
    leftArm.castShadow = true;
    this.player.add(leftArm);
    
    const rightArm = new THREE.Mesh(armGeom, armMat);
    rightArm.position.set(0.7, 1.8, 0);
    rightArm.castShadow = true;
    this.player.add(rightArm);
    
    this.player.position.set(0, 0, 0);
    this.scene.add(this.player);
  }

  private createVehicles() {
    const carColors = [0xff0000, 0x0000ff, 0xffff00, 0x00ff00, 0xff6600, 0x9900ff, 0x00ffff, 0xffffff, 0x333333, 0x8B0000, 0x006400, 0x4B0082];
    
    for (let i = 0; i < VEHICLE_COUNT; i++) {
      const type = Math.random();
      let car: THREE.Group;
      
      if (type < 0.2) {
        car = this.createSportsCar(carColors[Math.floor(Math.random() * carColors.length)]);
      } else if (type < 0.35) {
        car = this.createTruck(carColors[Math.floor(Math.random() * carColors.length)]);
      } else {
        car = this.createCar(carColors[Math.floor(Math.random() * carColors.length)]);
      }
      
      let x, z;
      do {
        x = (Math.random() - 0.5) * WORLD_SIZE;
        z = (Math.random() - 0.5) * WORLD_SIZE;
      } while (!this.isOnRoad(x, z));
      
      car.position.set(x, 0, z);
      car.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(car);
      this.vehicles.push(car);
    }
  }

  private createSportsCar(color: number): THREE.Group {
    const car = new THREE.Group();
    
    // Lower, sleeker body
    const bodyGeom = new THREE.BoxGeometry(4.5, 0.9, 2);
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    car.add(body);
    
    // Sleek roof
    const roofGeom = new THREE.BoxGeometry(1.8, 0.7, 1.7);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.set(-0.3, 1.3, 0);
    roof.castShadow = true;
    car.add(roof);
    
    // Spoiler
    const spoilerGeom = new THREE.BoxGeometry(0.3, 0.5, 2);
    const spoilerMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const spoiler = new THREE.Mesh(spoilerGeom, spoilerMat);
    spoiler.position.set(-2.2, 1.2, 0);
    car.add(spoiler);
    
    // Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.35, 12);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const wheelPositions = [
      [1.4, 0.35, 1.1], [1.4, 0.35, -1.1],
      [-1.4, 0.35, 1.1], [-1.4, 0.35, -1.1]
    ];
    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeom, wheelMat);
      wheel.position.set(wx, wy, wz);
      wheel.rotation.x = Math.PI / 2;
      car.add(wheel);
    });
    
    return car;
  }

  private createTruck(color: number): THREE.Group {
    const car = new THREE.Group();
    
    // Cab
    const cabGeom = new THREE.BoxGeometry(2.5, 2, 2.4);
    const cabMat = new THREE.MeshLambertMaterial({ color });
    const cab = new THREE.Mesh(cabGeom, cabMat);
    cab.position.set(1.5, 1.2, 0);
    cab.castShadow = true;
    car.add(cab);
    
    // Cargo
    const cargoGeom = new THREE.BoxGeometry(4, 2.5, 2.6);
    const cargoMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
    const cargo = new THREE.Mesh(cargoGeom, cargoMat);
    cargo.position.set(-1.5, 1.4, 0);
    cargo.castShadow = true;
    car.add(cargo);
    
    // Wheels (bigger)
    const wheelGeom = new THREE.CylinderGeometry(0.5, 0.5, 0.4, 12);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const wheelPositions = [
      [2, 0.5, 1.3], [2, 0.5, -1.3],
      [-1, 0.5, 1.3], [-1, 0.5, -1.3],
      [-3, 0.5, 1.3], [-3, 0.5, -1.3]
    ];
    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeom, wheelMat);
      wheel.position.set(wx, wy, wz);
      wheel.rotation.x = Math.PI / 2;
      car.add(wheel);
    });
    
    return car;
  }

  private createCar(color: number): THREE.Group {
    const car = new THREE.Group();
    
    // Car body
    const bodyGeom = new THREE.BoxGeometry(4, 1.2, 2);
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.8;
    body.castShadow = true;
    car.add(body);
    
    // Car roof
    const roofGeom = new THREE.BoxGeometry(2.2, 1, 1.8);
    const roofMat = new THREE.MeshLambertMaterial({ color });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.set(-0.2, 1.8, 0);
    roof.castShadow = true;
    car.add(roof);
    
    // Windows
    const windowMat = new THREE.MeshLambertMaterial({ color: 0x88ccff, transparent: true, opacity: 0.7 });
    const frontWindow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.8), windowMat);
    frontWindow.position.set(0.9, 1.7, 0);
    frontWindow.rotation.y = Math.PI / 2;
    car.add(frontWindow);
    
    // Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 12);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const wheelPositions = [
      [1.2, 0.4, 1.1], [1.2, 0.4, -1.1],
      [-1.2, 0.4, 1.1], [-1.2, 0.4, -1.1]
    ];
    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeom, wheelMat);
      wheel.position.set(wx, wy, wz);
      wheel.rotation.x = Math.PI / 2;
      wheel.castShadow = true;
      car.add(wheel);
    });
    
    // Headlights
    const lightGeom = new THREE.SphereGeometry(0.2, 8, 8);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffcc });
    const hl1 = new THREE.Mesh(lightGeom, lightMat);
    hl1.position.set(2, 0.8, 0.6);
    car.add(hl1);
    const hl2 = new THREE.Mesh(lightGeom, lightMat);
    hl2.position.set(2, 0.8, -0.6);
    car.add(hl2);
    
    // Taillights
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const tl1 = new THREE.Mesh(lightGeom, tailMat);
    tl1.position.set(-2, 0.8, 0.6);
    car.add(tl1);
    const tl2 = new THREE.Mesh(lightGeom, tailMat);
    tl2.position.set(-2, 0.8, -0.6);
    car.add(tl2);
    
    return car;
  }

  private createNPCs() {
    const skinColors = [0xFFDBAC, 0xD2956A, 0x8D5524, 0xC68642];
    const shirtColors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff, 0xff8800, 0x8800ff];
    
    for (let i = 0; i < NPC_COUNT; i++) {
      const npc = new THREE.Group();
      
      const skinColor = skinColors[Math.floor(Math.random() * skinColors.length)];
      const shirtColor = shirtColors[Math.floor(Math.random() * shirtColors.length)];
      
      // Body
      const bodyGeom = new THREE.BoxGeometry(1, 1.5, 0.8);
      const bodyMat = new THREE.MeshLambertMaterial({ color: shirtColor });
      const body = new THREE.Mesh(bodyGeom, bodyMat);
      body.position.y = 1.75;
      body.castShadow = true;
      npc.add(body);
      
      // Head
      const headGeom = new THREE.SphereGeometry(0.4, 8, 8);
      const headMat = new THREE.MeshLambertMaterial({ color: skinColor });
      const head = new THREE.Mesh(headGeom, headMat);
      head.position.y = 2.9;
      head.castShadow = true;
      npc.add(head);
      
      // Legs
      const legGeom = new THREE.BoxGeometry(0.35, 1, 0.35);
      const legMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
      const leftLeg = new THREE.Mesh(legGeom, legMat);
      leftLeg.position.set(-0.25, 0.5, 0);
      npc.add(leftLeg);
      const rightLeg = new THREE.Mesh(legGeom, legMat);
      rightLeg.position.set(0.25, 0.5, 0);
      npc.add(rightLeg);
      
      let x, z;
      do {
        x = (Math.random() - 0.5) * WORLD_SIZE;
        z = (Math.random() - 0.5) * WORLD_SIZE;
      } while (this.isOnRoad(x, z));
      
      npc.position.set(x, 0, z);
      npc.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(npc);
      this.npcs.push(npc);
      this.npcTargets.set(npc, new THREE.Vector3(
        (Math.random() - 0.5) * WORLD_SIZE,
        0,
        (Math.random() - 0.5) * WORLD_SIZE
      ));
      this.npcStates.set(npc, 'walking');
      this.npcHealth.set(npc, 100);
    }
  }

  private createPolice() {
    for (let i = 0; i < POLICE_COUNT; i++) {
      const police = this.createPoliceCar();
      
      let x, z;
      do {
        x = (Math.random() - 0.5) * WORLD_SIZE;
        z = (Math.random() - 0.5) * WORLD_SIZE;
      } while (!this.isOnRoad(x, z));
      
      police.position.set(x, 0, z);
      police.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(police);
      this.police.push(police);
      this.policeTargets.set(police, new THREE.Vector3(
        (Math.random() - 0.5) * WORLD_SIZE,
        0,
        (Math.random() - 0.5) * WORLD_SIZE
      ));
    }
  }

  private createPoliceCar(): THREE.Group {
    const car = new THREE.Group();
    
    // Car body - black and white
    const bodyGeom = new THREE.BoxGeometry(4.5, 1.3, 2.2);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.85;
    body.castShadow = true;
    car.add(body);
    
    // White stripe
    const stripeGeom = new THREE.BoxGeometry(4.52, 0.4, 2.22);
    const stripeMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const stripe = new THREE.Mesh(stripeGeom, stripeMat);
    stripe.position.y = 0.6;
    car.add(stripe);
    
    // Roof
    const roofGeom = new THREE.BoxGeometry(2.5, 1, 2);
    const roofMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.set(-0.2, 1.9, 0);
    roof.castShadow = true;
    car.add(roof);
    
    // Police lights
    const lightBarGeom = new THREE.BoxGeometry(1.5, 0.3, 0.5);
    const lightBarMat = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const lightBar = new THREE.Mesh(lightBarGeom, lightBarMat);
    lightBar.position.set(-0.2, 2.5, 0);
    car.add(lightBar);
    
    const redLight = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
    redLight.position.set(-0.7, 2.5, 0);
    redLight.name = 'redLight';
    car.add(redLight);
    
    const blueLight = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({ color: 0x0000ff }));
    blueLight.position.set(0.3, 2.5, 0);
    blueLight.name = 'blueLight';
    car.add(blueLight);
    
    // Wheels
    const wheelGeom = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const wheelPositions = [
      [1.4, 0.45, 1.2], [1.4, 0.45, -1.2],
      [-1.4, 0.45, 1.2], [-1.4, 0.45, -1.2]
    ];
    wheelPositions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeom, wheelMat);
      wheel.position.set(wx, wy, wz);
      wheel.rotation.x = Math.PI / 2;
      car.add(wheel);
    });
    
    // "POLICE" text representation (simplified as a colored panel)
    const textGeom = new THREE.PlaneGeometry(2, 0.4);
    const textMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const textPanel = new THREE.Mesh(textGeom, textMat);
    textPanel.position.set(0, 1.2, 1.12);
    car.add(textPanel);
    
    return car;
  }

  private isOnRoad(x: number, z: number): boolean {
    for (let i = -3; i <= 3; i++) {
      if (Math.abs(z - i * 70) < 12) return true;
      if (Math.abs(x - i * 70) < 12) return true;
    }
    return false;
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private onKeyDown(e: KeyboardEvent) {
    switch(e.key) {
      case 'ArrowUp': case 'w': case 'W': case 'ц': case 'Ц':
        this.arrowKeys.up = true; break;
      case 'ArrowDown': case 's': case 'S': case 'ы': case 'Ы':
        this.arrowKeys.down = true; break;
      case 'ArrowLeft': case 'a': case 'A': case 'ф': case 'Ф':
        this.arrowKeys.left = true; break;
      case 'ArrowRight': case 'd': case 'D': case 'в': case 'В':
        this.arrowKeys.right = true; break;
      case 'f': case 'F': case 'а': case 'А':
        this.startFight();
        break;
      case 'e': case 'E': case 'у': case 'У':
        this.tryEnterVehicle();
        break;
    }
  }

  private onKeyUp(e: KeyboardEvent) {
    switch(e.key) {
      case 'ArrowUp': case 'w': case 'W': case 'ц': case 'Ц':
        this.arrowKeys.up = false; break;
      case 'ArrowDown': case 's': case 'S': case 'ы': case 'Ы':
        this.arrowKeys.down = false; break;
      case 'ArrowLeft': case 'a': case 'A': case 'ф': case 'Ф':
        this.arrowKeys.left = false; break;
      case 'ArrowRight': case 'd': case 'D': case 'в': case 'В':
        this.arrowKeys.right = false; break;
    }
  }

  setJoystickInput(x: number, y: number) {
    this.joystickInput.x = x;
    this.joystickInput.y = y;
  }

  startFight() {
    if (this.fightCooldown <= 0 && !this.inVehicle) {
      this.isFighting = true;
      this.fightCooldown = 30;
      
      // Check if any NPC or police is in range
      const playerPos = this.player.position;
      
      this.npcs.forEach(npc => {
        const dist = playerPos.distanceTo(npc.position);
        if (dist < FIGHT_RANGE) {
          // NPC gets hit
          const knockback = new THREE.Vector3()
            .subVectors(npc.position, playerPos)
            .normalize()
            .multiplyScalar(3);
          npc.position.add(knockback);
          
          // Reduce NPC health
          const health = (this.npcHealth.get(npc) || 100) - 35;
          this.npcHealth.set(npc, health);
          
          // Create hit particles
          this.createHitEffect(npc.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
          this.playSound('hit');
          
          if (health <= 0) {
            // NPC "dies" - falls and respawns later
            npc.visible = false;
            this.score += 25;
            this.showMessage('Нокаут! +25');
            
            // Respawn NPC after delay
            setTimeout(() => {
              npc.visible = true;
              npc.position.set(
                (Math.random() - 0.5) * WORLD_SIZE,
                0,
                (Math.random() - 0.5) * WORLD_SIZE
              );
              this.npcHealth.set(npc, 100);
              this.npcStates.set(npc, 'walking');
              this.npcTargets.set(npc, new THREE.Vector3(
                (Math.random() - 0.5) * WORLD_SIZE,
                0,
                (Math.random() - 0.5) * WORLD_SIZE
              ));
            }, 10000);
          } else {
            this.score += 10;
            this.showMessage('Удар! +10');
            // NPC runs away
            this.npcStates.set(npc, 'fleeing');
            const fleeDir = new THREE.Vector3()
              .subVectors(npc.position, playerPos)
              .normalize()
              .multiplyScalar(100);
            this.npcTargets.set(npc, npc.position.clone().add(fleeDir));
          }
          
          // Increase wanted level
          this.wantedLevel = Math.min(5, this.wantedLevel + 0.3);
        }
      });
      
      this.police.forEach(police => {
        const dist = playerPos.distanceTo(police.position);
        if (dist < FIGHT_RANGE) {
          this.wantedLevel = Math.min(5, this.wantedLevel + 1);
          this.showMessage('Атака на полицию! Розыск +1');
        }
      });
    }
  }

  tryEnterVehicle() {
    if (this.inVehicle) {
      // Exit vehicle
      this.exitVehicle();
    } else {
      // Try to enter nearest vehicle
      const playerPos = this.player.position;
      let nearestVehicle: THREE.Group | null = null;
      let nearestDist = ENTER_VEHICLE_RANGE;
      
      this.vehicles.forEach(vehicle => {
        const dist = playerPos.distanceTo(vehicle.position);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestVehicle = vehicle;
        }
      });
      
      if (nearestVehicle) {
        this.enterVehicle(nearestVehicle);
      }
    }
  }

  private enterVehicle(vehicle: THREE.Group) {
    this.inVehicle = true;
    this.currentVehicle = vehicle;
    this.player.visible = false;
    this.vehicleRotation = vehicle.rotation.y;
    this.showMessage('Вы сели в машину');
    this.playSound('enter');
  }

  private exitVehicle() {
    if (this.currentVehicle) {
      this.inVehicle = false;
      this.player.visible = true;
      
      // Place player next to vehicle
      const offset = new THREE.Vector3(3, 0, 0);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.currentVehicle.rotation.y);
      this.player.position.copy(this.currentVehicle.position).add(offset);
      this.player.position.y = 0;
      
      this.currentVehicle = null;
      this.vehicleVelocity.set(0, 0, 0);
      this.showMessage('Вы вышли из машины');
      this.playSound('exit');
    }
  }

  private showMessage(msg: string) {
    this.message = msg;
    this.messageTimeout = 120;
  }

  private updatePlayer() {
    if (this.inVehicle) {
      this.updateVehicleControls();
    } else {
      this.updateOnFootControls();
    }
  }

  private updateOnFootControls() {
    let moveX = 0;
    let moveZ = 0;
    
    // Joystick input
    if (Math.abs(this.joystickInput.x) > 0.1 || Math.abs(this.joystickInput.y) > 0.1) {
      moveX = this.joystickInput.x;
      moveZ = -this.joystickInput.y;
    }
    
    // Keyboard input (WASD as alternative)
    if (this.arrowKeys.up) moveZ = -1;
    if (this.arrowKeys.down) moveZ = 1;
    if (this.arrowKeys.left) moveX = -1;
    if (this.arrowKeys.right) moveX = 1;
    
    const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
    const isMoving = length > 0;
    
    if (isMoving) {
      moveX /= length;
      moveZ /= length;
      
      this.player.position.x += moveX * PLAYER_SPEED;
      this.player.position.z += moveZ * PLAYER_SPEED;
      
      // Rotate player to face movement direction
      this.playerRotation = Math.atan2(moveX, moveZ);
      this.player.rotation.y = this.playerRotation;
      
      // Walking animation - bob up and down
      const time = this.clock.getElapsedTime();
      this.player.position.y = Math.abs(Math.sin(time * 8)) * 0.15;
      
      // Arm swing animation
      const armSwing = Math.sin(time * 8) * 0.5;
      if (this.player.children[4]) this.player.children[4].rotation.x = armSwing;
      if (this.player.children[5]) this.player.children[5].rotation.x = -armSwing;
      // Leg swing
      if (this.player.children[2]) this.player.children[2].rotation.x = -armSwing * 0.7;
      if (this.player.children[3]) this.player.children[3].rotation.x = armSwing * 0.7;
    } else {
      this.player.position.y = 0;
      // Reset animations
      if (this.player.children[4]) this.player.children[4].rotation.x = 0;
      if (this.player.children[5]) this.player.children[5].rotation.x = 0;
      if (this.player.children[2]) this.player.children[2].rotation.x = 0;
      if (this.player.children[3]) this.player.children[3].rotation.x = 0;
    }
    
    // Boundary check
    this.player.position.x = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, this.player.position.x));
    this.player.position.z = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, this.player.position.z));
    
    // Building collision
    this.buildings.forEach(building => {
      const box = new THREE.Box3().setFromObject(building);
      const playerBox = new THREE.Box3().setFromCenterAndSize(
        this.player.position.clone().add(new THREE.Vector3(0, 1, 0)),
        new THREE.Vector3(1, 3, 1)
      );
      if (box.intersectsBox(playerBox)) {
        this.player.position.x -= moveX * PLAYER_SPEED * 2;
        this.player.position.z -= moveZ * PLAYER_SPEED * 2;
      }
    });
  }

  private updateVehicleControls() {
    if (!this.currentVehicle) return;
    
    let acceleration = 0;
    let turn = 0;
    
    // Arrow keys for vehicle
    if (this.arrowKeys.up) acceleration = 1;
    if (this.arrowKeys.down) acceleration = -0.5;
    if (this.arrowKeys.left) turn = 1;
    if (this.arrowKeys.right) turn = -1;
    
    // Joystick for vehicle
    if (Math.abs(this.joystickInput.x) > 0.1 || Math.abs(this.joystickInput.y) > 0.1) {
      acceleration = -this.joystickInput.y;
      turn = -this.joystickInput.x;
    }
    
    // Apply acceleration
    const speed = this.vehicleVelocity.length();
    if (acceleration !== 0) {
      const forward = new THREE.Vector3(0, 0, -1);
      forward.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.vehicleRotation);
      this.vehicleVelocity.add(forward.multiplyScalar(acceleration * 0.02));
    }
    
    // Apply friction
    this.vehicleVelocity.multiplyScalar(0.98);
    
    // Apply turning (only when moving)
    if (speed > 0.01) {
      this.vehicleRotation += turn * VEHICLE_TURN_SPEED * Math.min(speed * 5, 1);
    }
    
    // Limit speed
    if (this.vehicleVelocity.length() > VEHICLE_SPEED) {
      this.vehicleVelocity.normalize().multiplyScalar(VEHICLE_SPEED);
    }
    
    // Move vehicle
    this.currentVehicle.position.add(this.vehicleVelocity);
    this.currentVehicle.rotation.y = this.vehicleRotation;
    
    // Boundary
    this.currentVehicle.position.x = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, this.currentVehicle.position.x));
    this.currentVehicle.position.z = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, this.currentVehicle.position.z));
    
    // Building collision for vehicle
    this.buildings.forEach(building => {
      const box = new THREE.Box3().setFromObject(building);
      const vehicleBox = new THREE.Box3().setFromCenterAndSize(
        this.currentVehicle!.position.clone().add(new THREE.Vector3(0, 1, 0)),
        new THREE.Vector3(5, 2, 3)
      );
      if (box.intersectsBox(vehicleBox)) {
        this.currentVehicle!.position.sub(this.vehicleVelocity.multiplyScalar(2));
        this.vehicleVelocity.multiplyScalar(0.3);
      }
    });
    
    // Check NPC collision with vehicle
    if (speed > 0.1) {
      this.npcs.forEach(npc => {
        const dist = this.currentVehicle!.position.distanceTo(npc.position);
        if (dist < 3) {
          const knockback = new THREE.Vector3()
            .subVectors(npc.position, this.currentVehicle!.position)
            .normalize()
            .multiplyScalar(5);
          npc.position.add(knockback);
          this.wantedLevel = Math.min(5, this.wantedLevel + 0.5);
          this.showMessage('Сбил пешехода!');
        }
      });
    }
  }

  private updateNPCs() {
    const time = this.clock.getElapsedTime();
    
    this.npcs.forEach(npc => {
      const target = this.npcTargets.get(npc);
      const state = this.npcStates.get(npc);
      if (!target) return;
      
      const direction = new THREE.Vector3().subVectors(target, npc.position);
      const distance = direction.length();
      
      if (distance < 3 || state === 'fleeing') {
        // New target
        if (state === 'fleeing' && distance < 3) {
          this.npcStates.set(npc, 'walking');
        }
        this.npcTargets.set(npc, new THREE.Vector3(
          (Math.random() - 0.5) * WORLD_SIZE,
          0,
          (Math.random() - 0.5) * WORLD_SIZE
        ));
      } else {
        direction.normalize();
        const speed = state === 'fleeing' ? 0.08 : 0.03;
        npc.position.add(direction.multiplyScalar(speed));
        npc.rotation.y = Math.atan2(direction.x, direction.z);
        
        // Walking animation
        const legAngle = Math.sin(time * 5) * 0.3;
        if (npc.children[2]) npc.children[2].rotation.x = legAngle;
        if (npc.children[3]) npc.children[3].rotation.x = -legAngle;
      }
      
      // Boundary
      npc.position.x = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, npc.position.x));
      npc.position.z = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, npc.position.z));
    });
  }

  private updatePolice() {
    const time = this.clock.getElapsedTime();
    
    this.police.forEach((police, index) => {
      // Flash lights
      const redLight = police.getObjectByName('redLight');
      const blueLight = police.getObjectByName('blueLight');
      if (redLight && blueLight) {
        const flash = Math.sin(time * 8 + index) > 0;
        (redLight as THREE.Mesh).material = new THREE.MeshBasicMaterial({ 
          color: flash ? 0xff0000 : 0x330000 
        });
        (blueLight as THREE.Mesh).material = new THREE.MeshBasicMaterial({ 
          color: flash ? 0x000033 : 0x0000ff 
        });
      }
      
      if (this.wantedLevel >= 1) {
        // Chase player
        const target = this.inVehicle ? this.currentVehicle!.position : this.player.position;
        const direction = new THREE.Vector3().subVectors(target, police.position);
        const distance = direction.length();
        
        if (distance > 5) {
          direction.normalize();
          const chaseSpeed = 0.06 + this.wantedLevel * 0.02;
          police.position.add(direction.multiplyScalar(chaseSpeed));
          police.rotation.y = Math.atan2(direction.x, direction.z);
        } else if (distance < 4) {
          // Attack player
          if (!this.inVehicle) {
            this.playerHealth -= 0.1;
            if (this.playerHealth <= 0) {
              this.showMessage('Вас арестовали! Нажмите E для респауна');
              this.playerHealth = 0;
              this.wantedLevel = 0;
              this.player.position.set(0, 0, 0);
              this.playerHealth = 100;
              this.score = Math.max(0, this.score - 50);
            }
          }
        }
      } else {
        // Patrol
        const target = this.policeTargets.get(police);
        if (target) {
          const direction = new THREE.Vector3().subVectors(target, police.position);
          if (direction.length() < 5) {
            this.policeTargets.set(police, new THREE.Vector3(
              (Math.random() - 0.5) * WORLD_SIZE,
              0,
              (Math.random() - 0.5) * WORLD_SIZE
            ));
          } else {
            direction.normalize();
            police.position.add(direction.multiplyScalar(0.04));
            police.rotation.y = Math.atan2(direction.x, direction.z);
          }
        }
      }
      
      // Boundary
      police.position.x = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, police.position.x));
      police.position.z = Math.max(-WORLD_SIZE, Math.min(WORLD_SIZE, police.position.z));
    });
    
    // Slowly decrease wanted level
    if (this.wantedLevel > 0) {
      this.wantedLevel -= 0.001;
      if (this.wantedLevel < 0) this.wantedLevel = 0;
    }
  }

  private updateCamera() {
    const targetPos = this.inVehicle && this.currentVehicle 
      ? this.currentVehicle.position 
      : this.player.position;
    
    const cameraOffset = new THREE.Vector3(0, 15, 20);
    if (this.inVehicle && this.currentVehicle) {
      cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.vehicleRotation);
    }
    
    const desiredPos = targetPos.clone().add(cameraOffset);
    this.camera.position.lerp(desiredPos, 0.05);
    this.camera.lookAt(targetPos.clone().add(new THREE.Vector3(0, 2, 0)));
  }

  private playSound(type: 'hit' | 'enter' | 'exit' | 'mission' | 'siren') {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = this.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    switch(type) {
      case 'hit':
        osc.frequency.setValueAtTime(200, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
        break;
      case 'enter':
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
        break;
      case 'exit':
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
        break;
      case 'mission':
        osc.frequency.setValueAtTime(523, ctx.currentTime);
        osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
        break;
      case 'siren':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.5);
        osc.frequency.linearRampToValueAtTime(400, ctx.currentTime + 1);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 1);
        break;
    }
  }

  private createHitEffect(position: THREE.Vector3) {
    // Create particle burst effect
    for (let i = 0; i < 8; i++) {
      const particleGeom = new THREE.SphereGeometry(0.1, 4, 4);
      const particleMat = new THREE.MeshBasicMaterial({ 
        color: Math.random() > 0.5 ? 0xffff00 : 0xff4400,
        transparent: true,
        opacity: 1
      });
      const particle = new THREE.Mesh(particleGeom, particleMat);
      particle.position.copy(position);
      particle.userData.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.3,
        Math.random() * 0.2,
        (Math.random() - 0.5) * 0.3
      );
      particle.userData.life = 30;
      this.scene.add(particle);
      this.particles.push(particle);
    }
  }

  private updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      const vel = particle.userData.velocity as THREE.Vector3;
      particle.position.add(vel);
      vel.y -= 0.01; // gravity
      particle.userData.life--;
      
      const mat = particle.material as THREE.MeshBasicMaterial;
      mat.opacity = particle.userData.life / 30;
      
      if (particle.userData.life <= 0) {
        this.scene.remove(particle);
        this.particles.splice(i, 1);
      }
    }
  }

  private createMissions() {
    const missionPositions = [
      { x: 70, z: 70, type: 'delivery', text: '📦 Доставить груз (доезжай до маркера)' },
      { x: -140, z: 0, type: 'race', text: '🏁 Гонка! Доедь до маркера за время' },
      { x: 0, z: -140, type: 'collect', text: '💰 Собрать посылку' },
      { x: -70, z: 140, type: 'delivery', text: '📦 Доставить груз' },
      { x: 210, z: -70, type: 'race', text: '🏁 Гонка!' },
    ];
    
    missionPositions.forEach(mission => {
      const markerGeom = new THREE.CylinderGeometry(2, 2, 0.3, 16);
      const markerMat = new THREE.MeshBasicMaterial({ 
        color: mission.type === 'race' ? 0xff4400 : mission.type === 'delivery' ? 0x00ff44 : 0xffaa00,
        transparent: true,
        opacity: 0.7
      });
      const marker = new THREE.Mesh(markerGeom, markerMat);
      marker.position.set(mission.x, 0.2, mission.z);
      marker.userData = { type: mission.type, text: mission.text };
      this.scene.add(marker);
      this.missionMarkers.push(marker);
      
      // Vertical beam
      const beamGeom = new THREE.CylinderGeometry(0.3, 0.3, 15, 8);
      const beamMat = new THREE.MeshBasicMaterial({ 
        color: markerMat.color,
        transparent: true,
        opacity: 0.3
      });
      const beam = new THREE.Mesh(beamGeom, beamMat);
      beam.position.set(mission.x, 7.5, mission.z);
      this.scene.add(beam);
    });
  }

  private updateMissions() {
    const time = this.clock.getElapsedTime();
    
    // Animate mission markers
    this.missionMarkers.forEach(marker => {
      marker.rotation.y = time * 2;
      marker.position.y = 0.2 + Math.sin(time * 3) * 0.2;
    });
    
    // Check if player reached mission target
    if (this.missionActive && this.missionTarget) {
      const playerPos = this.inVehicle && this.currentVehicle 
        ? this.currentVehicle.position 
        : this.player.position;
      const dist = playerPos.distanceTo(this.missionTarget);
      
      if (dist < 5) {
        // Mission complete!
        this.score += 100;
        this.missionActive = false;
        this.missionTarget = null;
        this.missionText = '';
        this.showMessage('✅ Миссия выполнена! +$100');
        this.playSound('mission');
      }
      
      // Mission timer
      this.missionTimer--;
      if (this.missionTimer <= 0) {
        this.missionActive = false;
        this.missionTarget = null;
        this.missionText = '';
        this.showMessage('❌ Миссия провалена!');
      }
    } else {
      // Check if player is near a mission marker
      const playerPos = this.inVehicle && this.currentVehicle 
        ? this.currentVehicle.position 
        : this.player.position;
      
      this.missionMarkers.forEach(marker => {
        const dist = playerPos.distanceTo(marker.position);
        if (dist < 5 && !this.missionActive) {
          // Start mission
          this.missionActive = true;
          this.missionText = marker.userData.text;
          this.missionTimer = 1800; // 30 seconds at 60fps
          
          // Set new target
          this.missionTarget = new THREE.Vector3(
            (Math.random() - 0.5) * WORLD_SIZE * 0.8,
            0,
            (Math.random() - 0.5) * WORLD_SIZE * 0.8
          );
          
          this.showMessage('🎯 ' + marker.userData.text);
          
          // Create target marker
          const targetGeom = new THREE.CylinderGeometry(3, 3, 0.3, 16);
          const targetMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.8 });
          const target = new THREE.Mesh(targetGeom, targetMat);
          target.position.copy(this.missionTarget);
          target.position.y = 0.2;
          this.scene.add(target);
          
          // Remove old target markers
          this.scene.children = this.scene.children.filter(child => {
            if (child.userData && child.userData.isMissionTarget) {
              this.scene.remove(child);
              return false;
            }
            return true;
          });
          target.userData.isMissionTarget = true;
        }
      });
    }
  }

  private animate() {
    requestAnimationFrame(() => this.animate());
    
    this.updatePlayer();
    this.updateNPCs();
    this.updatePolice();
    this.updateMissions();
    this.updateParticles();
    this.updateCamera();
    
    if (this.fightCooldown > 0) this.fightCooldown--;
    if (this.isFighting && this.fightCooldown <= 25) {
      this.isFighting = false;
    }
    
    if (this.messageTimeout > 0) {
      this.messageTimeout--;
      if (this.messageTimeout <= 0) this.message = '';
    }
    
    // Check proximity to vehicles and NPCs
    let nearVehicle = false;
    let nearNPC = false;
    if (!this.inVehicle) {
      this.vehicles.forEach(v => {
        if (this.player.position.distanceTo(v.position) < ENTER_VEHICLE_RANGE) nearVehicle = true;
      });
      this.npcs.forEach(n => {
        if (this.player.position.distanceTo(n.position) < FIGHT_RANGE) nearNPC = true;
      });
    }
    
    // Update state callback
    if (this.stateCallback) {
      this.stateCallback({
        playerHealth: this.playerHealth,
        wantedLevel: Math.floor(this.wantedLevel),
        inVehicle: this.inVehicle,
        speed: this.inVehicle && this.currentVehicle 
          ? Math.round(this.vehicleVelocity.length() * 200) 
          : 0,
        score: this.score,
        message: this.message,
        nearVehicle,
        nearNPC,
        missionText: this.missionText,
        missionActive: this.missionActive
      });
    }
    
    this.renderer.render(this.scene, this.camera);
  }

  onStateChange(callback: (state: GameState) => void) {
    this.stateCallback = callback;
  }

  respawn() {
    this.playerHealth = 100;
    this.player.position.set(0, 0, 0);
    this.wantedLevel = 0;
    if (this.inVehicle) this.exitVehicle();
  }

  dispose() {
    this.renderer.dispose();
  }
}
