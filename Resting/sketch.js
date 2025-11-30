// Grid-cross sketch
// Click to add a cross point. Each point creates a vertical and horizontal line
// that extend across the canvas. The line segments between intersections
// (where a vertical meets a horizontal) are drawn in the point's Color.
// Color is randomly chosen between red (255,0,0) and green (0,255,0).
// Around each line we draw outward fading strokes to produce a gradient
// (alpha decreases with distance). Background is white. Press 'c' to clear.

let points = []; // {x,y,color:[r,g,b]}
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

function setup() {
	// Use the full size of the containing page by default
		let cnv = createCanvas(windowWidth, windowHeight);
		cnv.parent();
	pixelDensity(1);
	background(255);
	// pick a random background image from preloaded imgs (if available)
	if (imgs.length > 0) {
		bgImg = random(imgs);
		computeBgTransform();
	}
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
	// 'cover' behavior: scale up so image fills canvas while preserving aspect
	imgScale = max(width / iw, height / ih);
	imgDisplayW = iw * imgScale;
	imgDisplayH = ih * imgScale;
	imgOffsetX = (width - imgDisplayW) / 2;
	imgOffsetY = (height - imgDisplayH) / 2;
}

function draw() {
	background(255);
	if (points.length === 0) return;

	// Prepare sorted unique X and Y lists (including canvas edges)
	let xs = Array.from(new Set(points.map(p => Math.round(p.x))));
	let ys = Array.from(new Set(points.map(p => Math.round(p.y))));
	xs.sort((a, b) => a - b);
	ys.sort((a, b) => a - b);

	// include edges so segments go to canvas boundaries
	let xsWithEdges = [0, ...xs.filter(x => x > 0 && x < width), width];
	let ysWithEdges = [0, ...ys.filter(y => y > 0 && y < height), height];

		// Draw gradient strokes (vertical and horizontal) first with decreasing alpha
	for (let p of points) {
		let c = p.color;
			// vertical gradients: offsets from the main x
			for (let d = SPREAD_STEP; d <= MAX_SPREAD; d += SPREAD_STEP) {
				// gradient alpha fades from the main line alpha (60%) down to 0
				let baseA = map(d, 0, MAX_SPREAD, 255 * 0.6, 0);
				strokeWeight(1);
				let xposR = p.x + d;
				let xposL = p.x - d;
				// for each vertical gradient line, draw it between horizontal segment boundaries
				for (let i = 0; i < ysWithEdges.length - 1; i++) {
					let y0 = ysWithEdges[i];
					let y1 = ysWithEdges[i + 1];
				// distance along the line from the point's center to the segment center
				let midY = (y0 + y1) / 2;
				let distAlong = abs(midY - p.y);
				// compute along-line factor with a slower initial falloff and a minimum floor
				let t = constrain(1 - distAlong / MAX_SPREAD, 0, 1);
				let alongFactor = MIN_ALPHA_FACTOR + (1 - MIN_ALPHA_FACTOR) * pow(t, ALONG_EXPONENT);
				let aR = baseA * alongFactor;
				let aL = baseA * alongFactor;
					if (xposR >= 0 && xposR <= width) {
						stroke(c[0], c[1], c[2], aR);
						line(xposR, y0, xposR, y1);
					}
					if (xposL >= 0 && xposL <= width) {
						stroke(c[0], c[1], c[2], aL);
						line(xposL, y0, xposL, y1);
					}
				}
			}

			// horizontal gradients: offsets from the main y
			for (let d = SPREAD_STEP; d <= MAX_SPREAD; d += SPREAD_STEP) {
				let baseA = map(d, 0, MAX_SPREAD, 255 * 0.6, 0);
				strokeWeight(1);
				let yposD = p.y + d;
				let yposU = p.y - d;
				for (let i = 0; i < xsWithEdges.length - 1; i++) {
					let x0 = xsWithEdges[i];
					let x1 = xsWithEdges[i + 1];
				let midX = (x0 + x1) / 2;
				let distAlong = abs(midX - p.x);
				let t = constrain(1 - distAlong / MAX_SPREAD, 0, 1);
				let alongFactor = MIN_ALPHA_FACTOR + (1 - MIN_ALPHA_FACTOR) * pow(t, ALONG_EXPONENT);
				let aD = baseA * alongFactor;
				let aU = baseA * alongFactor;
					if (yposD >= 0 && yposD <= height) {
						stroke(c[0], c[1], c[2], aD);
						line(x0, yposD, x1, yposD);
					}
					if (yposU >= 0 && yposU <= height) {
						stroke(c[0], c[1], c[2], aU);
						line(x0, yposU, x1, yposU);
					}
				}
			}
	}

	// Draw main colored line segments. For each point draw its vertical/horizontal
	// line broken into segments between consecutive other lines (intersections)
	for (let p of points) {
		let c = p.color;
		// main lines: 60% opacity as requested
		stroke(c[0], c[1], c[2], 255 * 0.6);
		strokeWeight(MAIN_WEIGHT);

			// vertical: segments between consecutive ys (intersections)
			for (let i = 0; i < ysWithEdges.length - 1; i++) {
				let y0 = ysWithEdges[i];
				let y1 = ysWithEdges[i + 1];
				// compute opacity based on distance from the point along the line
						let midY = (y0 + y1) / 2;
						let distAlong = abs(midY - p.y);
						let t = constrain(1 - distAlong / MAX_SPREAD, 0, 1);
						let segAlphaFactor = MIN_ALPHA_FACTOR + (1 - MIN_ALPHA_FACTOR) * pow(t, ALONG_EXPONENT);
						let alpha = (255 * 0.6) * segAlphaFactor;
						if (alpha > 0.5) {
							stroke(c[0], c[1], c[2], alpha);
							line(p.x, y0, p.x, y1);
						}
			}

			// horizontal: segments between consecutive xs (intersections)
			for (let i = 0; i < xsWithEdges.length - 1; i++) {
				let x0 = xsWithEdges[i];
				let x1 = xsWithEdges[i + 1];
						let midX = (x0 + x1) / 2;
						let distAlong = abs(midX - p.x);
						let t = constrain(1 - distAlong / MAX_SPREAD, 0, 1);
						let segAlphaFactor = MIN_ALPHA_FACTOR + (1 - MIN_ALPHA_FACTOR) * pow(t, ALONG_EXPONENT);
						let alpha = (255 * 0.6) * segAlphaFactor;
						if (alpha > 0.5) {
							stroke(c[0], c[1], c[2], alpha);
							line(x0, p.y, x1, p.y);
						}
			}
	}

	// draw small dot for each point
	for (let p of points) {
		fill(p.color[0], p.color[1], p.color[2]);
		noStroke();
		circle(p.x, p.y, 6);
	}
}

function mousePressed() {
	// ignore clicks outside canvas
	if (mouseX < 0 || mouseX > width || mouseY < 0 || mouseY > height) return;
	let c = [255, 0, 0]; // fallback if image not ready
	if (bgImg) {
		// map mouse coords to the image's pixel coordinates
		let imgX = (mouseX - imgOffsetX) / imgScale;
		let imgY = (mouseY - imgOffsetY) / imgScale;
		// clamp
		imgX = constrain(imgX, 0, bgImg.width - 1);
		imgY = constrain(imgY, 0, bgImg.height - 1);
		// get returns [r,g,b,a]
		let col = bgImg.get(floor(imgX), floor(imgY));
		if (col && col.length >= 3) {
			c = [col[0], col[1], col[2]];
		}
	}
	points.push({ x: mouseX, y: mouseY, color: c });
}

function keyPressed() {
	if (key === 'c' || key === 'C') {
		points = [];
	}
}

function windowResized() {
	// keep canvas synced to the window size
	resizeCanvas(windowWidth, windowHeight);
	// clear background after resizing
	background(255);
	// recompute image-to-canvas transform for color sampling
	computeBgTransform();
}

