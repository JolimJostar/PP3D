import * as THREE from "three";
import { OrbitControls } from "OrbitControls";
import { GLTFLoader } from "GLTFLoader";


function main() {
  let root;
  const canvas = document.querySelector("#c");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio(window.devicePixelRatio);

  const fov = 50;

  const camera = new THREE.PerspectiveCamera(
    fov,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(0, 10, 20);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 5, 0);
  controls.maxPolarAngle = Math.PI / 2;
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.dampingFactor = 0.1;
  controls.update();

  const scene = new THREE.Scene();
  const BACKGROUND_COLOR = 0xf1f1f1; //TODO
  scene.background = new THREE.Color(BACKGROUND_COLOR);

  {
    const floorGeo = new THREE.PlaneGeometry(5000, 5000, 1, 1);
    const floorMat = new THREE.MeshPhongMaterial({
      color: 0xeeeeee,
      shininess: 0,
    });
    const mesh = new THREE.Mesh(floorGeo, floorMat);
    mesh.position.y = -0.5;
    mesh.rotation.x = Math.PI * -0.5;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  {
    const skyColor = 0xb1e1ff;
    const groundColor = 0xb97a20; 
    const intensity = 0.6;
    const light = new THREE.HemisphereLight(skyColor, groundColor, intensity);
    scene.add(light);
  }

  {
    const color = 0xffffff;
    const intensity = 0.8;
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(5, 10, 2);
    scene.add(light);
    scene.add(light.target);
  }

  function frameArea(sizeToFitOnScreen, boxSize, boxCenter, camera) {
    const halfSizeToFitOnScreen = sizeToFitOnScreen * 0.5;
    const halfFovY = THREE.MathUtils.degToRad(camera.fov * 0.5);
    const distance = 10;
    // compute a unit vector that points in the direction the camera is now
    // in the xz plane from the center of the box
    const direction = new THREE.Vector3()
      .subVectors(camera.position, boxCenter)
      .multiply(new THREE.Vector3(1, 20, 1))
      .normalize();
    camera.position.copy(direction.multiplyScalar(distance).add(boxCenter));

    camera.near = boxSize / 100;
    camera.far = boxSize * 100;

    camera.updateProjectionMatrix();

    camera.lookAt(boxCenter.x, boxCenter.y, boxCenter.z);
  }

  const loadManager = new THREE.LoadingManager();
  const loader = new THREE.TextureLoader(loadManager);
  const Premium = new THREE.MeshStandardMaterial({
    map: loader.load("resources/PremiumCover.jpg"),
  });
  const Default = new THREE.MeshStandardMaterial({
    map: loader.load("resources/DefaultCover.jpg"),
  });

  const INITIAL_MAP = [{ childID: "BookCover", mtl: Default, name:'default' }];


  function initMaterial(parent, type, mtl, name) {
    parent.traverse((o) => {
      if (o.isMesh) {
        if (o.name.includes(type)) {
          o.material = mtl;
          o.nameID = type;
          o.name = name;
        }
      }
    });
  }
  {
    const gltfLoader = new GLTFLoader();
    gltfLoader.load("book.gltf", (gltf) => {
      root = gltf.scene;
      root.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
      });

      for (let object of INITIAL_MAP) {
        initMaterial(root, object.childID, object.mtl,object.name );
      }
      scene.add(root);
      scene.minFilter = THREE.LinearMipmapLinearFilter;
      // compute the box that contains all the stuff
      // from root and below
      const box = new THREE.Box3().setFromObject(root);

      const boxSize = box.getSize(new THREE.Vector3()).length();
      const boxCenter = box.getCenter(new THREE.Vector3());

      // set the camera to frame the box
      frameArea(boxSize * 0.5, boxSize, boxCenter, camera);

      // update the Trackball controls to handle the new size
      controls.maxDistance = boxSize * 10;
      controls.target.copy(boxCenter);
      controls.update();
    });
  }

  function setMaterial(parent, type, mtl) {
    parent.traverse((o) => {
      if (o.isMesh && o.nameID != null) {
        if (o.nameID == type) {
          o.material = mtl;
        }
      }
    });
  }
  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
  }

  function render() {
    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);

  let dropdown = document.querySelector(".dropdown");
  dropdown.addEventListener("click", (e) => {
    if (dropdown.classList.contains("closed")) {
      dropdown.classList.remove("closed");
    } else {
      dropdown.classList.add("closed");
    }
  });

  const skins = [
    {
      skin: Default,
      text: "default",
    },
    {
      skin: Premium,
      text: "premium",
    },
  ];
  const TRAY = document.getElementById("js-tray-slide");

  function buildColors(skins) {
    for (let [i, skin] of skins.entries()) {
      let swatch = document.createElement("li");
      swatch.classList.add("tray__swatch");

      swatch.innerText = skin.text;

      swatch.setAttribute("data-key", i);
      TRAY.append(swatch);
    }
  }

  buildColors(skins);

  const swatches = document.querySelectorAll(".tray__swatch");

  for (const swatch of swatches) {
    swatch.addEventListener("click", selectSwatch);
  }

  function selectSwatch(e) {
    let skin = skins[e.target.dataset.key];
    let new_mtl;
    new_mtl = skin.skin;
    let name = skin.text
    setMaterial(root, "BookCover", new_mtl, name);
  }

  function setMaterial(parent, type, mtl, name) {
    parent.traverse((o) => {
      if (o.isMesh && o.nameID != null) {
        if (o.nameID == type) {
          o.material = mtl;
          o.name = name;
        }
      }
    });
  }

  let orderButton = document.getElementById('orderButton')
  orderButton.addEventListener("click", (e) => {
    return console.log(root.children[0].name)
  });
}

main();
