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
  "perception008.gif",
];

const socket = io();

let me = null;

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

  // Use the SHARED state from the server:
  const isParty = experienceState.party;

  if (isParty) {
    // when ANY user is touching any perception object
    fill(random(255), random(255), random(255));
    noStroke();
  } else {
    stroke(0);
    noFill();
  }
  // central circle whose style depends on party mode
  circle(width / 2, height / 2, width * experienceState.partyradius);

  // draw all users
  for (let id in experienceState.users) {
    const u = experienceState.users[id];

    fill(u.color, 0, 0);

    if (id === me) {
      // me = use local mouse position
      circle(mouseX, mouseY, 70);
    } else {
      // others = use normalized position from server
      circle(u.x * width, u.y * height, 15);
    }
  }

  // perception objects
  for (let per of perceptionsArray) {
    // OPTIONAL BUT NICE:
    // repel from ALL users (me + others),
    // so other people's avatars can affect objects on my screen
    for (let id in experienceState.users) {
      const u = experienceState.users[id];
      let ux, uy;

      if (id === me) {
        ux = mouseX;
        uy = mouseY;
      } else {
        ux = u.x * width;
        uy = u.y * height;
      }

      per.repelFrom(ux, uy, 50, 2);
    }

    per.separate(perceptionsArray);
    per.update();
    per.borders();
    per.display();
  }
}

// background(200);

// //chatGPt help with the math
// let touching = usersTouchingPerceptions(); //touching to be called  in the app.js

// if (touching) {
//   // when any user is touching any perception object
//   fill(random(255), random(255), random(255)); // or a fixed color if you prefer
//   noStroke();
// } else {
//   stroke(0);
//   noFill();
// }

// circle(width / 2, height / 2, width * experienceState.partyradius);

// // draw all users
// for (let id in experienceState.users) {
//   const u = experienceState.users[id];

//   if (id === me) {
//     fill(u.color, 0, 0);
//     circle(mouseX, mouseY, 70);
//   } else {
//     fill(u.color, 0, 0);
//     circle(u.x * width, u.y * height, 15);
//   }
// }

// // perception objects calling
// for (let per of perceptionsArray) {
//   // repel from ALL users (me + others)
//   for (let id in experienceState.users) {
//     const u = experienceState.users[id];

//     // convert normalized coords to pixels for others
//     let ux, uy;
//     if (id === me) {
//       // my avatar is at my mouse
//       ux = mouseX;
//       uy = mouseY;
//     } else {
//       ux = u.x * width;
//       uy = u.y * height;
//     }

//     per.repelFrom(ux, uy, 50, 2);
//   }

//   per.separate(perceptionsArray);
//   per.update();
//   per.borders();
//   per.display();
// }

// SEND MOVEMENT (throttled, i.e. send less often)
//maybe this is where i need toreplace the circles with the drawings
function mouseMoved() {
  let now = millis();
  if (now - lastSent < SEND_RATE) {
    return;
  }

  lastSent = now;

  // Local calculation: is ANY avatar touching a perception here?
  const touching = usersTouchingPerceptions();

  socket.emit("move", {
    x: mouseX / width,
    y: mouseY / height,
    inRadius: checkMyDistance(),
    touching: touching, // send to server
  });
}

//   socket.emit("move", {
//     x: mouseX / width,
//     y: mouseY / height,
//     inRadius: checkMyDistance(),
//   });
// }

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

/*
this part is where the connection happens between this sketch.js and app.js 
which then will create a real time connection

*/
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
    experienceState.users[id].inRadius = data.inRadius;
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
