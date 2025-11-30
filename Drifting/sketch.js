// Grid-cross sketch
// Click to add a cross point. Each point creates a vertical and horizontal line
// that extend across the canvas. The line segments between intersections
// (where a vertical meets a horizontal) are drawn in the point's Color.
// Color is randomly chosen between red (255,0,0) and green (0,255,0).
// Around each line we draw outward fading strokes to produce a gradient
// (alpha decreases with distance). Background is white. Press 'c' to clear.

let points = []; // {x,y,color:[r,g,b]}
// dragging / sampling state
let isDragging = false;
let prevSampleX = 0;
let prevSampleY = 0;
// sample spacing along drag (px). Smaller -> more samples and smoother path, but slower.
const SAMPLE_SPACING = 6;
// paint layer for spray strokes
let paintLayer = null;
// spray parameters
const SPRAY_RADIUS = 120; // large spread
const SPRAY_DENSITY = 100; // points per sample (higher -> denser paint)
const SPRAY_SIZE_MIN = 1;
const SPRAY_SIZE_MAX = 16;
// cloud drifting system (matte/soft spray)
let clouds = [];
const CLOUD_PARTICLES = 400; // how many white specks to draw into each cloud's alpha map
const CLOUD_BLUR = 12; // blur applied to pre-rendered cloud to make it soft
const CLOUD_DRIFT_SCALE_MIN = 0.08; // slow drift
const CLOUD_DRIFT_SCALE_MAX = 0.26;
const CLOUD_ALPHA = 255; // base tint alpha when drawing cloud
// how many pixels the gradient spreads. Increased to give a wider halo.
const MAX_SPREAD = 160; // was 100
// smaller step for smoother gradient lines
const SPREAD_STEP = 1; // unchanged
// control how quickly opacity falls off along the line from the center.
// exponent < 1 => slower initial drop (keeps center more saturated longer).
const ALONG_EXPONENT = 0.5;
// minimum fraction of alpha to keep (so color doesn't immediately drop to 0)
const MIN_ALPHA_FACTOR = 0.12;
// main line weight (user requested 0.001px). Very small values may render
// thinner than one device pixel; p5 will still accept the value.
const MAIN_WEIGHT = 0.001;

// background images
let imgs = [];
let bgImg = null;
let imgScale = 1;
let imgOffsetX = 0;
let imgOffsetY = 0;
let imgDisplayW = 0;
let imgDisplayH = 0;

// webcam and body pose detection
let video = null;
let bodyPose = null;
let poses = [];
const BODY_REPULSION_RADIUS = 80; // distance within which clouds are pushed away
const BODY_REPULSION_FORCE = 3.5; // strength of push-away force
let showSkeleton = false; // toggle for skeleton visualization
let toggleButton = null; // button to toggle skeleton view

function setup() {
	// Use the full size of the containing page by default
		let cnv = createCanvas(windowWidth, windowHeight);
		cnv.parent();
	pixelDensity(1);
	background(255);

	// create an offscreen graphics layer to accumulate spray paint strokes
	paintLayer = createGraphics(width, height);
	paintLayer.pixelDensity(1);
	paintLayer.clear();
	paintLayer.noStroke();
	// init cloud list
	clouds = [];

	// setup webcam capture (flipped for mirror effect)
	video = createCapture(VIDEO);
	video.size(width, height);
	video.hide(); // don't show the default video element

	// initialize ml5 bodyPose model
	if (typeof ml5 !== 'undefined') {
		bodyPose = ml5.bodyPose('MoveNet', modelReady);
		bodyPose.detectStart(video, gotPoses);
	} else {
		console.warn('ml5.js not loaded, body detection disabled');
	}

	// pick a random background image from preloaded imgs for color sampling
	if (imgs.length > 0) {
		bgImg = random(imgs);
		computeBgTransform();
	}

	// create toggle button for skeleton visualization
	createToggleButton();
}

function preload() {
	// preload images from assets/F00..F29.jpg (two-digit padded filenames)
	// e.g. F00.jpg, F01.jpg ... F29.jpg
	for (let i = 0; i <= 29; i++) {
		let pad = (i < 10) ? `0${i}` : `${i}`;
		imgs.push(loadImage(`assets/F${pad}.jpg`));
	}
}

function computeBgTransform() {
	if (!bgImg) return;
	const iw = bgImg.width;
	const ih = bgImg.height;
	if (iw === 0 || ih === 0) return; // video not ready yet
	// 'cover' behavior: scale up so image fills canvas while preserving aspect
	imgScale = max(width / iw, height / ih);
	imgDisplayW = iw * imgScale;
	imgDisplayH = ih * imgScale;
	imgOffsetX = (width - imgDisplayW) / 2;
	imgOffsetY = (height - imgDisplayH) / 2;
}

function draw() {
	// draw webcam as background (mirrored)
	if (video && video.loadedmetadata) {
		push();
		translate(width, 0);
		scale(-1, 1); // flip horizontally for mirror effect
		image(video, 0, 0, width, height);
		pop();
	} else {
		background(255);
	}

	// update and draw clouds
	for (let i = 0; i < clouds.length; i++) {
		let c = clouds[i];
		// compute slow perlin noise-based drift
		let t = frameCount * 0.002;
		let vx = (noise(c.noiseX + t) - 0.5) * 2 * c.driftScale * 1.2;
		let vy = (noise(c.noiseY + t + 437.1) - 0.5) * 2 * c.driftScale * 1.2;

		// apply body repulsion force (push clouds away from detected body keypoints)
		let repulsionVx = 0;
		let repulsionVy = 0;
		if (poses.length > 0) {
			for (let pose of poses) {
				if (pose.keypoints) {
					for (let kp of pose.keypoints) {
						if (kp.confidence > 0.3) {
							// keypoints are in video space; mirror x for display
							let kpX = width - kp.x;
							let kpY = kp.y;
							let dx = c.x - kpX;
							let dy = c.y - kpY;
							let dist = sqrt(dx * dx + dy * dy);
							if (dist < BODY_REPULSION_RADIUS && dist > 0.1) {
								// normalize and scale by inverse distance
								let force = BODY_REPULSION_FORCE * (1 - dist / BODY_REPULSION_RADIUS);
								repulsionVx += (dx / dist) * force;
								repulsionVy += (dy / dist) * force;
							}
						}
					}
				}
			}
		}

		c.x += vx + repulsionVx;
		c.y += vy + repulsionVy;

		// color slowly fluctuates using noise
		let nr = map(noise(c.noiseX + t * c.hueJitter), 0, 1, -12, 12);
		let ng = map(noise(c.noiseX + 100 + t * c.hueJitter), 0, 1, -12, 12);
		let nb = map(noise(c.noiseY + 200 + t * c.hueJitter), 0, 1, -12, 12);
		let r = constrain(c.baseColor[0] + nr, 0, 255);
		let g = constrain(c.baseColor[1] + ng, 0, 255);
		let b = constrain(c.baseColor[2] + nb, 0, 255);

		// draw cloud centered; use tint to colorize the grayscale alpha map
		push();
		tint(r, g, b, CLOUD_ALPHA);
		image(c.g, c.x - c.g.width / 2, c.y - c.g.height / 2);
		noTint();
		pop();
	}

	// draw skeleton visualization if enabled
	if (showSkeleton && poses.length > 0) {
		drawSkeleton();
	}
}

function mousePressed() {
	// start drag-based sampling. We still ignore presses outside canvas.
	if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
	isDragging = true;
	prevSampleX = mouseX;
	prevSampleY = mouseY;
	// add initial sample at press location
	addPointAt(mouseX, mouseY);
}

function mouseDragged() {
	// only sample while dragging began inside canvas
	if (!isDragging) return;
	// interpolate between prevSample and current mouse to avoid gaps on fast moves
	let dx = mouseX - prevSampleX;
	let dy = mouseY - prevSampleY;
	let dist = sqrt(dx * dx + dy * dy);
	if (dist <= 0) return;
	let steps = max(1, floor(dist / SAMPLE_SPACING));
	for (let i = 1; i <= steps; i++) {
		let t = i / steps;
		let sx = prevSampleX + dx * t;
		let sy = prevSampleY + dy * t;
		// ignore samples outside canvas
		if (sx < 0 || sx > width || sy < 0 || sy > height) continue;
		addPointAt(sx, sy);
	}
	prevSampleX = mouseX;
	prevSampleY = mouseY;
}

function mouseReleased() {
	isDragging = false;
}

// helper: sample color at canvas coords (x,y) from bgImg if available and push to points
function addPointAt(x, y) {
	let c = [255, 0, 0]; // fallback
	if (bgImg) {
		// sample from static background image (not video)
		let imgX = (x - imgOffsetX) / imgScale;
		let imgY = (y - imgOffsetY) / imgScale;
		imgX = constrain(imgX, 0, bgImg.width - 1);
		imgY = constrain(imgY, 0, bgImg.height - 1);
		let col = bgImg.get(floor(imgX), floor(imgY));
		if (col && col.length >= 3) c = [col[0], col[1], col[2]];
	}
	// create a drifting soft cloud centered at this sample
	createCloud(x, y, c);
	// keep a record of the sample point for potential future use
	points.push({ x: x, y: y, color: c });
}

// create a pre-rendered soft cloud (grayscale alpha map) and add to clouds list
function createCloud(x, y, colorArr) {
	// pre-render a grayscale alpha map for the cloud
	const size = SPRAY_RADIUS * 2;
	let g = createGraphics(size, size);
	g.pixelDensity(1);
	g.clear();
	g.noStroke();
	// draw many white specks; result will be colorized later with tint
	for (let i = 0; i < CLOUD_PARTICLES; i++) {
		let r = sqrt(random()) * SPRAY_RADIUS;
		let a = random(TWO_PI);
		let px = SPRAY_RADIUS + cos(a) * r + randomGaussian() * 1.2;
		let py = SPRAY_RADIUS + sin(a) * r + randomGaussian() * 1.2;
		let sz = map(r, 0, SPRAY_RADIUS, SPRAY_SIZE_MAX, SPRAY_SIZE_MIN) * random(0.7, 1.0);
		let alpha = map(r, 0, SPRAY_RADIUS, 220, 8) * random(0.7, 1.0);
		g.fill(255, alpha);
		g.ellipse(px, py, sz, sz);
	}
	// soften the result to create a matte cloud
	try {
		g.filter(BLUR, CLOUD_BLUR);
	} catch (e) {
		// if filter not available on this context, it's fine — we still have many overlaps
	}

	// cloud state
	let cloud = {
		x: x,
		y: y,
		g: g,
		baseColor: colorArr.slice(),
		noiseX: random(10000),
		noiseY: random(10000),
		driftScale: random(CLOUD_DRIFT_SCALE_MIN, CLOUD_DRIFT_SCALE_MAX),
		hueJitter: random(0.008, 0.01) // speed of color fluctuation
	};
	clouds.push(cloud);
	// Note: we do NOT forcibly drop oldest clouds here anymore.
	// Baking (in bakeOldClouds) will merge old clouds into the static paintLayer
	// when the active count exceeds MAX_ACTIVE_CLOUDS. This keeps visuals
	// persistent while still bounding active object count.
}

function keyPressed() {
	if (key === 'c' || key === 'C') {
		points = [];
		// clear clouds and baked layer as well
		clouds = [];
		if (paintLayer) {
			paintLayer.clear();
		}
	}
}

// ml5 bodyPose callbacks
function modelReady() {
	console.log('BodyPose model loaded and ready');
}

function gotPoses(results) {
	poses = results;
}

// create toggle button for skeleton visualization
function createToggleButton() {
	// create a div for the button in bottom-left corner
	toggleButton = createDiv('🔍');
	toggleButton.position(20, height - 60);
	toggleButton.style('font-size', '32px');
	toggleButton.style('cursor', 'pointer');
	toggleButton.style('background', 'rgba(255, 255, 255, 0.7)');
	toggleButton.style('border-radius', '50%');
	toggleButton.style('width', '50px');
	toggleButton.style('height', '50px');
	toggleButton.style('display', 'flex');
	toggleButton.style('align-items', 'center');
	toggleButton.style('justify-content', 'center');
	toggleButton.style('user-select', 'none');
	toggleButton.style('transition', 'all 0.2s');
	toggleButton.mousePressed(toggleSkeletonView);
	// hover effect
	toggleButton.mouseOver(() => {
		toggleButton.style('background', 'rgba(255, 255, 255, 0.9)');
		toggleButton.style('transform', 'scale(1.1)');
	});
	toggleButton.mouseOut(() => {
		toggleButton.style('background', 'rgba(255, 255, 255, 0.7)');
		toggleButton.style('transform', 'scale(1)');
	});
}

// toggle skeleton visualization
function toggleSkeletonView() {
	showSkeleton = !showSkeleton;
	if (showSkeleton) {
		toggleButton.style('background', 'rgba(100, 200, 255, 0.8)');
	} else {
		toggleButton.style('background', 'rgba(255, 255, 255, 0.7)');
	}
}

// draw skeleton keypoints and connections
function drawSkeleton() {
	for (let pose of poses) {
		if (!pose.keypoints) continue;
		
		// draw connections (bones)
		stroke(0, 255, 0, 180);
		strokeWeight(2);
		if (pose.skeleton) {
			for (let connection of pose.skeleton) {
				let a = connection[0];
				let b = connection[1];
				if (a.confidence > 0.3 && b.confidence > 0.3) {
					let x1 = width - a.x; // mirror x
					let y1 = a.y;
					let x2 = width - b.x; // mirror x
					let y2 = b.y;
					line(x1, y1, x2, y2);
				}
			}
		}
		
		// draw keypoints (joints)
		for (let kp of pose.keypoints) {
			if (kp.confidence > 0.3) {
				let x = width - kp.x; // mirror x
				let y = kp.y;
				// draw outer circle
				fill(255, 0, 0, 150);
				noStroke();
				circle(x, y, 12);
				// draw inner circle
				fill(255, 255, 0, 200);
				circle(x, y, 6);
			}
		}
	}
}

function windowResized() {
	// keep canvas synced to the window size
	resizeCanvas(windowWidth, windowHeight);
	// clear background after resizing
	background(255);
	// resize video to match new canvas size
	if (video) {
		video.size(width, height);
	}
	// recompute image-to-canvas transform for color sampling
	computeBgTransform();
	// recreate paint layer at new size
	if (paintLayer) {
		paintLayer.remove();
	}
	paintLayer = createGraphics(width, height);
	paintLayer.pixelDensity(1);
	paintLayer.clear();

	// reposition toggle button
	if (toggleButton) {
		toggleButton.position(20, height - 60);
	}

	// optional: keep cloud graphics as-is; they are relative to SPRAY_RADIUS
}

