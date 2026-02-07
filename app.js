import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = process.env.PORT || 3333;

app.use(express.static("public"));

server.listen(port, () => {
  console.log("listening on:", port);
});

// EXPERIENCE STATE server is the authority
let numUsers = 0;
let experienceState = {
  users: {}, // socket.id -> avatar data
  partyradius: 0.5,
  party: false,
};

io.on("connection", (socket) => {
  console.log("user connected:", socket.id);

  // Create user
  experienceState.users[socket.id] = {
    x: 0,
    y: 0,
    inRadius: false,
    touching: false,
    assetNum: 0,
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
