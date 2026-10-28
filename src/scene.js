import * as T from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/GLTFLoader.js";
import { CELL, random } from "./maze.js";
import { WORLD } from "./level.js";
import { createScenery } from "./scenery.js";
import { surfaceTexture } from "./materials.js";
import { cameraPose } from "./cameras.js";
import { createWallSigns } from "./signs.js";
import { createRadiationOverlay } from "./radiation.js";
import { loadEntity } from "./entity-renderer.js";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function box(w, h, d, material, x, y, z) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}
export class BackroomsScene {
  constructor(
    container,
    world,
    onError = () => {},
    { reference = false } = {},
  ) {
    this.maze = world;
    this.reference = reference;
    this.view = reference ? "reference" : "chase";
    this.orbit = 0;
    this.renderer = new T.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.outputColorSpace = T.SRGBColorSpace;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Quantum Backrooms Floor 1",
    );
    container.append(this.renderer.domElement);
    this.radiation = createRadiationOverlay(container);
    this.renderer.domElement.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      onError("Graphics interrupted. Reload to restore the world.");
    });
    this.scene = new T.Scene();
    this.scene.background = new T.Color(0x1a1a1a);
    this.scene.fog = new T.FogExp2(1710096, WORLD.fogDensity);
    this.camera = new T.PerspectiveCamera(
      WORLD.cameraFov,
      1,
      reference ? 0.05 : 0.005,
      150,
    );
    this.scene.add(new T.AmbientLight(0xf0ecb8, 0.72));
    this.scene.add(new T.HemisphereLight(0xf0ecb8, 4868144, 0.5));
    const sun = new T.DirectionalLight(0xfff8d0, 0.44);
    sun.position.set(5, 10, 5);
    this.scene.add(sun);
    const size = 12 * CELL;
    const floor = new T.Mesh(
      new T.PlaneGeometry(size, size),
      new T.MeshStandardMaterial({
        map: surfaceTexture("carpet"),
        roughness: 0.9,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(3 * CELL, 0, 3 * CELL);
    this.scene.add(floor);
    const ceiling = new T.Mesh(
      new T.PlaneGeometry(size, size),
      new T.MeshLambertMaterial({ map: surfaceTexture("ceiling") }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(3 * CELL, WORLD.wallHeight, 3 * CELL);
    this.scene.add(ceiling);
    const wallpaper = surfaceTexture("wall");
    this.wallMeshes = world.edges.map((e) => {
      const material = new T.MeshStandardMaterial({
        map: wallpaper,
        color: 0xfceca0,
        roughness: 0.75,
        transparent: true,
      });
      const m = box(
        e.vertical ? WORLD.wallThickness : CELL,
        WORLD.wallHeight,
        e.vertical ? CELL : WORLD.wallThickness,
        material,
        e.x,
        WORLD.wallHeight / 2,
        e.z,
      );
      this.scene.add(m);
      m.userData.opacity = e.state === "wall" ? 1 : 0.45;
      return m;
    });
    this.signs = createWallSigns(this.scene, world.edges);
    const rng = random(71);
    this.lights = [];
    this.fixtures = [];
    for (let row = 0; row < 6; row += 3)
      for (let col = 0; col < 6; col += 3) {
        const broken = rng() < 0.15,
          x = (col + 0.5) * CELL,
          z = (row + 0.5) * CELL;
        const light = new T.SpotLight(
          0xfffae0,
          (broken ? 0.275 : 5.5) * Math.pow(0.1, 1.5),
          48,
          Math.PI / 4,
          0.5,
          1.5,
        );
        light.position.set(x, 1.6, z);
        light.target.position.set(x, 0, z);
        this.scene.add(light, light.target);
        this.lights.push({ light, base: light.intensity });
        const material = new T.MeshBasicMaterial({
          color: broken ? 0x34332d : 0xfffff0,
        });
        this.scene.add(
          box(0.6 * CELL, 0.08, 0.15 * CELL, material, x, 1.67, z),
        );
      }
    for (let r = 1; r < 6; r += 2)
      for (let c = 1; c < 6; c += 2)
        if (rng() < 0.7) {
          const m = new T.Mesh(
            new T.PlaneGeometry(0.25 * CELL, 0.05 * CELL),
            new T.MeshBasicMaterial({ color: 0xfffff0, side: T.DoubleSide }),
          );
          m.rotation.x = Math.PI / 2;
          m.position.set((c + 0.5) * CELL, 1.67, (r + 0.5) * CELL);
          this.scene.add(m);
          this.fixtures.push({
            m,
            flickering: rng() < 0.35,
            phase: rng() * Math.PI * 2,
          });
        }
    this.scenery = createScenery(this.scene, world);
    this.flyRoot = new T.Group();
    this.scene.add(this.flyRoot);
    this.flyPivot = new T.Group();
    this.flyRoot.add(this.flyPivot);
    this.wings = [];
    this.position = new T.Vector3(world.spawn.x, world.spawn.y, world.spawn.z);
    this.heading = world.spawn.heading;
    this.setupPostprocess();
    this.resizeObserver = new ResizeObserver(() => this.resize(container));
    this.resizeObserver.observe(container);
    this.resize(container);
    this.ready = Promise.resolve();
  }
  setupPostprocess() {
    this.target = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType });
    this.postScene = new T.Scene();
    this.postCamera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postMaterial = new T.ShaderMaterial({
      uniforms: {
        frame: { value: this.target.texture },
        time: { value: 0 },
        texel: { value: new T.Vector2(1, 1) },
      },
      vertexShader:
        "varying vec2 uvScreen;void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}",
      fragmentShader: `uniform sampler2D frame;uniform float time;uniform vec2 texel;varying vec2 uvScreen;
      void main(){vec2 uv=uvScreen;vec3 color=texture2D(frame,uv).rgb;
        // Compact luminous bloom around the fluorescent panels.
        vec3 bloom=vec3(0.);for(int x=-2;x<=2;x++)for(int y=-2;y<=2;y++){
          vec3 s=texture2D(frame,uv+vec2(float(x),float(y))*texel*3.).rgb;
          bloom+=s*smoothstep(.7,1.,dot(s,vec3(.2126,.7152,.0722)))/25.;}
        color+=bloom*.5;
        float fogTime=time*.4;float noise=sin(uv.x*8.+fogTime*.5)*sin(uv.y*6.+fogTime*.3)*.5+
          sin(uv.x*12.-fogTime*.4)*sin(uv.y*10.+fogTime*.6)*.3+
          sin(uv.x*4.+fogTime*.2)*sin(uv.y*3.-fogTime*.15)*.2;
        float grain=fract(sin(dot(uv+fract(time),vec2(12.9898,78.233)))*43758.5453)-.5;
        color*=1.+grain*.12;
        color*=smoothstep(.8,.4*.799,length(uv-.5)*(.45+.4));
        color=ACESFilmicToneMapping(color);
        color.r+=noise*.005;color.g+=noise*.00375;
        color=mix(color,vec3(46./255.,45./255.,32./255.),(.42+noise*.03)*(1.-length(uv-.5)*.8));
        gl_FragColor=vec4(color,1.);
        #include <colorspace_fragment>
      }`,
    });
    this.postScene.add(
      new T.Mesh(new T.PlaneGeometry(2, 2), this.postMaterial),
    );
  }
  async loadFly() {
    const gltf = await new GLTFLoader().loadAsync(
      new URL("../assets/fly/fly.glb", import.meta.url).href,
    );
    const model = gltf.scene,
      bodyBounds = new T.Box3();
    model.updateMatrixWorld(true);
    model.traverse((n) => {
      if (n.isMesh && /^(c_(thorax|head|abdomen\d+)|[lr]_eye)$/.test(n.name))
        bodyBounds.expandByObject(n);
    });
    if (bodyBounds.isEmpty())
      throw Error("Fly body bounds could not be measured.");
    const length = bodyBounds.max.x - bodyBounds.min.x;
    const head = model.getObjectByName("c_head");
    const headBounds = new T.Box3().setFromObject(head);
    const center = bodyBounds.getCenter(new T.Vector3());
    model.position.sub(center);
    const orient = new T.Group();
    orient.add(model);
    orient.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    orient.scale.setScalar(WORLD.bodyLength / length);
    model.traverse((n) => {
      if (n.isMesh) {
        n.geometry.computeVertexNormals();
        if (/wing/i.test(n.name)) {
          n.material = n.material.clone();
          n.material.transparent = true;
          n.material.opacity = 0.35;
          this.wings.push({
            node: n,
            base: n.quaternion.clone(),
            side: n.name[0] === "l" ? 1 : -1,
          });
        }
      }
    });
    this.flyPivot.add(orient);
    this.flyBounds = {
      sourceLength: length,
      bodyLength: WORLD.bodyLength,
      scale: WORLD.bodyLength / length,
      headOffset: headBounds
        .getCenter(new T.Vector3())
        .sub(center)
        .applyEuler(orient.rotation)
        .multiplyScalar(WORLD.bodyLength / length),
    };
    const shadow = new T.Mesh(
      new T.CircleGeometry(WORLD.bodyLength / 2, 24),
      new T.MeshBasicMaterial({
        color: 0x15130b,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    this.scene.add(shadow);
    this.shadow = shadow;
    this.renderKey = null;
  }
  async loadEntity() {
    this.entityRenderer = await loadEntity(this.scene);
    this.renderKey = null;
  }
  resize(container) {
    this.renderKey = null;
    const { width, height } = container.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height);
    const ratio = this.renderer.getPixelRatio();
    this.target.setSize(width * ratio, height * ratio);
    this.postMaterial.uniforms.texel.value.set(
      1 / (width * ratio),
      1 / (height * ratio),
    );
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  resetWorld(world) {
    this.renderKey = null;
    this.maze = world;
    this.lastTime = 0;
    this.signs.reset();
    this.scenery.reset(world);
    this.radiation.reset();
    this.wallMeshes.forEach((m, i) => {
      m.userData.opacity = world.edges[i].state === "wall" ? 1 : 0.45;
    });
  }
  setView(view) {
    this.view = view;
    this.orbit = 0;
  }
  updateWalls(body, dt, time) {
    this.wallMeshes.forEach((m, i) => {
      const e = this.maze.edges[i],
        distance =
          Math.hypot(
            (e.col + 0.5) * CELL - body.x,
            (e.row + 0.5) * CELL - body.z,
          ) / CELL;
      let opacity =
        e.state === "wall"
          ? 1
          : e.state === "open"
            ? 0
            : 0.45 + 0.05 * Math.sin(time * 0.3 + 0.3 * e.row + 0.5 * e.col);
      if (e.state === "superposition" && distance > 1)
        opacity = Math.max(
          0.08,
          opacity *
            (1 - clamp((distance - 1) / 7, 0, 1) * (1 - 0.08 / opacity)),
        );
      let previous = m.userData.opacity;
      const fade =
        e.state === "superposition" && distance <= 4
          ? 1
          : Math.min(1, (e.state === "open" ? 8 : 2) * dt);
      previous += (opacity - previous) * fade;
      m.userData.opacity = previous;
      const t = clamp((distance - 1) / 2, 0, 1),
        mat = m.material;
      mat.color.set(0xfceca0).lerp(this.scene.background, 0.6 * t);
      mat.roughness = distance > 1 ? 0.4 + 0.6 * t : 0.75;
      mat.opacity = previous * (1 - 0.4 * t);
      mat.emissive.set(0xffffff);
      mat.emissiveIntensity = e.state === "superposition" ? 0.025 : 0;
      m.visible = mat.opacity > 0.002;
    });
  }
  render(body, dt, time) {
    // A pending neural block or pause leaves the rendered world unchanged.
    // Avoid spending GPU/main-thread time redrawing that identical frame.
    const key = [
      time,
      body.x,
      body.y,
      body.z,
      body.heading,
      body.turn,
      this.view,
      this.orbit,
    ].join(":");
    if (key === this.renderKey) return;
    this.renderKey = key;
    this.updateWalls(body, dt, time);
    this.signs.update(this.maze, time, this.wallMeshes);
    this.scenery.update(time, body);
    this.entityRenderer?.update(this.maze.entity);
    this.radiation.update(this.maze, body, time);
    this.lights.forEach(({ light, base }, i) => {
      light.intensity =
        base *
        (1 +
          0.7 *
            (0.08 * Math.sin(2.3 * time + 0.7 * i) +
              0.04 * Math.sin(5.7 * time + 1.3 * i) +
              0.12 * Math.sin(0.4 * time + 2.1 * i) +
              (Math.sin(17.3 * time + 3.7 * i) > 0.97 ? -0.3 : 0)));
    });
    for (const { m, flickering, phase } of this.fixtures)
      m.material.color.setScalar(
        flickering ? 0.85 + 0.15 * Math.sin(time * 3 + phase) : 1,
      );
    // Rendering reads the observer, never writes it. Pause also freezes fades.
    this.position.set(body.x, body.y, body.z);
    this.heading = body.heading;
    this.flyRoot.position.copy(this.position);
    this.flyRoot.rotation.y = body.heading;
    this.flyPivot.rotation.z = -(body.turn || 0) * 0.1;
    this.flyRoot.visible = !this.reference && this.view !== "first";
    for (const { node, base, side } of this.wings) {
      node.quaternion.copy(base);
      node.rotateX(Math.sin(time * 85) * 0.35 * side);
    }
    if (this.shadow) this.shadow.position.set(body.x, 0.005, body.z);
    const { position, target } = cameraPose(body, this.maze, {
      view: this.view,
      orbit: this.orbit,
      headOffset: this.flyBounds?.headOffset,
    });
    this.camera.position.set(position.x, position.y, position.z);
    this.camera.lookAt(target.x, target.y, target.z);
    this.postMaterial.uniforms.time.value = time;
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
}
