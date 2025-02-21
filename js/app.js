import * as THREE from 'https://unpkg.com/three@0.162.0/build/three.module.js';
import Stats from 'https://cdnjs.cloudflare.com/ajax/libs/stats.js/17/Stats.js';
import { Pane } from 'https://cdn.jsdelivr.net/npm/tweakpane@4.0.5/dist/tweakpane.min.js';
import chroma from 'https://cdn.jsdelivr.net/npm/chroma-js@2.4.2/+esm';

async function loadShader(url) {
    const response = await fetch(url);
    return await response.text();
}

export default class Sketch {
    constructor(options) {
        this.scene = new THREE.Scene();
        this.shaders = options.shaders;
        this.posts = options.postsData;

        this.container = options.dom;
        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.container.appendChild(this.canvas);

        const gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            context: gl,
            antialias: false,
            powerPreference: "high-performance"
        });

        this.renderer.setPixelRatio(1);
        this.renderScale = 0.75;
        this.renderer.setSize(this.width * this.renderScale, this.height * this.renderScale);
        this.renderer.setClearColor(0x222222, 1);

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();

        this.container.appendChild(this.renderer.domElement);
        this.renderer.domElement.style.width = '100%';
        this.renderer.domElement.style.height = '100%';

        this.camera = new THREE.PerspectiveCamera(70, this.width / this.height, 0.01, 1000);
        this.camera.position.set(0, 0, 5);

        // Initialiser les contrôles de caméra ici
        this.cameraVelocity = new THREE.Vector3();
        this.cameraSpeed = 0.031;
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            up: false,
            down: false,
            rotateLeft: false,
            rotateRight: false,
            rotateUp: false,
            rotateDown: false
        };

        // Ajouter les event listeners pour le clavier
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('keyup', this.handleKeyUp.bind(this));

        this.axesHelper = new THREE.AxesHelper(1);
        this.scene.add(this.axesHelper);
        this.axesHelper.visible = false;

        // Remplacer OrbitControls par des propriétés pour FirstPerson
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.mouseSensitivity = 0.002;
        this.isPointerLocked = false;

        // Modifier l'event listener pour le clic
        document.addEventListener('click', (event) => {
            // Vérifier si le clic n'est pas sur le Pane
            if (!event.target.closest('.tp-dfwv')) {  // .tp-dfwv est la classe du conteneur Tweakpane
                if (!this.isPointerLocked) {
                    this.renderer.domElement.requestPointerLock();
                }
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isPointerLocked = document.pointerLockElement === this.renderer.domElement;
        });

        document.addEventListener('mousemove', this.handleMouseMove.bind(this));

        this.size = this.posts.length;

        // console.log('Posts:', this.posts);

        // Créer des Sets avec les valeurs uniques et trier par ordre alphabétique
        this.uniqueCharacters = Object.values(this.posts.reduce((acc, { character, postCharacterRank }) => {
            acc[character] = acc[character]?.postCharacterRank >= postCharacterRank 
                ? acc[character] 
                : { character, postCharacterRank };
            return acc;
        }, {})).sort((a, b) => a.character.localeCompare(b.character));
                  
        this.uniqueThematics = [...new Set(this.posts.map(post => post.thematic))];

        console.log('Unique characters:', this.uniqueCharacters);
        
        this.distinctCharacters = this.uniqueCharacters.length;
        this.distinctThematics = this.uniqueThematics.length;

        console.log('Nombre de personnages distincts:', this.distinctCharacters);
        console.log('Nombre de thématiques distinctes:', this.distinctThematics);

        // Créer la texture de palette de couleurs avec des couleurs plus distinctes
        
        const distinctCharactersColors = [
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ff00ff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff',
            '#ffffff'
        ];

        // S'assurer d'avoir assez de couleurs
        while (distinctCharactersColors.length < this.distinctCharacters) {
            distinctCharactersColors.push(chroma.random().hex());
        }

        this.characters = this.uniqueCharacters.map((char, index) => ({
            index,
            name: char.character,
            numposts: char.postCharacterRank,
            color: distinctCharactersColors[index]
        }));

        console.log('this.characters:', this.characters);
        
        this.thematicColors = chroma.scale(['#FFD700', '#FF1493', '#4B0082'])
            .mode('lch')
            .colors(this.distinctThematics);

        // Créer des maps pour accéder rapidement aux indices
        this.charactersMap = new Map(this.characters.map((char, i) => [char.name, i]));
        this.characterColorMap = new Map(this.characters.map((char, i) => [char.name, i]));
        this.thematicColorMap = new Map(this.uniqueThematics.map((theme, i) => [theme, i]));

        console.log('this.charactersMap:', this.charactersMap);

        this.time = 0;

        this.isCapturing = false;
        this.animationFrameId = null;

        this.targetFPS = 60;
        this.fpsInterval = 1000 / this.targetFPS;
        this.then = Date.now();

        this.currentPostIndex = 0;

        this.targetPositions = new Float32Array(this.size * 4);

        this.setupPane();
        this.setupEvents();
        this.showMouseTracker = false;
        this.ball.visible = false;
        
        this.setupStats();
        this.setupFBO();

        // Ajouter ces propriétés avant setupNearestPointCalculation
        this.nearestPoint = null;
        this.nearestPointDistance = Infinity;
        this.nearestPointIndex = -1;
        this.nearestPointRT = null;

        // Initialiser le calcul du point le plus proche avant updateLayout
        this.setupNearestPointCalculation();
        
        this.updateLayout();
        this.addObjects();
        this.resize();
        this.render();
        this.setupResize();

        // Ajouter cette propriété pour suivre le dernier point affiché
        this.lastLoggedPointIndex = -1;

        // Ajouter la référence à l'élément de couleur
        const colorParent = document.querySelector('.tp-v-vfst');
        this.colorElement = colorParent ? colorParent.querySelector('.tp-sglv') : null;
    }

    getRenderTarget() {
        const renderTargetOptions = {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType
        };

        return new THREE.WebGLRenderTarget(this.textureWidth, this.textureHeight, renderTargetOptions);
    }

    setupEvents() {
        this.dummy = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100),
            new THREE.MeshBasicMaterial()
        );
        // this.scene.add(this.dummy);
    
        this.ball = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 32, 32),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        this.scene.add(this.ball);
        this.ball.visible = false;
    
        this.currentTouches = [];
    
        const canvas = this.renderer.domElement;
    
        // Utiliser la détection de fonctionnalités pour choisir entre touch et pointer events
        if ('ontouchstart' in window) {
            canvas.addEventListener('touchstart', this.handleInteraction.bind(this), { passive: false });
            canvas.addEventListener('touchmove', this.handleInteraction.bind(this), { passive: false });
            canvas.addEventListener('touchend', this.handleInteractionEnd.bind(this), { passive: false });
        } else {
            canvas.addEventListener('pointermove', this.handleInteraction.bind(this));
        }
    }
    
    handleInteraction(event) {
        event.preventDefault();
        const interactions = event.touches || [event];
        this.updateInteractionPositions(interactions);
    }
    
    handleInteractionEnd(event) {
        event.preventDefault();
        this.currentTouches = [];
        this.fboMaterial.uniforms.uMouse.value.fill(new THREE.Vector2(0, 0));
        this.fboMaterial.uniforms.uTouchCount.value = 0;
    }
    
    updateInteractionPositions(interactions) {
        this.currentTouches = [];
        for (let i = 0; i < interactions.length; i++) {
            const interaction = interactions[i];
            const position = this.calculateInteractionPosition(interaction);
            if (position) {
                this.currentTouches.push(position);
            }
        }
        this.fboMaterial.uniforms.uTouchCount.value = this.currentTouches.length;
        this.updateFBOMaterialUniforms();
    }
    
    calculateInteractionPosition(interaction) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const x = (interaction.clientX - rect.left) / rect.width * 2 - 1;
        const y = - ((interaction.clientY - rect.top) / rect.height) * 2 + 1;
        
        this.raycaster.setFromCamera(new THREE.Vector2(x, y), this.camera);
        const intersects = this.raycaster.intersectObject(this.dummy);

        // console.log('pointer: ', x, y);
        // console.log('intersects', intersects);
    
        if (intersects.length > 0) {
            const { x, y } = intersects[0].point;
            if (this.showMouseTracker) {
                this.ball.position.set(x, y, 0);
                this.ball.visible = true;
            } else {
                this.ball.visible = false;
            }
            return new THREE.Vector2(x, y);
        }
        return null;
    }
    
    updateFBOMaterialUniforms() {
        for (let i = 0; i < this.fboMaterial.uniforms.uMouse.value.length; i++) {
            if (i < this.currentTouches.length) {
                this.fboMaterial.uniforms.uMouse.value[i].copy(this.currentTouches[i]);
            } else {
                this.fboMaterial.uniforms.uMouse.value[i].set(0, 0);
            }
        }
    }

    setupFBO() {
        // Calculer les dimensions optimales pour la texture
        const textureWidth = Math.min(Math.ceil(Math.sqrt(this.size)), 4096);
        const textureHeight = Math.ceil(this.size / textureWidth);
        
        this.textureWidth = textureWidth;
        this.textureHeight = textureHeight;

        const renderTargetOptions = {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType
        };

        this.fbo = new THREE.WebGLRenderTarget(textureWidth, textureHeight, renderTargetOptions);
        this.fbo1 = new THREE.WebGLRenderTarget(textureWidth, textureHeight, renderTargetOptions);

        this.fboScene = new THREE.Scene();
        this.fboCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
        this.fboCamera.position.set(0, 0, 0.5);
        this.fboCamera.lookAt(0, 0, 0);
        const geometry = new THREE.PlaneGeometry(2, 2);

        this.data = new Float32Array(textureWidth * textureHeight * 4);

        // Initialiser les positions de départ avec une distribution sphérique
        const initialRadius = 2.0;
        for (let i = 0; i < this.size; i++) {
            const index = i * 4;
            
            // Créer une position sphérique aléatoire
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            
            // Position initiale sur une sphère
            this.data[index + 0] = initialRadius * Math.sin(phi) * Math.cos(theta);
            this.data[index + 1] = initialRadius * Math.sin(phi) * Math.sin(theta);
            this.data[index + 2] = initialRadius * Math.cos(phi);
            this.data[index + 3] = 1.0;
        }

        this.fboTexture = new THREE.DataTexture(
            this.data,
            textureWidth,
            textureHeight,
            THREE.RGBAFormat,
            THREE.FloatType
        );
        this.fboTexture.minFilter = THREE.NearestFilter;
        this.fboTexture.magFilter = THREE.NearestFilter;
        this.fboTexture.needsUpdate = true;

        this.fboMaterial = new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uPosition: { value: this.fboTexture },
                uInfo: { value: null },
                uMouse: { value: new Array(10).fill(new THREE.Vector2()) },
                uTouchCount: { value: 0 },
                time: { value: 0 },
                frameDuration: { value: this.settings.frameDuration },
                thetaAmount: { value: this.settings.thetaAmount },
                phiAmount: { value: this.settings.phiAmount },
                baseRadius: { value: this.settings.baseRadius },
                distortion: { value: this.settings.distortion },
                distortionSpeed: { value: this.settings.distortionSpeed },
                interpolationAmount: { value: this.settings.interpolationAmount },
                mouseRepulsion: { value: this.settings.mouseRepulsion },
                curlAmount: { value: 0 },
            },
            vertexShader: this.shaders.simVertex,
            fragmentShader: this.shaders.simFragment
        });

        this.infoArray = new Float32Array(textureWidth * textureHeight * 4);

        for (let i = 0; i < this.size; i++) {
            const post = this.posts[i];
            const characterIndex = this.charactersMap.get(post.character);
            
            // Vérifier que l'index est valide
            if (characterIndex >= this.distinctCharacters) {
                console.error(`Index invalide pour le personnage ${post.character}:`, {
                    index: characterIndex,
                    maxIndex: this.distinctCharacters - 1
                });
            }
            
            // Stocker l'index du personnage dans le canal alpha
            this.infoArray[i * 4 + 0] = 0; // On peut utiliser ces canaux pour d'autres infos
            this.infoArray[i * 4 + 1] = 0;
            this.infoArray[i * 4 + 2] = 0;
            this.infoArray[i * 4 + 3] = characterIndex; // Stocker l'index directement sans normalisation
        }

        this.infoTexture = new THREE.DataTexture(
            this.infoArray,
            textureWidth,
            textureHeight,
            THREE.RGBAFormat,
            THREE.FloatType
        );

        this.infoTexture.minFilter = THREE.NearestFilter;
        this.infoTexture.magFilter = THREE.NearestFilter;
        this.infoTexture.needsUpdate = true;
        this.fboMaterial.uniforms.uInfo.value = this.infoTexture;

        this.fboMesh = new THREE.Mesh(geometry, this.fboMaterial);
        this.fboScene.add(this.fboMesh);

        this.renderer.setRenderTarget(this.fbo);
        this.renderer.render(this.fboScene, this.fboCamera);
        this.renderer.setRenderTarget(this.fbo1);
        this.renderer.render(this.fboScene, this.fboCamera);
    }

    addObjects() {
        this.material = new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            extensions: {
                derivatives: "#extension GL_OES_standard_derivatives : enable"
            },
            side: THREE.DoubleSide,
            uniforms: {
                time: { value: 0 },
                uPosition: { value: null },
                resolution: { value: new THREE.Vector4() },
                uNearestPointIndex: { value: -1 },
                uColors: { 
                    value: this.characters.map(charInfo => {
                        const rgb = chroma(charInfo.color).rgb();
                        return new THREE.Vector3(
                            rgb[0] / 255,
                            rgb[1] / 255,
                            rgb[2] / 255
                        );
                    })
                },
                uInfo: { value: null },
            },
            vertexShader: this.shaders.vertexParticles,
            fragmentShader: this.shaders.fragment,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.material.uniforms.uColors = { 
            value: this.characters.map(charInfo => {
                const rgb = chroma(charInfo.color).rgb();
                return new THREE.Vector3(
                    rgb[0] / 255,
                    rgb[1] / 255,
                    rgb[2] / 255
                );
            })
        };

        this.count = this.size;

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.count * 3);
        const uvs = new Float32Array(this.count * 2);

        for (let i = 0; i < this.size; i++) {
            const post = this.posts[i];
            
            // Utiliser la date de création pour positionner les points dans le temps
            const timeInfluence = (post.creationDate % 1000000) / 1000000;
            
            // Calculer les coordonnées x,y dans la texture
            const x = i % this.textureWidth;
            const y = Math.floor(i / this.textureWidth);
            
            positions[i * 3 + 0] = Math.random(); // x
            positions[i * 3 + 1] = Math.random(); // y
            positions[i * 3 + 2] = timeInfluence; // z basé sur la date
            
            // Coordonnées UV correctes pour une texture 2D
            uvs[i * 2 + 0] = x / this.textureWidth;
            uvs[i * 2 + 1] = y / this.textureHeight;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

        // Récupérer la couleur du premier post
        const firstPost = this.posts[0];
        const characterColor = this.characters[this.characterColorMap.get(firstPost.character)];
        const rgb = chroma(characterColor.color).rgb();
        const initialColor = new THREE.Vector3(
            rgb[0] / 255,
            rgb[1] / 255,
            rgb[2] / 255
        );

        this.material.uniforms.uPosition.value = this.fboTexture;
        this.material.uniforms.uInfo.value = this.infoTexture;
        this.material.uniforms.uColors.value = this.characters.map(charInfo => {
            const rgb = chroma(charInfo.color).rgb();
            return new THREE.Vector3(
                rgb[0] / 255,
                rgb[1] / 255,
                rgb[2] / 255
            );
        });
        this.points = new THREE.Points(geometry, this.material);
        this.points.frustumCulled = false;
        this.scene.add(this.points);
    }

    setupStats() {
        this.stats = new Stats();
        this.stats.showPanel(0);
        document.body.appendChild(this.stats.dom);
    }

    setupPane() {
        this.pane = new Pane();

        const logFolder = this.pane.addFolder({ 
            title: 'Log',
            expanded: true 
        });

        const layoutFolder = this.pane.addFolder({ 
            title: 'Layout',
            expanded: true 
        });
        const controlsFolder = this.pane.addFolder({ 
            title: 'Controls',
            expanded: true 
        });
        const shaderFolder = this.pane.addFolder({ 
            title: 'Shader',
            expanded: false 
        });

        this.settings = {
            thetaAmount: 0.48,
            phiAmount: 0.48,
            baseRadius: 3.0,
            distortion: 0.005,
            distortionSpeed: 0.5,
            interpolationAmount: 0.00000001,
            mouseRepulsion: 0,
            toggleCapture: false,
            curlAmount: 0,
            frameDuration: 0.001,
            cameraSpeed: 0.005,
            layout: 'Character',
            showAxes: false,
            showMouseTracker: false,
            postLog: '',
            postCharColor: '#ffffff'
        };

        logFolder.addBinding(this.settings, 'postCharColor', {
            view: 'color',
            readonly: true,
            label: 'Color',
            id: 'charColor'
        });

        logFolder.addBinding(this.settings, 'postLog', {
            readonly: true,
            multiline: true,
            rows: 5,
            label: 'Post Info'
        });

        layoutFolder.addBinding(this.settings, 'layout', {
            options: {
                Character: 'Character',
                Thematic: 'Thematic'
            },
            label: 'Layout'
        }).on('change', (ev) => {
            this.updateLayout();
        });

        shaderFolder.addBinding(this.settings, 'interpolationAmount', { min: 0, max: 0.1, step: .00000001, label: 'Interpolation amount' });
        shaderFolder.addBinding(this.settings, 'frameDuration', { min: 0, max: 1, step: 0.001, label: 'frameDuration' });
        shaderFolder.addBinding(this.settings, 'curlAmount', { min: 0, max: 1, step: 0.0001, label: 'Curl amount' });
        shaderFolder.addBinding(this.settings, 'thetaAmount', { min: 0, max: 2, step: .001, label: 'Theta amount' });
        shaderFolder.addBinding(this.settings, 'phiAmount', { min: 0, max: 2, step: .001, label: 'Phi amount' });
        shaderFolder.addBinding(this.settings, 'baseRadius', { min: 0, max: 5, step: .01, label: 'Base radius' });
        shaderFolder.addBinding(this.settings, 'distortion', { min: 0, max: 1, step: .001, label: 'Distortion' });
        shaderFolder.addBinding(this.settings, 'distortionSpeed', { min: 0, max: 5, step: .001, label: 'Distortion speed' });
        controlsFolder.addBinding(this.settings, 'cameraSpeed', { 
            min: 0.001, 
            max: 0.5, 
            step: 0.01, 
            label: 'Camera Speed' 
        });
        
        controlsFolder.addBinding(this.settings, 'mouseRepulsion', { min: 0, max: 2, step: .01, label: 'Mouse repulsion' });

        controlsFolder.addBinding(this.settings, 'showMouseTracker', {
            label: 'Show mouse tracker'
        }).on('change', (ev) => {
            this.showMouseTracker    = ev.value;
        });

        controlsFolder.addBinding(this.settings, 'showAxes', {
            label: 'Show Axes'
        }).on('change', (ev) => {
            this.axesHelper.visible = ev.value;
        });
    }

    updateLayout() {
        const centers = new Map();
        const radius = 2.0;
        console.log("Layout changed to : ", this.settings.layout);
        
        if (this.settings.layout === 'Character') {
            this.characters.forEach((character, index) => {
                const angle = (index / this.distinctCharacters) * Math.PI * 2;
                centers.set(character.name, {
                    x: Math.cos(angle) * radius,
                    y: Math.sin(angle) * radius,
                    z: 0
                });
            });
        } else {
            this.uniqueThematics.forEach((thematic, index) => {
                const angle = (index / this.distinctThematics) * Math.PI * 2;
                centers.set(thematic, {
                    x: Math.cos(angle) * radius,
                    y: Math.sin(angle) * radius,
                    z: 0
                });
            });
        }
        console.log('Centers:', centers);

        // Mettre à jour les positions cibles
        for (let i = 0; i < this.size; i++) {
            const post = this.posts[i];
            const index = i * 4;
            
            const center = centers.get(
                this.settings.layout === 'Character' ? post.character : post.thematic
            );
            
            const sphereRadius = 0.5;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos((Math.random() * 2) - 1);
            
            this.targetPositions[index + 0] = center.x + sphereRadius * Math.sin(phi) * Math.cos(theta);
            this.targetPositions[index + 1] = center.y + sphereRadius * Math.sin(phi) * Math.sin(theta);
            this.targetPositions[index + 2] = center.z + sphereRadius * Math.cos(phi);
            this.targetPositions[index + 3] = 1.0;
        }

        // Créer ou mettre à jour la texture des positions cibles
        if (!this.targetTexture) {
            this.targetTexture = new THREE.DataTexture(
                this.targetPositions,
                this.textureWidth,
                this.textureHeight,
                THREE.RGBAFormat,
                THREE.FloatType
            );
            this.targetTexture.minFilter = THREE.NearestFilter;
            this.targetTexture.magFilter = THREE.NearestFilter;
            
            // Ajouter l'uniform au shader
            this.fboMaterial.uniforms.uTargetPosition = { value: this.targetTexture };
        }

        this.targetTexture.needsUpdate = true;
    }

    setupResize() {
        window.addEventListener("resize", this.resize.bind(this));
    }

    resize() {
        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;

        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.renderer.setSize(this.width * this.renderScale, this.height * this.renderScale);
        this.renderer.domElement.style.width = this.width + 'px';
        this.renderer.domElement.style.height = this.height + 'px';

        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
    }

    getAverage(dataArray){
        var total = 0,                               // initialize to 0
            i = 0, length = dataArray.length;
        while(i < length) total += dataArray[i++];   // add all
        return length ? total / length : 0;          // divide (when length !== 0)
    }

    render() {
        this.time += this.settings.frameDuration;
    
        // Mettre à jour uniquement la caméra
        this.updateCamera();

        this.material.uniforms.time.value = this.time;
        this.fboMaterial.uniforms.time.value = this.time;
    
        this.fboMaterial.uniforms.frameDuration.value = this.settings.frameDuration;
        this.fboMaterial.uniforms.curlAmount.value = this.settings.curlAmount;
        this.fboMaterial.uniforms.thetaAmount.value = this.settings.thetaAmount;
        this.fboMaterial.uniforms.phiAmount.value = this.settings.phiAmount;
        this.fboMaterial.uniforms.baseRadius.value = this.settings.baseRadius;
        this.fboMaterial.uniforms.distortion.value = this.settings.distortion;
        this.fboMaterial.uniforms.distortionSpeed.value = this.settings.distortionSpeed;
        this.fboMaterial.uniforms.interpolationAmount.value = this.settings.interpolationAmount;
        this.fboMaterial.uniforms.mouseRepulsion.value = this.settings.mouseRepulsion;
    
        const now = Date.now();
        const elapsed = now - this.then;
    
        this.stats.begin();
    
        if (elapsed > this.fpsInterval) {
            this.then = now - (elapsed % this.fpsInterval);
    
            // Mettre à jour les uniforms pour le multitouch
            this.fboMaterial.uniforms.uTouchCount.value = this.currentTouches.length;
            // console.log(this.currentTouches.length);
            for (let i = 0; i < this.currentTouches.length; i++) {
                this.fboMaterial.uniforms.uMouse.value[i].copy(this.currentTouches[i]);
                // console.log('touch #:', i, this.currentTouches[i]);
            }
    
            this.fboMaterial.uniforms.uPosition.value = this.fbo1.texture;
            this.material.uniforms.uPosition.value = this.fbo.texture;
    
            this.findNearestPoint();
            
            // Mettre à jour l'uniform avec l'index du point le plus proche
            this.material.uniforms.uNearestPointIndex.value = this.nearestPointIndex;

            this.renderer.setRenderTarget(this.fbo);
            this.renderer.render(this.fboScene, this.fboCamera);
            this.renderer.setRenderTarget(null);
            this.renderer.render(this.scene, this.camera);
    
            let temp = this.fbo;
            this.fbo = this.fbo1;
            this.fbo1 = temp;
        }
    
        this.stats.end();
    
        this.animationFrameId = requestAnimationFrame(this.render.bind(this));
    }

    handleKeyDown(event) {
        switch(event.code) {
            case 'KeyW':
                this.keys.forward = true;
                break;
            case 'KeyS':
                this.keys.backward = true;
                break;
            case 'KeyA':
                this.keys.left = true;
                break;
            case 'KeyD':
                this.keys.right = true;
                break;
            case 'Space':
                this.keys.up = true;
                break;
            case 'ShiftLeft':
                this.keys.down = true;
                break;
            case 'ArrowLeft':
                this.keys.rotateLeft = true;
                break;
            case 'ArrowRight':
                this.keys.rotateRight = true;
                break;
            case 'ArrowUp':
                this.keys.rotateUp = true;
                break;
            case 'ArrowDown':
                this.keys.rotateDown = true;
                break;
        }
    }

    handleKeyUp(event) {
        switch(event.code) {
            case 'KeyW':
                this.keys.forward = false;
                break;
            case 'KeyS':
                this.keys.backward = false;
                break;
            case 'KeyA':
                this.keys.left = false;
                break;
            case 'KeyD':
                this.keys.right = false;
                break;
            case 'Space':
                this.keys.up = false;
                break;
            case 'ShiftLeft':
                this.keys.down = false;
                break;
            case 'ArrowLeft':
                this.keys.rotateLeft = false;
                break;
            case 'ArrowRight':
                this.keys.rotateRight = false;
                break;
            case 'ArrowUp':
                this.keys.rotateUp = false;
                break;
            case 'ArrowDown':
                this.keys.rotateDown = false;
                break;
        }
    }

    updateCamera() {
        // Direction de base
        const forward = new THREE.Vector3(0, 0, -1);
        const right = new THREE.Vector3(1, 0, 0);
        const up = new THREE.Vector3(0, 1, 0);

        // Appliquer la rotation de la caméra aux vecteurs de direction
        forward.applyQuaternion(this.camera.quaternion);
        right.applyQuaternion(this.camera.quaternion);

        // Réinitialiser la vélocité
        this.cameraVelocity.set(0, 0, 0);

        // Calculer le mouvement
        if (this.keys.forward) this.cameraVelocity.add(forward.multiplyScalar(this.settings.cameraSpeed));
        if (this.keys.backward) this.cameraVelocity.sub(forward.multiplyScalar(this.settings.cameraSpeed));
        if (this.keys.right) this.cameraVelocity.add(right.multiplyScalar(this.settings.cameraSpeed));
        if (this.keys.left) this.cameraVelocity.sub(right.multiplyScalar(this.settings.cameraSpeed));
        if (this.keys.up) this.cameraVelocity.y += this.settings.cameraSpeed;
        if (this.keys.down) this.cameraVelocity.y -= this.settings.cameraSpeed;

        // Appliquer le mouvement
        this.camera.position.add(this.cameraVelocity);

        // Ajouter la rotation par les flèches
        const rotationSpeed = this.settings.cameraSpeed * 0.2;
        if (this.keys.rotateLeft) this.euler.y += rotationSpeed;
        if (this.keys.rotateRight) this.euler.y -= rotationSpeed;
        if (this.keys.rotateUp) this.euler.x += rotationSpeed;
        if (this.keys.rotateDown) this.euler.x -= rotationSpeed;

        // Limiter la rotation verticale
        this.euler.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.euler.x));

        // Appliquer la rotation à la caméra
        this.camera.quaternion.setFromEuler(this.euler);
    }

    handleMouseMove(event) {
        if (!this.isPointerLocked) return;

        this.euler.y -= event.movementX * this.mouseSensitivity;
        this.euler.x -= event.movementY * this.mouseSensitivity;

        // Limiter la rotation verticale
        this.euler.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.euler.x));

        // Appliquer la rotation à la caméra
        this.camera.quaternion.setFromEuler(this.euler);
    }

    setupTransformFeedback() {
        const gl = this.renderer.getContext();
        
        // Créer le Transform Feedback
        this.transformFeedback = gl.createTransformFeedback();
        
        // Créer le buffer pour stocker les positions
        this.positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.size * 4 * 4, gl.STATIC_DRAW);
        
        // Shader pour le Transform Feedback
        const tfVS = `#version 300 es
            in vec4 position;
            out vec4 outPosition;
            
            void main() {
                outPosition = position;
            }
        `;
        
        // Créer et compiler le shader
        const program = gl.createProgram();
        // ... compilation du shader ...
        
        // Spécifier les variables de sortie
        gl.transformFeedbackVaryings(program, ['outPosition'], gl.SEPARATE_ATTRIBS);
        gl.linkProgram(program);
    }

    setupNearestPointCalculation() {
        // Créer une texture 1x1 pour stocker le résultat
        this.nearestPointRT = new THREE.WebGLRenderTarget(1, 1, {
            minFilter: THREE.NearestFilter,
            magFilter: THREE.NearestFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType
        });

        // Créer la scène et la caméra pour le calcul
        this.nearestPointScene = new THREE.Scene();
        this.nearestPointCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);

        // Créer le matériau avec le shader de calcul de distance
        this.nearestPointMaterial = new THREE.RawShaderMaterial({
            glslVersion: THREE.GLSL3,
            uniforms: {
                uPosition: { value: null },
                uCameraPos: { value: this.camera.position },
                textureSize: { value: this.textureWidth },
                modelViewMatrix: { value: new THREE.Matrix4() },
                projectionMatrix: { value: new THREE.Matrix4() }
            },
            vertexShader: `
                uniform mat4 modelViewMatrix;
                uniform mat4 projectionMatrix;
                
                in vec3 position;
                in vec2 uv;
                out vec2 vUv;
                
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: this.shaders.nearestPointFragment
        });

        // Créer le mesh pour le rendu
        const geometry = new THREE.PlaneGeometry(2, 2);
        this.nearestPointMesh = new THREE.Mesh(geometry, this.nearestPointMaterial);
        this.nearestPointScene.add(this.nearestPointMesh);
    }

    findNearestPoint() {
        // Mettre à jour la position de la caméra dans le shader
        this.nearestPointMaterial.uniforms.uCameraPos.value.copy(this.camera.position);
        this.nearestPointMaterial.uniforms.uPosition.value = this.fbo.texture;

        // Rendre dans la texture de calcul
        this.renderer.setRenderTarget(this.nearestPointRT);
        this.renderer.render(this.nearestPointScene, this.nearestPointCamera);

        // Lire le résultat (seulement un pixel)
        const buffer = new Float32Array(4);
        this.renderer.readRenderTargetPixels(this.nearestPointRT, 0, 0, 1, 1, buffer);

        // Mettre à jour l'index du point le plus proche
        this.nearestPointIndex = Math.floor(buffer[1]);
        
        // Afficher les informations si le point est valide
        if (this.nearestPointIndex >= 0 && 
            this.nearestPointIndex < this.posts.length) {
            
            const nearestPost = this.posts[this.nearestPointIndex];
            const character = this.characters.find(c => c.name === nearestPost.character);
            
            this.settings.postLog = `${nearestPost.uid}\n${nearestPost.character}\n${nearestPost.thematic}\n${character.numposts} posts`;
            this.settings.postCharColor = character.color;

            // Mettre à jour directement l'élément de couleur si il existe
            if (this.colorElement) {
                this.colorElement.style.backgroundColor = character.color;
            }
        }
        
        // Remettre le render target par défaut
        this.renderer.setRenderTarget(null);
    }
}

async function init() {
    // Charger les données et les shaders en parallèle
    const [postsData, fragment, vertexTemplate, simFragment, simVertex, nearestPointFragment] = await Promise.all([
        fetch('./assets/data/posts.json').then(r => r.json()),
        loadShader('./js/shader/fragment.glsl'),
        loadShader('./js/shader/vertexParticles.glsl'),
        loadShader('./js/shader/simFragment.glsl'),
        loadShader('./js/shader/simVertex.glsl'),
        loadShader('./js/shader/nearestPointFragment.glsl')
    ]);

    // Calculer le nombre de caractères distincts
    const uniqueCharacters = [...new Set(postsData.map(post => post.character))];
    const distinctCharacters = uniqueCharacters.length;

    // Remplacer PLACEHOLDER_NUM_CHARACTERS par la valeur réelle avant de créer le Sketch
    const vertexShader = vertexTemplate.replace(
        'PLACEHOLDER_NUM_CHARACTERS',
        `${distinctCharacters}`
    );

    // console.log('Shader après remplacement:', vertexShader);

    const sketch = new Sketch({
        dom: document.getElementById("container"),
        shaders: {
            fragment,
            vertexParticles: vertexShader,
            simFragment,
            simVertex,
            nearestPointFragment
        },
        postsData
    });
}

init().catch(console.error);
