//import and setup
/* The static import declaration is used to import read-only live bindings 
which are exported by another module. 
https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import#named_import
*/

//bringing in the libraries
import express from "express"; //static files
import http from "http"; //socket.io and http server
import { Server } from "socket.io"; // create a websocket server

const app = express(); //express app
const server = http.createServer(app); //http server that uses app to ahnle http requests
const io = new Server(server); //socket.io server that attaches to the http erver to share the same port
const port = process.env.PORT || 3333; // this port is where the erver will listen on

/*this makes Express serve eveerything inside the /public folder as a static files
To serve static files such as images, CSS files, and JavaScript files, 
use the express.static built-in middleware function in Express.
https://expressjs.com/en/starter/static-files.html 
 */
app.use(express.static("public")); //the name of the folder eall the codes are in

//start the http+socket.io server
server.listen(port, () => {
  console.log("listening on:", port);
});

// EXPERIENCE STATE server is the authority ---- sahred experience state
let numUsers = 0;
let experienceState = {
  //global object held only on the server
  users: {}, // socket.id -> avatar data
  // {maps each connected socket.id to their state(x,y,color,scale,ratio..etc)}
  partyradius: 0.5,
  party: false,
};

// handling new connections \
/* https://socket.io/docs/v3/client-socket-instance/
https://socket.io/docs/v4/emitting-events/
https://nodejs.org/docs/latest/api/events.html#events
socket instance (client-side)
emitting listening to
*/
io.on("connection", (socket) => {
  console.log("user connected:", socket.id);

  // Create user object when joined
  experienceState.users[socket.id] = {
    // adds a new entry for this new socket
    x: 0,
    y: 0,
    inRadius: false,
    touching: false,
    assetNum: 0, //which object users are using
    color: Math.floor(Math.random() * 155) + 100,
  };
  numUsers = Object.keys(experienceState.users).length;

  // Send FULL state once (on join only)
  socket.emit("init", {
    id: socket.id,
    state: experienceState,
  });

  // Tell others a new user joined
  socket.broadcast.emit("userJoined", {
    id: socket.id,
    user: experienceState.users[socket.id],
  });

  // ---- MOVEMENT UPDATES (small + frequent) ----
  socket.on("move", (data) => {
    const user = experienceState.users[socket.id];
    if (!user) return;

    user.x = data.x;
    user.y = data.y;
    user.inRadius = data.inRadius;
    user.touching = !!data.touching; //touching called

    // Send ONLY this user's update
    socket.broadcast.emit("userMoved", {
      id: socket.id,
      x: user.x,
      y: user.y,
      inRadius: user.inRadius,
    });

    let anyTouching = false;
    for (let id in experienceState.users) {
      let u = experienceState.users[id];
      if (u.touching) {
        anyTouching = true;
        break;
      }
    }

    let isPartytime = anyTouching;
    experienceState.party = isPartytime; // keep state mirror up to date
    io.emit("partyTime", isPartytime);
  });
  //   let numUsersInRadius = 0;
  //   for (let id in experienceState.users) {
  //     let u = experienceState.users[id];
  //     if (u.inRadius) {
  //       numUsersInRadius++;
  //     }
  //   }

  //   let percentage = numUsersInRadius / numUsers;
  //   let isPartytime = percentage >= 0.7; // will be a boolean value
  //   io.emit("partyTime", isPartytime);
  // });

  socket.on("disconnect", () => {
    console.log("user disconnected:", socket.id);

    delete experienceState.users[socket.id];

    io.emit("userLeft", socket.id);
    numUsers = Object.keys(experienceState.users).length;
  });
});
