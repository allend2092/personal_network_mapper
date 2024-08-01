document.addEventListener("DOMContentLoaded", () => {
    // Create a Three.js scene, camera, and renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('traceroute-container').appendChild(renderer.domElement);

    // Create CSS2DRenderer for labels
    const labelRenderer = new THREE.CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    document.getElementById('traceroute-container').appendChild(labelRenderer.domElement);

    // Handle window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Create a bigger sphere with preferred color
    const geometry = new THREE.SphereGeometry(10, 32, 32);
    const material = new THREE.MeshPhongMaterial({ color: 0x99cc66, shininess: 30 });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Add some ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Add a point light
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    // Position the camera
    camera.position.z = 30;

    // Debugging: Log scene and camera
    console.log("Scene:", scene);
    console.log("Camera:", camera);

    // Function to create text labels
    function createTextLabel(message, position, normal, offset) {
        const div = document.createElement('div');
        div.className = 'label';
        div.textContent = message;
        const label = new THREE.CSS2DObject(div);
        label.position.set(position.x + normal.x * offset, position.y + normal.y * offset, position.z + normal.z * offset);
        return label;
    }

    // Function to parse traceroute file
    function parseTracerouteFile(content) {
        const lines = content.split('\n');
        const tracerouteData = [];
        let hopNumber = 1;

        lines.forEach(line => {
            const match = line.match(/^\s*(\d+)\s+(\d+ ms|\*)\s+(\d+ ms|\*)\s+(\d+ ms|\*)\s+([\d\.]+|\*)/);
            if (match) {
                const ip = match[5] === '*' ? null : match[5];
                tracerouteData.push({ hop: hopNumber++, ip: ip, rtt: parseInt(match[2], 10) });
            }
        });

        return tracerouteData;
    }

    // Function to map traceroute hops onto the sphere
    function plotHops(hops) {
    const radius = 10;
    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0x888888]; // Red, Green, Blue, Gray for null hops
    const labelOffset = -7; // Adjust this to change the distance of the label from the node

    hops.forEach((hop, index) => {
        const phi = Math.PI * index / (hops.length - 1); // Linearly interpolate phi from 0 to pi
        const theta = Math.PI * 2 * (index / hops.length); // Spiral pattern

        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);

        const hopGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const hopMaterial = new THREE.MeshPhongMaterial({ color: hop.ip ? colors[index % colors.length] : colors[3], shininess: 30 });
        const hopSphere = new THREE.Mesh(hopGeometry, hopMaterial);

        hopSphere.position.set(x, y, z);
        sphere.add(hopSphere);

        // Calculate the normal vector at this point
        const normal = new THREE.Vector3(x, y, z).normalize();

        // Create and add text label
        const label = createTextLabel(hop.ip ? `Hop ${hop.hop}: ${hop.ip}` : `Hop ${hop.hop}: *`, hopSphere.position, normal, labelOffset);
        hopSphere.add(label);
        hopSphere.userData.label = label; // Store reference to the label
    });
}

    // Event listener for file input
    document.getElementById('file-input').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const tracerouteData = parseTracerouteFile(content);
                plotHops(tracerouteData);
            };
            reader.readAsText(file);
        }
    });

    // Variables for mouse interaction
    let isDragging = false;
    let previousMousePosition = {
        x: 0,
        y: 0
    };

    // Function to handle mouse down
    function onMouseDown(event) {
        isDragging = true;
        previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };
    }

    // Function to handle mouse move
    function onMouseMove(event) {
        if (isDragging) {
            const deltaMove = {
                x: event.clientX - previousMousePosition.x,
                y: event.clientY - previousMousePosition.y
            };

            const deltaRotationQuaternion = new THREE.Quaternion()
                .setFromEuler(new THREE.Euler(
                    toRadians(deltaMove.y * 0.5),
                    toRadians(deltaMove.x * 0.5),
                    0,
                    'XYZ'
                ));

            sphere.quaternion.multiplyQuaternions(deltaRotationQuaternion, sphere.quaternion);

            previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
        }
    }

    // Function to handle mouse up
    function onMouseUp() {
        isDragging = false;
    }

    // Attach event listeners to both renderers
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    labelRenderer.domElement.addEventListener('mousedown', onMouseDown);
    labelRenderer.domElement.addEventListener('mousemove', onMouseMove);
    labelRenderer.domElement.addEventListener('mouseup', onMouseUp);

    function toRadians(angle) {
        return angle * (Math.PI / 180);
    }

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
        labelRenderer.render(scene, camera);

        // Update label visibility based on camera view
        sphere.children.forEach((object) => {
            if (object.isMesh && object.userData.label) {
                // Convert node position to camera coordinates
                const vector = new THREE.Vector3();
                object.getWorldPosition(vector);
                vector.project(camera);

                const isVisible = vector.z > 0;
                object.userData.label.element.style.display = isVisible ? 'block' : 'none';
            }
        });
    }

    animate();
});
