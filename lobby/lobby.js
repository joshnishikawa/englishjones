const adjectives = [
  "Agile", "Brave", "Cunning", "Daring", "Eager", "Fearless", "Gentle", "Happy", "Inventive", "Jolly", 
  "Kind", "Lively", "Mighty", "Nimble", "Odd", "Playful", "Quick", "Rapid", "Sneaky", "Tough", 
  "Unique", "Valiant", "Witty", "Zesty", "Zany", "Clever", "Curious", "Diligent", "Fancy", "Silly", 
  "Swift", "Bold", "Charming", "Funny", "Lazy", "Grumpy", "Shy", "Wacky", "Goofy", "Noisy", "Brilliant",
  "Epic", "Funky", "Glorious", "Mysterious", "Radiant", "Smiley", "Tireless", "Vivacious", "Wise", "Adventurous", 
  "Bubbly", "Energetic", "Fearsome", "Gallant", "Heroic", "Jovial", "Majestic", "Peppy", "Snazzy", "Terrific", 
  "Weird", "Zen", "Luminous", "Proud", "Rugged", "Dapper", "Magical", "Nifty", "Quirky", "Stubborn", "Wild", 
  "Chilled", "Hyper", "Excited", "Moody", "Jumpy", "Sleek", "Stormy", "Sunny", "Fierce", "Elegant", "Lucky", 
  "Sparkling", "Vibrant", "Humble", "Shiny", "Fearful", "Loyal", "Reckless", "Optimistic", "Puzzling", "Lunar", 
  "Cosmic", "Galactic", "Breezy", "Silent", "Crafty", "Dynamic", "Fluffy", "Snoozy", "Ruthless", "Inspiring", 
  "Whimsical", "Tidy", "Gritty", "Plucky", "Electric", "Hasty", "Bold", "Fuzzy", "Dizzy", "Wandering", 
  "Precise", "Velvet", "Twisting", "Fiery", "Soaring", "Prudent", "Vigilant", "Zealous", "Chipper", "Radiant",
  "Ethereal", "Invisible", "Melodic", "Prismatic", "Quantum", "Roaring", "Sneaky", "Thunderous", "Icy", "Whirling",
  "Blazing", "Gleaming", "Harmonic", "Savage", "Serene", "Transcendent", "Whispering", "Diligent", "Ferocious",
  "Flickering", "Rumbling", "Vast", "Mighty", "Paradoxical", "Whimsical", "Shadowy", "Jagged", "Crimson", 
  "Frosty", "Galactic", "Golden", "Silver", "Azure", "Ebony", "Scarlet", "Breezy", "Gleeful", "Hidden",
  "Jagged", "Keen", "Light", "Mystical", "Obsidian", "Puzzling", "Roaring", "Silent", "Twinkling", "Uplifted",
  "Vivid", "Wandering", "Yawning", "Zesty", "Astral", "Blissful", "Dazzling", "Emerald", "Major", "Noble"
];

const nouns = [
  "Ninja", "Penguin", "Pirate", "Dragon", "Unicorn", "Robot", "Wizard", "Alien", "Monster", "Shark", 
  "Eagle", "Cheetah", "Fox", "Panther", "Wolf", "Tiger", "Bear", "Owl", "Phoenix", "Dolphin", 
  "Squirrel", "Octopus", "Turtle", "Lion", "Leopard", "Chameleon", "Falcon", "Crocodile", "Raccoon", "Lizard", 
  "Knight", "Samurai", "Viking", "Ghost", "Yeti", "Goblin", "Cyclops", "Griffin", "Mermaid", "Sasquatch",
  "Phoenix", "Gryphon", "Sphinx", "Banshee", "Pegasus", "Werewolf", "Zombie", "Genie", "Mummy", "Elf", 
  "Dwarf", "Orc", "Centaur", "Chimera", "Hydra", "Kraken", "Minotaur", "Troll", "Cyborg", "Vampire", 
  "Witch", "Guardian", "Sentinel", "Ranger", "Warrior", "Soldier", "Explorer", "Scientist", "Engineer", 
  "Astronaut", "Shaman", "Sorcerer", "Cleric", "Gladiator", "Hunter", "Paladin", "Druid", "Titan", "Manticore", 
  "Basilisk", "Cerberus", "Lich", "Wendigo", "Rogue", "Jester", "Barbarian", "Monk", "Nymph", "Enchanter", 
  "Sage", "Priest", "Archer", "Bard", "Healer", "Alchemist", "Necromancer", "Timekeeper", "Seer", "Conqueror",
  "Blademaster", "Stormcaller", "Starwalker", "Flameweaver", "Bonecrusher", "Soulstealer", "Dreamweaver", "Sunwalker",
  "Wanderer", "Pathfinder", "Moonwalker", "Windrunner", "Skybreaker", "Seafarer", "Cloudstrider", "Flamestrider",
  "Mech", "Crawler", "Overseer", "Observer", "Pilot", "Thief", "Healer", "Commander", "Pilot", "Seeker",
  "Titan", "Destroyer", "Tempest", "Cobra", "Chimera", "Specter", "Golem", "Wraith", "Revenant", "Shade", "Fungus",
  "Amoeba", "Jellyfish", "Squid", "Starfish", "Crab", "Lobster", "Shrimp", "Scorpion", "Spider", "Beetle",
  "Ant", "Mantis", "Caterpillar", "Butterfly", "Dragonfly", "Grasshopper", "Locust", "Cicada", "Ladybug"
];

const rooms = [
  "ace", "act", "add", "age", "air", "all", "and", "ant", "any", "are", "arm",
  "art", "ask", "bad", "bag", "bar", "bat", "bed", "beg", "bet", "big", "bit",
  "box", "boy", "bug", "but", "buy", "cat", "can", "cap", "car", "cup", "cut",
  "day", "dog", "dry", "due", "eat", "end", "far", "fat", "fly", "for", "get",
  "god", "gun", "hat", "hen", "him", "hit", "hot", "how", "ice", "ink", "its",
  "jam", "job", "key", "law", "leg", "let", "log", "low", "man", "map", "may",
  "new", "not", "now", "old", "one", "our", "pen", "pet", "pig", "pot", "red",
  "run", "sad", "see", "set", "sit", "sun", "top", "try", "use", "war", "was",
  "wet", "win", "yes", "you", "able", "acid", "aged", "also", "area", "army",
  "away", "back", "ball", "band", "bank", "base", "bath", "bear", "beat", "been",
  "bell", "best", "bill", "bird", "blow", "blue", "boat", "body", "bomb", "book",
  "born", "both", "bowl", "bulk", "burn", "bush", "busy", "call", "calm", "came",
  "camp", "card", "care", "case", "cash", "cast", "cell", "chat", "city", "club",
  "coal", "coat", "cold", "come", "cool", "cope", "cost", "crew", "crop", "dark",
  "data", "date", "deal", "dear", "deck", "deep", "deny", "desk", "diet", "disk",
  "does", "door", "down", "draw", "drop", "dual", "dust", "duty", "earn", "east",
  "easy", "edge", "else", "even", "ever", "exit", "face", "fact", "fair", "fall",
  "farm", "fast", "fear", "feed", "feel", "feet", "felt", "file", "fill", "film",
  "find", "fire", "firm", "fish", "five", "flat", "flow", "food", "foot", "ford",
  "form", "fort", "four", "free", "from", "fuel", "full", "fund", "gain", "game",
  "gate", "gave", "gear", "gift", "girl", "give", "glad", "goal", "goes", "golf",
  "gone", "good", "gray", "grew", "grow", "hair", "half", "hand", "hang", "hard",
  "have", "head", "hear", "heat", "held", "help", "here", "hero",
  "high", "hill", "hire", "hold", "hole", "holy", "home", "hope", "host", "hour",
  "huge", "hunt", "hurt", "idea", "inch", "into", "iron", "item", "jack", "join",
  "jump", "just", "keen", "keep", "kind", "king", "knee", "knew", "know",
  "lack", "lady", "lake", "land", "lane", "last", "late", "lead", "left",
  "less", "life", "lift", "like", "line", "link", "list", "live", "load", "loan",
  "lock", "long", "look", "lord", "lose", "loss", "lost", "love", "luck", "made",
  "mail", "main", "make", "many", "mark", "mass", "meal", "mean", "meet", "mile",
  "milk", "mind", "mine", "miss", "mode", "move", "much", "must", "name", "navy",
  "near", "neck", "need", "news", "next", "nice", "note", "okay", "once", "only",
  "open", "part", "pass", "past", "path", "peak", "pick", "plan", "play", "plus",
  "poor", "port", "post", "pull", "push", "race", "rain", "rank", "rate", "read",
  "real", "rear", "rest", "rice", "rich", "ride", "ring", "rise", "risk", "road",
  "rock", "role", "room", "root", "rope", "rose", "rule", "rush", "safe", "said",
  "same", "sand", "save", "seat", "seed", "seek", "seem", "seen", "sell", "send",
  "sent", "ship", "shop", "show", "shut", "sick", "side", "sign", "site", "size",
  "slip", "slow", "snow", "soft", "soil", "sold", "sole", "some", "song", "sort",
  "soul", "soup", "spot", "star", "stay", "step", "stop", "such", "suit", "sure",
  "take", "talk", "tall", "tank", "tape", "task", "team", "tell", "tend", "term",
  "test", "than", "that", "them", "then", "they", "thin", "this", "thus", "time",
  "tiny", "told", "toll", "tone", "tool", "tour", "town", "tree", "trip", "true",
  "tune", "turn", "type", "unit", "upon", "used", "user", "vary", "vast", "very",
  "vice", "view", "vote", "wage", "wait", "walk", "wall", "want", "warm", "warn",
  "wash", "wave", "wear", "week", "well", "went", "were", "west", "what", "when",
  "whom", "wide", "wife", "wild", "will", "wind", "wine", "wing", "wire", "wise",
  "wish", "wood", "word", "work", "yard", "yeah", "year", "your", "zero", "zone"
];


const registerMultiplayerActivityEvents = require("./multiplayer");
const registerHostedActivityEvents = require("./hosted");
const popquizActivity = require("./hosted/popquiz");
const raffleActivity = require("./hosted/raffle");
const voteActivity = require("./hosted/vote");
const chooseActivity = require("./multiplayer/choose");
const multiplayerActivitiesConfig = require("../config/multiplayer_activities.js");
const validActivityIds = new Set(multiplayerActivitiesConfig.map((a) => a.id));
const hostActivityIds = new Set(
  multiplayerActivitiesConfig.filter((a) => a.group === "host").map((a) => a.id)
);

// Input validation helpers
function isStr(val, maxLen = 100) {
  return typeof val === 'string' && val.length > 0 && val.length <= maxLen;
}

function sanitizePlayerData(data) {
  if (!data || typeof data !== 'object') return null;
  const clean = {};
  if (isStr(data.id, 60)) clean.id = data.id;
  else return null;
  if (data.roomname !== undefined && data.roomname !== null) {
    if (isStr(data.roomname, 60)) clean.roomname = data.roomname;
    else return null;
  }
  if (data.name !== undefined && data.name !== null) {
    if (isStr(data.name, 40)) clean.name = data.name;
    else clean.name = 'Anonymous';
  }
  if (data.color !== undefined && data.color !== null) {
    if (typeof data.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(data.color)) clean.color = data.color;
  }
  if (data.number !== undefined && data.number !== null) {
    if (typeof data.number === 'number' && Number.isInteger(data.number) && data.number >= 1 && data.number <= 100) clean.number = data.number;
  }
  if (data.activity !== undefined && data.activity !== null) {
    if (isStr(data.activity, 60) && validActivityIds.has(data.activity)) clean.activity = data.activity;
  }
  if (data.avatar !== undefined && data.avatar !== null) {
    if (isStr(data.avatar, 200)) clean.avatar = data.avatar;
  }
  if (data.roomtype !== undefined && data.roomtype !== null) {
    if (data.roomtype === 'public' || data.roomtype === 'private') clean.roomtype = data.roomtype;
  }
  return clean;
}



const multiplayer = (io, options = {}) => {
  let publicRooms = {};
  let privateRooms = {};
  const INACTIVITY_TIMEOUT = (options && typeof options.inactivityTimeout === 'number') ? options.inactivityTimeout : 10 * 60 * 1000;
  const CLEANUP_INTERVAL = (options && typeof options.cleanupInterval === 'number') ? options.cleanupInterval : 60 * 1000;

  // Helper function to get available rooms efficiently
  function getAvailableRooms() {
    const usedRooms = new Set([
      ...Object.keys(publicRooms),
      ...Object.keys(privateRooms),
    ]);
    return rooms.filter((room) => !usedRooms.has(room));
  }

  function getPublicRoomsList() {
    return Object.values(publicRooms)
      .filter((r) => {
        if (!r || !r.open || !r.players || r.players.length === 0) return false;
        const isHostAct = Boolean(
          (r.activity && hostActivityIds.has(r.activity)) ||
          (r.selectedHostActivity && hostActivityIds.has(r.selectedHostActivity)) ||
          (r.players[0] && r.players[0].activity && hostActivityIds.has(r.players[0].activity))
        );
        if (isHostAct) return true;
        return r.players.length < 4;
      })
      .map((r) => {
        const isHostAct = Boolean(
          (r.activity && hostActivityIds.has(r.activity)) ||
          (r.selectedHostActivity && hostActivityIds.has(r.selectedHostActivity)) ||
          (r.players[0] && r.players[0].activity && hostActivityIds.has(r.players[0].activity))
        );
        return {
          roomname: r.roomname,
          activity: r.activity || r.selectedHostActivity || (r.players[0] ? r.players[0].activity : null),
          isHostActivity: isHostAct,
          playerCount: r.players.length,
          hostId: r.hostId,
          players: r.players.map((p) => ({
            id: p.id,
            color: p.color,
            number: p.number,
          })),
        };
      });
  }

  function broadcastPublicRooms() {
    io.emit("publicRoomsList", getPublicRoomsList());
  }

  function touchRoom(roomname) {
    if (!roomname) return;
    const room = publicRooms[roomname] || privateRooms[roomname];
    if (room) {
      room.lastActive = Date.now();
    }
  }

  function clearActivityRoomStates(roomname) {
    try {
      if (popquizActivity && typeof popquizActivity.clearPopquizState === "function") {
        popquizActivity.clearPopquizState(roomname);
      }
      if (raffleActivity && typeof raffleActivity.clearRaffleState === "function") {
        raffleActivity.clearRaffleState(roomname);
      }
      if (voteActivity && typeof voteActivity.clearVoteState === "function") {
        voteActivity.clearVoteState(roomname);
      }
      if (chooseActivity && typeof chooseActivity.clearChooseState === "function") {
        chooseActivity.clearChooseState(roomname);
      }
    } catch (e) {
      // ignore
    }
  }

  // Helper function to remove duplicate players by ID from a room
  function removeDuplicatePlayers(room) {
    const seen = new Set();
    room.players = room.players.filter((player) => {
      if (seen.has(player.id)) {
        return false;
      }
      seen.add(player.id);
      return true;
    });
  }

  // Helper function to find player index by ID
  function findPlayerIndex(players, playerId) {
    return players.findIndex((player) => player.id === playerId);
  }

  // Periodic cleanup function to ensure no duplicates exist
  function cleanupDuplicatePlayers() {
    // Clean up public rooms
    Object.keys(publicRooms).forEach((roomname) => {
      if (publicRooms[roomname]) {
        removeDuplicatePlayers(publicRooms[roomname]);
      }
    });

    // Clean up private rooms
    Object.keys(privateRooms).forEach((roomname) => {
      if (privateRooms[roomname]) {
        removeDuplicatePlayers(privateRooms[roomname]);
      }
    });
  }

  // Auto-remove rooms after 10 minutes of inactivity
  function cleanupInactiveRooms(customNow) {
    const now = customNow || Date.now();
    let publicRoomsChanged = false;

    // Check public rooms
    Object.keys(publicRooms).forEach((roomname) => {
      const room = publicRooms[roomname];
      if (!room) return;
      const lastActive = room.lastActive || room.date || 0;
      if (now - lastActive >= INACTIVITY_TIMEOUT) {
        io.to(roomname).emit("roomExpired", {
          roomname,
        });
        clearActivityRoomStates(roomname);
        delete publicRooms[roomname];
        publicRoomsChanged = true;
      }
    });

    // Check private rooms
    Object.keys(privateRooms).forEach((roomname) => {
      const room = privateRooms[roomname];
      if (!room) return;
      const lastActive = room.lastActive || room.date || 0;
      if (now - lastActive >= INACTIVITY_TIMEOUT) {
        io.to(roomname).emit("roomExpired", {
          roomname,
        });
        clearActivityRoomStates(roomname);
        delete privateRooms[roomname];
      }
    });

    if (publicRoomsChanged) {
      broadcastPublicRooms();
    }
  }

  function runCleanup() {
    cleanupDuplicatePlayers();
    cleanupInactiveRooms();
  }

  // Run cleanup every minute
  const cleanupInterval = setInterval(runCleanup, CLEANUP_INTERVAL);
  if (cleanupInterval.unref) cleanupInterval.unref();

  function openPublicRoom(data) {
    let available = getAvailableRooms();
    if (available.length === 0) {
      return null; // no available rooms
    } else {
      let roomname = available[Math.floor(Math.random() * available.length)];
      let date = Date.now(); // current unix timecode
      data.number = 1; // set the player number to 1 if it's a new room
      publicRooms[roomname] = {
        roomname,
        roomtype: "public",
        hostId: data.id,
        selectedHostActivity: (data.activity && hostActivityIds.has(data.activity)) ? data.activity : null,
        activity: null,
        players: [data],
        open: true,
        turn: 1, // set the turn to player 1
        date,
        lastActive: date,
      };
      broadcastPublicRooms();
      return roomname;
    }
  }

  function openPrivateRoom(data) {
    // check if there are any available rooms
    let available = getAvailableRooms();
    if (available.length === 0) {
      return null; // no available rooms
    } else {
      let roomname = available[Math.floor(Math.random() * available.length)];
      let date = Date.now(); // current unix timecode
      data.number = 1; // set the player number to 1 if it's a new room
      privateRooms[roomname] = {
        roomname,
        roomtype: "private",
        hostId: data.id,
        selectedHostActivity: null,
        open: true,
        activity: null,
        players: [data],
        turn: 1,
        date,
        lastActive: date,
      };
      return roomname;
    }
  }

  function closePublicRoom(roomname) {
    clearActivityRoomStates(roomname);
    delete publicRooms[roomname];
    broadcastPublicRooms();
  }

  function closePrivateRoom(roomname) {
    clearActivityRoomStates(roomname);
    delete privateRooms[roomname];
  }


  function joinPrivateRoom(socket, data) {
    data.roomtype = "private"; // Ensure roomtype is set to private
    let roomname = Object.keys(privateRooms).includes(data.roomname)
      ? data.roomname
      : openPrivateRoom(data);
    if (roomname === null) {
      socket.emit("joined", { message: "No more available rooms." });
      return;
    } else {
      let room = privateRooms[roomname];

      // Safety check: remove any duplicate players that might exist
      removeDuplicatePlayers(room);

      let existingPlayerIndex = findPlayerIndex(room.players, data.id);
      let playerNum;

      if (existingPlayerIndex === -1) {
        // Player not found, add new player
        if (!room.open) {
          socket.emit("joined", {
            message:
              "Sorry, this room is closed and your name is not on the list.",
          });
        } else {
          const isStandardAct = Boolean(
            room.activity && !hostActivityIds.has(room.activity)
          );
          if (!isStandardAct || room.players.length < 4) {
            socket.join(roomname);

            // set the player number to the next available number
            let playerNum = 1;
            let playerNums = room.players.map((x) => x.number);
            while (playerNums.includes(playerNum)) playerNum++;
            data.number = playerNum;
            data.roomname = roomname; // Ensure roomname is updated
            room.players.push(data);
            socket.emit("joined", { room, playerNum });
            socket.broadcast.to(roomname).emit("playerJoined", room.players);
            return roomname; // return the roomname for further use
          } else {
            socket.emit("joined", { message: "Sorry, this room is full." });
          }
        }
      } else {
        // Player found, update existing player data instead of adding duplicate
        playerNum = room.players[existingPlayerIndex].number;
        // Update the existing player's data with any new information
        room.players[existingPlayerIndex] = {
          ...room.players[existingPlayerIndex],
          ...data,
          number: playerNum,
        };
        socket.join(roomname);
        socket.emit("joined", { room, playerNum });
        socket.broadcast.to(roomname).emit("playerJoined", room.players);
        return roomname; // return the roomname for further use
      }
    }
  }

  function joinPublicRoom(socket, data) {
    data.roomtype = "public"; // Ensure roomtype is set to public
    let roomname =
      data.roomname && Object.keys(publicRooms).includes(data.roomname)
        ? data.roomname
        : openPublicRoom(data);

    if (roomname === null) {
      socket.emit("joined", { message: "No more available rooms." });
      return;
    } else {
      let room = publicRooms[roomname];

      // Safety check: remove any duplicate players that might exist
      removeDuplicatePlayers(room);

      let existingPlayerIndex = findPlayerIndex(room.players, data.id);
      let playerNum;

      if (existingPlayerIndex !== -1) {
        playerNum = room.players[existingPlayerIndex].number;
      }

      if (existingPlayerIndex === -1) {
        const isStandardAct = Boolean(
          room.activity && !hostActivityIds.has(room.activity)
        );
        // Player not found, add new player (only enforce 4 player limit for active standard activities)
        if (!isStandardAct || room.players.length < 4) {
          // set the player number to the next available number
          let playerNums = room.players.map((x) => x.number);
          let playerNum = 1;
          while (playerNums.includes(playerNum)) playerNum++;
          data.number = playerNum;
          data.roomname = roomname; // Ensure roomname is updated
          room.players.push(data);
          socket.join(roomname);
          socket.emit("joined", { room, playerNum });
          // broadcast to all sockets in the room except the sender
          socket.broadcast.to(roomname).emit("playerJoined", room.players);
          broadcastPublicRooms();
          return roomname; // return the roomname for further use
        } else
          socket.emit("joined", {
            message: "Sorry, this room filled up. You'll join a new one.",
          });
      } else {
        // Player found, update existing player data instead of adding duplicate
        // Update the existing player's data with any new information
        room.players[existingPlayerIndex] = {
          ...room.players[existingPlayerIndex],
          ...data,
          number: playerNum,
        };
        socket.join(roomname);
        socket.emit("joined", { room, playerNum });
        // broadcast to all sockets in the room except the sender
        socket.broadcast.to(roomname).emit("playerJoined", room.players);
        broadcastPublicRooms();
        return roomname; // return the roomname for further use
      }
    }
  }

  function leaveRoom(socket, data) {
    let roomname = data.roomname;
    let roomtype = data.roomtype;
    let id = data.id;
    let room;

    socket.leave(data.roomname);

    if (roomtype === "public" || publicRooms[roomname]) {
      if (publicRooms[roomname]) {
        room = publicRooms[roomname];
        room.players = room.players.filter((player) => player.id !== id);
        if (room.players.length === 0) {
          closePublicRoom(roomname);
        } else if (room.players.length === 1) {
          if (room.hostId === id) {
            room.hostId = room.players[0].id;
          }
          registerHostedActivityEvents.handlePlayerLeft(roomname, id, room.hostId);
          if (!room.players[0].activity) {
            room.roomtype = "private";
            room.activity = null;
            room.selectedHostActivity = null;
            privateRooms[roomname] = room;
            delete publicRooms[roomname];
            io.to(roomname).emit("roomClosed", {
              players: room.players,
              roomtype: "private",
              selectedHostActivity: null,
            });
            broadcastPublicRooms();
          } else {
            io.to(roomname).emit("playerLeft", room.players);
            broadcastPublicRooms();
          }
        } else {
          if (room.hostId === id) {
            room.hostId = room.players[0].id;
          }
          registerHostedActivityEvents.handlePlayerLeft(roomname, id, room.hostId);
          io.to(roomname).emit("playerLeft", room.players);
          broadcastPublicRooms();
        }
      }
    } else if (roomtype === "private" || privateRooms[roomname]) {
      if (privateRooms[roomname]) {
        room = privateRooms[roomname];
        room.players = room.players.filter((player) => player.id !== id);
        if (room.players.length === 0) {
          closePrivateRoom(roomname);
        } else {
          if (room.hostId === id) {
            room.hostId = room.players[0].id;
          }
          registerHostedActivityEvents.handlePlayerLeft(roomname, id, room.hostId);
          io.to(roomname).emit("playerLeft", room.players);
        }
      }
    }
  }

  // SOCKET.IO EVENTS ////////////////////////////////////////////////////////////
  io.sockets.on("connection", (socket) => {
    // Register activity events
    registerMultiplayerActivityEvents(io, socket, touchRoom);
    registerHostedActivityEvents(io, socket, touchRoom);

    // Send available public rooms to newly connected client
    socket.emit("publicRoomsList", getPublicRoomsList());

    socket.on("getPublicRooms", function () {
      socket.emit("publicRoomsList", getPublicRoomsList());
    });

    socket.on("join", function (data) {
      if (!data || typeof data !== 'object') return;
      if (data.newRoom) {
        if (!isStr(data.newRoom, 60)) return;
        const cleanNewRoom = data.newRoom.trim().toLowerCase();
        const player = sanitizePlayerData(data.player);
        if (!player) return;

        const targetRoom = privateRooms[cleanNewRoom] || publicRooms[cleanNewRoom];
        if (!targetRoom) {
          socket.emit("joined", { message: "Room not found." });
          return;
        }

        const isExistingPlayer = findPlayerIndex(targetRoom.players, player.id) !== -1;
        const isStandardAct = Boolean(
          targetRoom.activity && !hostActivityIds.has(targetRoom.activity)
        );
        if (!isExistingPlayer && isStandardAct && targetRoom.players.length >= 4) {
          socket.emit("joined", { message: "Sorry, this room is full." });
          return;
        }

        leaveRoom(socket, player);
        player.roomname = cleanNewRoom;
        if (Object.keys(privateRooms).includes(cleanNewRoom)) {
          joinPrivateRoom(socket, player);
        } else {
          joinPublicRoom(socket, player);
        }
      } else {
        const clean = sanitizePlayerData(data);
        if (!clean) return;
        if (clean.roomname) {
          clean.roomname = clean.roomname.trim().toLowerCase();
        }
        if (clean.roomtype === "public") {
          joinPublicRoom(socket, clean);
        } else if (clean.roomtype === "private") {
          joinPrivateRoom(socket, clean);
        } else {
          socket.emit("joined", { message: "Invalid room type specified." });
        }
      }
    });

    socket.on("roomSearch", function (data) {
      if (!isStr(data, 60)) return;
      const cleanRoom = data.trim().toLowerCase();
      touchRoom(cleanRoom);
      const room = privateRooms[cleanRoom] || publicRooms[cleanRoom] || null;
      socket.emit("roomSearch", room);
    });

    socket.on("getName", function (data) {
      if (!data || typeof data !== 'object') return;
      if (data.id !== undefined && data.id !== null && !isStr(data.id, 60)) return;
      if (data.roomname !== undefined && data.roomname !== null && !isStr(data.roomname, 60)) return;
      let roomname = data.roomname;
      touchRoom(roomname);
      let room;
      let adj = adjectives[Math.floor(Math.random() * adjectives.length)];
      let noun = nouns[Math.floor(Math.random() * nouns.length)];
      let newName = `${adj} ${noun}`;

      if (roomname && data.id) {
        // user is already in a room
        room = publicRooms[roomname] || privateRooms[roomname];
        if (room) {
          const isHost = (room.hostId === data.id);
          if (!isHost) {
            socket.emit("error", { message: "Only the host can change their name." });
            return;
          }
          const oldId = data.id;
          for (let player of room.players) {
            if (player.id === data.id) {
              room.hostId = newName;
              player.id = newName;
              registerHostedActivityEvents.updateHostId(roomname, oldId, newName);
              io.to(roomname).emit("setName", {
                number: player.number,
                id: player.id,
              });
              return;
            }
          }
        }
      }
      socket.emit("setName", { id: newName, number: 1 });
    });

    socket.on("setColor", function (data) {
      if (!data || typeof data !== 'object') return;
      if (!isStr(data.roomname, 60) || !isStr(data.id, 60)) return;
      if (!isStr(data.color, 20) || !/^#[0-9a-fA-F]{3,8}$/.test(data.color)) return;
      let roomname = data.roomname.trim().toLowerCase();
      touchRoom(roomname);
      let room = publicRooms[roomname] || privateRooms[roomname];

      if (room) {
        let player = room.players.find((p) => p.id === data.id);
        if (player) {
          player.color = data.color;
          socket.broadcast.to(roomname).emit("setColor", {
            id: player.id,
            number: player.number,
            color: player.color,
            activity: player.activity, // Include activity so other players can update activity pawn
          });
          if (publicRooms[roomname]) {
            broadcastPublicRooms();
          }
        }
      }
    });

    socket.on("leave", function (data) {
      const clean = sanitizePlayerData(data);
      if (!clean) return;
      touchRoom(clean.roomname);
      leaveRoom(socket, clean);
      socket.emit("youLeft");
    });

    socket.on("chooseActivity", function (data) {
      if (!data || typeof data !== 'object') return;
      if (!isStr(data.roomname, 60) || !isStr(data.id, 60)) return;
      if (data.activity !== undefined && data.activity !== null && (!isStr(data.activity, 30) || !validActivityIds.has(data.activity))) {
        data.activity = null;
      }
      let roomname = data.roomname;
      touchRoom(roomname);
      let room = privateRooms[roomname] || publicRooms[roomname];
      if (!room) {
        socket.emit("error", { message: "Room not found or closed." });
        return;
      }

      let player = room.players.find((p) => p.id === data.id);
      if (player) {
        player.activity = data.activity || null;
      }

      const isHost = (room.hostId === data.id);
      if (isHost) {
        if (data.activity && hostActivityIds.has(data.activity)) {
          room.selectedHostActivity = data.activity;
        } else {
          room.selectedHostActivity = null;
        }
      }

      // Solitary host in room (players.length === 1):
      if (room.players.length === 1) {
        if (data.activity) {
          // Host with no other players selects an activity thereby creating a public room
          room.activity = null;
          room.roomtype = "public";
          publicRooms[roomname] = room;
          delete privateRooms[roomname];

          socket.emit("roomOpened", {
            players: room.players,
            roomtype: "public",
            selectedHostActivity: room.selectedHostActivity,
          });
          io.to(roomname).emit("activityChosen", {
            players: room.players,
            selectedHostActivity: room.selectedHostActivity,
            roomtype: "public",
          });
          broadcastPublicRooms();
        } else {
          // Deselected activity while alone -> revert to private room
          room.activity = null;
          room.selectedHostActivity = null;
          room.roomtype = "private";
          privateRooms[roomname] = room;
          delete publicRooms[roomname];

          socket.emit("roomClosed", {
            players: room.players,
            roomtype: "private",
            selectedHostActivity: null,
          });
          io.to(roomname).emit("activityChosen", {
            players: room.players,
            selectedHostActivity: null,
            roomtype: "private",
          });
          broadcastPublicRooms();
        }
        return;
      }

      // Room has multiple players (players.length > 1)
      const isHostActivity = Boolean(
        room.selectedHostActivity ||
        (data.activity && hostActivityIds.has(data.activity))
      );

      if (isHostActivity) {
        // Host activities do not start on consensus; they require the host to click Start
        io.to(roomname).emit("activityChosen", {
          players: room.players,
          selectedHostActivity: room.selectedHostActivity || (hostActivityIds.has(data.activity) ? data.activity : null),
        });
        if (publicRooms[roomname]) {
          broadcastPublicRooms();
        }
        return;
      }

      const isStandardActivity = Boolean(data.activity && !hostActivityIds.has(data.activity));
      let allSame = isStandardActivity && room.players.every(
        (p) => p.activity === data.activity && p.activity !== null
      );
      if (allSame) {
        room.activity = data.activity;
        io.to(roomname).emit("loadActivity", data.activity);
      } else {
        io.to(roomname).emit("activityChosen", {
          players: room.players,
          selectedHostActivity: null,
        });
      }
    });

    socket.on("startActivity", function (data) {
      if (!data || typeof data !== 'object') return;
      if (!isStr(data.roomname, 60) || !isStr(data.id, 60)) return;
      if (!isStr(data.activity, 30) || !validActivityIds.has(data.activity)) return;
      let roomname = data.roomname;
      touchRoom(roomname);
      let room = privateRooms[roomname] || publicRooms[roomname];
      if (!room) return;

      if (room.hostId !== data.id) {
        socket.emit("error", { message: "Only the host can start this activity." });
        return;
      }

      room.activity = data.activity;
      room.activityPayload = data.payload || data.questions || data.values || null;
      if (data.activity === 'popquiz') {
        if (popquizActivity && typeof popquizActivity.getOrCreatePopquizState === 'function') {
          if (typeof popquizActivity.clearPopquizState === 'function') popquizActivity.clearPopquizState(roomname);
          const state = popquizActivity.getOrCreatePopquizState(roomname, room.activityPayload, data.id);
          state.started = true;
        }
      }
      if (data.activity === 'raffle') {
        if (raffleActivity && typeof raffleActivity.getOrCreateRaffleState === 'function') {
          if (typeof raffleActivity.clearRaffleState === 'function') raffleActivity.clearRaffleState(roomname);
          const state = raffleActivity.getOrCreateRaffleState(roomname, room.activityPayload, data.id);
          state.started = true;
        }
      }
      if (data.activity === 'vote') {
        if (voteActivity && typeof voteActivity.getOrCreateVoteState === 'function') {
          if (typeof voteActivity.clearVoteState === 'function') voteActivity.clearVoteState(roomname);
          const state = voteActivity.getOrCreateVoteState(roomname, room.activityPayload, data.id);
          state.started = true;
        }
      }
      io.to(roomname).emit("loadActivity", data.activity);
    });

    socket.on("activityComplete", function (data) {
      if (!data || !data.roomname) return;

      const roomname = data.roomname;
      touchRoom(roomname);
      const room = privateRooms[roomname] || publicRooms[roomname];
      if (!room) return;

      if (data.activity && room.activity && room.activity !== data.activity) return;

      clearActivityRoomStates(roomname);

      room.activity = null;
      room.selectedHostActivity = null;
      room.players.forEach((p) => {
        p.activity = null;
      });

      if (publicRooms[roomname]) {
        if (room.players.length === 1) {
          room.roomtype = "private";
          privateRooms[roomname] = room;
          delete publicRooms[roomname];
        }
        broadcastPublicRooms();
      }

      io.to(roomname).emit("activityChosen", {
        players: room.players,
        selectedHostActivity: null,
        roomtype: room.roomtype,
      });
      io.to(roomname).emit("returnToLobby", {
        roomname,
        players: room.players,
        selectedHostActivity: null,
        roomtype: room.roomtype,
      });
    });

    socket.on("disconnect", function () {
      // Socket disconnected - cleanup handled by socket.io automatically
    });
  });
};


module.exports = multiplayer;
