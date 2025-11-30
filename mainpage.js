let driftingImg, restingImg, publicationImg;
let avenirFont;
let imgSize;
let positions = {};

function preload() {
  // Load images
  driftingImg = loadImage('icon/drifting.jpg');
  restingImg = loadImage('icon/resting.jpg');
  publicationImg = loadImage('icon/publication.jpg');
  
  // Load font
  avenirFont = loadFont('Avenir Light.ttf');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont(avenirFont);
  calculatePositions();
}

function draw() {
  background(255); // White background
  
  // Calculate image size based on window height
  imgSize = windowHeight / 5;
  
  // Draw title at top
  textAlign(CENTER, TOP);
  textSize(imgSize / 8 + 8);
  fill(0);
  text('FLOATSPACE', windowWidth / 2, 30);
  
  // Check hover states
  let hoverLeft = dist(mouseX, mouseY, positions.leftX, positions.centerY) < imgSize / 2;
  let hoverCenter = dist(mouseX, mouseY, positions.centerX, positions.centerY) < imgSize / 2;
  let hoverRight = dist(mouseX, mouseY, positions.rightX, positions.centerY) < imgSize / 2;
  
  // Draw Resting Mode (left)
  imageMode(CENTER);
  let leftSize = hoverLeft ? imgSize * 1.1 : imgSize;
  tint(255, hoverLeft ? 230 : 255);
  image(restingImg, positions.leftX, positions.centerY, leftSize, leftSize);
  noTint();
  
  textAlign(CENTER, TOP);
  textSize(imgSize / 8);
  fill(0);
  text('Resting Mode', positions.leftX, positions.centerY + imgSize/2 + 20);
  
  // Draw tooltip for Resting Mode
  if (hoverLeft) {
    drawTooltip(positions.leftX, positions.centerY + imgSize/2 + 50, imgSize,
                'Click to release a soft block of color. Take a screenshot and let it drift into your own use.');
  }
  
  // Draw Drifting Mode (center)
  let centerSize = hoverCenter ? imgSize * 1.1 : imgSize;
  tint(255, hoverCenter ? 230 : 255);
  image(driftingImg, positions.centerX, positions.centerY, centerSize, centerSize);
  noTint();
  
  textAlign(CENTER, TOP);
  textSize(imgSize / 8);
  fill(0);
  text('Drifting Mode', positions.centerX, positions.centerY + imgSize/2 + 20);
  
  // Draw tooltip for Drifting Mode
  if (hoverCenter) {
    drawTooltip(positions.centerX, positions.centerY + imgSize/2 + 50, imgSize,
                'Drag slowly to grow a cloud. Move your body and let it respond. (Uses camera input.)');
  }
  
  // Draw Publication (right)
  let rightSize = hoverRight ? imgSize * 1.1 : imgSize;
  tint(255, hoverRight ? 230 : 255);
  image(publicationImg, positions.rightX, positions.centerY, rightSize, rightSize);
  noTint();
  
  textAlign(CENTER, TOP);
  textSize(imgSize / 8);
  fill(0);
  text('Publication', positions.rightX, positions.centerY + imgSize/2 + 20);
  
  // Draw tooltip for Publication
  if (hoverRight) {
    drawTooltip(positions.rightX, positions.centerY + imgSize/2 + 50, imgSize * 1.05,
                'Read the concepts behind the system.\nA book on floating, freedom, and lightness.');
  }
  
  // Draw subtitle at bottom
  textAlign(CENTER, BOTTOM);
  textSize(imgSize / 8 - 5);
  text('A space where color drifts, light softens, and your movements shape the air.', 
       windowWidth / 2, windowHeight - 40);
  text('A floating system by Mingfu Yang', 
       windowWidth / 2, windowHeight - 20);
}

function calculatePositions() {
  imgSize = windowHeight / 5;
  
  // Center position
  positions.centerX = windowWidth / 2;
  positions.centerY = windowHeight / 2 - imgSize / 2;
  
  // Left position (halfway between left edge and center)
  positions.leftX = windowWidth / 4;
  
  // Right position (symmetric to left)
  positions.rightX = windowWidth * 3 / 4;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calculatePositions();
}

function drawTooltip(x, y, width, message) {
  // Calculate tooltip dimensions
  let padding = 10;
  let fontSize = imgSize / 12;
  textSize(fontSize);
  
  // Wrap text to fit within box width
  let maxWidth = width - padding * 2;
  let lines = [];
  
  // Split by manual line breaks first
  let paragraphs = message.split('\n');
  for (let paragraph of paragraphs) {
    let words = paragraph.split(' ');
    let currentLine = '';
    
    for (let word of words) {
      let testLine = currentLine + (currentLine ? ' ' : '') + word;
      if (textWidth(testLine) <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
  }
  
  let lineHeight = fontSize * 1.3;
  let boxHeight = lines.length * lineHeight + padding * 2;
  
  // Draw tooltip box
  rectMode(CENTER);
  stroke(220);
  strokeWeight(1);
  fill(255);
  rect(x, y + boxHeight/2 + 10, width, boxHeight, 5);
  
  // Draw tooltip text
  noStroke();
  fill(100);
  textAlign(LEFT, TOP);
  textSize(fontSize);
  let textY = y + 10 + padding;
  let textX = x - width/2 + padding;
  for (let i = 0; i < lines.length; i++) {
    text(lines[i], textX, textY + i * lineHeight);
  }
}

function mousePressed() {
  imgSize = windowHeight / 5;
  
  // Check if clicking on Resting image
  if (dist(mouseX, mouseY, positions.leftX, positions.centerY) < imgSize / 2) {
    window.location.href = 'Resting/index.html';
  }
  
  // Check if clicking on Drifting image
  if (dist(mouseX, mouseY, positions.centerX, positions.centerY) < imgSize / 2) {
    window.location.href = 'Drifting/index.html';
  }
  
  // Check if clicking on Publication image
  if (dist(mouseX, mouseY, positions.rightX, positions.centerY) < imgSize / 2) {
    window.open('Publication/floatWithinTheWorld.pdf', '_blank');
  }
}
