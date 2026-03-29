// 3D Engine - Ghosty Ultra-Realistic Starfield
// Uses custom GLSL Shaders for per-star twinkling, color temperature, and realistic glow

(function() {
    let scene, camera, renderer, starSystem;
    const starCount = 3000;

    function init() {
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 1; // Closer for depth

        let container = document.getElementById('webgl-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'webgl-container';
            document.body.prepend(container);
        }

        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.zIndex = '-1';
        container.style.pointerEvents = 'none';
        container.style.background = '#050507'; // Deep space black

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(renderer.domElement);

        // --- Star Data ---
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);
        const phases = new Float32Array(starCount); // For individual twinkling

        const starColors = [
            new THREE.Color(0xffffff), // White
            new THREE.Color(0xdbe9ff), // Blue-white
            new THREE.Color(0xfff4e8), // Yellow-white
            new THREE.Color(0xffd9d9)  // Subtle red-white
        ];

        for (let i = 0; i < starCount; i++) {
            // Position in a sphere for better wrap
            const r = 15 + Math.random() * 40;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            // Realistic star color variation
            const color = starColors[Math.floor(Math.random() * starColors.length)];
            colors[i * 3] = color.r;
            colors[i * 3 + 1] = color.g;
            colors[i * 3 + 2] = color.b;

            // Varied sizes (most are small, few are bright)
            sizes[i] = Math.pow(Math.random(), 3) * 2.5 + 0.5;
            phases[i] = Math.random() * Math.PI * 2;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

        // --- Custom Shader for Twinkling ---
        const shaderMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                pointTexture: { value: createStarTexture() }
            },
            vertexShader: `
                attribute float size;
                attribute vec3 color;
                attribute float phase;
                varying vec3 vColor;
                varying float vOpacity;
                uniform float time;
                void main() {
                    vColor = color;
                    // Twinkle logic: sin wave based on time and individual phase
                    float twinkle = 0.6 + 0.4 * sin(time * 2.0 + phase);
                    vOpacity = twinkle;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform sampler2D pointTexture;
                varying vec3 vColor;
                varying float vOpacity;
                void main() {
                    gl_FragColor = vec4(vColor, vOpacity) * texture2D(pointTexture, gl_PointCoord);
                }
            `,
            blending: THREE.AdditiveBlending,
            depthTest: false,
            transparent: true
        });

        starSystem = new THREE.Points(geometry, shaderMaterial);
        scene.add(starSystem);

        window.addEventListener('resize', onWindowResize, false);
        animate();
    }

    function createStarTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.05, 'rgba(255, 255, 255, 0.9)');
        gradient.addColorStop(0.15, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.05)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(canvas);
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function animate() {
        requestAnimationFrame(animate);
        const time = Date.now() * 0.001;
        
        if (starSystem) {
            starSystem.material.uniforms.time.value = time;
            // Very slow drift
            starSystem.rotation.y += 0.00015;
            starSystem.rotation.x += 0.00005;
        }

        renderer.render(scene, camera);
    }

    if (typeof THREE !== 'undefined') {
        init();
    } else {
        const checkThree = setInterval(() => {
            if (typeof THREE !== 'undefined') {
                clearInterval(checkThree);
                init();
            }
        }, 100);
    }
})();
