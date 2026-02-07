/* i will be adding perception images as assets to replace the circles with these iamges
i first started by making repleing the objects/drawings to users mouse location, which was on the sketch side without interfering with the user app.js part
and that resulted in a seperate interaction so there was network but without all users livestreaming eacvh others movement 
now i want to try and find out how i could make all users wintess the objects mvement simultaneously
which probabaly means I have to look at the server part to broadcast or emit ??  
*/

// perception objects
let perceptionsArray = [];
// -------------------- perception Assets --------------------
let imagePerception = [];
let imageFilePerception = [
  "perception001.gif",
  "perception002.gif",
  "perception003.gif",
  "perception004.gif",
  "perception005.gif",
  "perception006.gif",
  "perception007.gif",
  // "perception008.gif",
];

const socket = io();

let me;

// Mirror of experience state on client side
let experienceState = {
  users: {},
  partyradius: 0,
  party: false,
};

// throttle mouse updates
let lastSent = 0;
const SEND_RATE = 30; // ms (~33 fps)

// -------------------- Preload --------------------
function preload() {
  for (let i = 0; i < imageFilePerception.length; i++) {
    imagePerception[i] = loadImage("ImageAssets/" + imageFilePerception[i]);
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  textAlign(CENTER);

  dustColor = color(218, 165, 32);
  growthColor = color(50, 200, 32);
  waterColor = color(72, 61, 255);

  // create perception objects
  for (let i = 0; i < imagePerception.length; i++) {
    let perc = new perception(
      random(width),
      random(height),
      imagePerception[i],
      random(80, 300),
    );
    perceptionsArray.push(perc);
  }
}

function draw() {
  background(200);

  //chatGPt help with the math
  let touching = usersTouchingPerceptions(); //touching to be called  in the app.js

  if (touching) {
    // when any user is touching any perception object
    fill(random(255), random(255), random(255)); // or a fixed color if you prefer
    noStroke();
  } else {
    stroke(0);
    noFill();
  }

  circle(width / 2, height / 2, width * experienceState.partyradius);

  // draw all users
  for (let id in experienceState.users) {
    const u = experienceState.users[id];

    if (id === me) {
      fill(u.color, 0, 0);
      circle(mouseX, mouseY, 70);
    } else {
      fill(u.color, 0, 0);
      circle(u.x * width, u.y * height, 15);
    }
  }

  // perception objects calling
  for (let per of perceptionsArray) {
    per.repelFrom(mouseX, mouseY, 50, 2); // repel from my mouse
    per.separate(perceptionsArray); // steer away from neighbors
    per.update();
    per.borders();
    per.display();
  }
}

// SEND MOVEMENT (throttled, i.e. send less often)
//maybe this is where i need toreplace the circles with the drawings
function mouseMoved() {
  let now = millis();
  if (now - lastSent < SEND_RATE) {
    return;
  }

  lastSent = now;

  socket.emit("move", {
    x: mouseX / width,
    y: mouseY / height,
    inRadius: checkMyDistance(),
  });
}

function checkMyDistance() {
  let distanceFromCenter = dist(mouseX, mouseY, width / 2, height / 2);
  if (distanceFromCenter < (experienceState.partyradius * width) / 2) {
    return true;
  } else {
    return false;
  }
}

function usersTouchingPerceptions() {
  // how close counts as "touching" (in pixels)
  let touchRadius = 50;

  // loop over all perception objects
  for (let per of perceptionsArray) {
    let px = per.position.x;
    let py = per.position.y;

    // 1) check ME (local user, uses mouseX/mouseY)
    let dMe = dist(mouseX, mouseY, px, py);
    if (dMe < touchRadius) {
      return true; // someone is touching, we can stop
    }
    // 2) check OTHER users (positions from server)
    for (let id in experienceState.users) {
      if (id === me) continue; // already checked myself

      const u = experienceState.users[id];
      const ux = u.x * width; // normalized -> pixels
      const uy = u.y * height;

      let d = dist(ux, uy, px, py);
      if (d < touchRadius) {
        return true;
      }
    }
  }

  // if we got here, nobody is touching any perception
  return false;
}

// SOCKET EVENTS

// initial full state
socket.on("init", (data) => {
  me = data.id;
  experienceState = data.state;
  console.log(experienceState);
});

// someone joined
socket.on("userJoined", (data) => {
  experienceState.users[data.id] = data.user;
});

// someone left
socket.on("userLeft", (id) => {
  delete experienceState.users[id];
});

// someone moved
socket.on("userMoved", (data) => {
  let id = data.id;
  if (experienceState.users[id]) {
    experienceState.users[id].x = data.x;
    experienceState.users[id].y = data.y;
  }
});

// update to farm grid
socket.on("partyTime", (value) => {
  // console.log(data);
  experienceState.party = value;
});

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
