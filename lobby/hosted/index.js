const popquizEvents = require('./popquiz.js');
const raffleEvents = require('./raffle.js');
const voteEvents = require('./vote.js');

const registerHostedActivityEvents = (io, socket, touchRoom) => {
  popquizEvents(io, socket, touchRoom);
  raffleEvents(io, socket, touchRoom);
  voteEvents(io, socket, touchRoom);
};

registerHostedActivityEvents.handlePlayerLeft = (roomname, playerId, newHostId) => {
  if (typeof popquizEvents.handlePlayerLeft === 'function') popquizEvents.handlePlayerLeft(roomname, playerId, newHostId);
  if (typeof raffleEvents.handlePlayerLeft === 'function') raffleEvents.handlePlayerLeft(roomname, playerId, newHostId);
  if (typeof voteEvents.handlePlayerLeft === 'function') voteEvents.handlePlayerLeft(roomname, playerId, newHostId);
};

registerHostedActivityEvents.updateHostId = (roomname, oldHostId, newHostId) => {
  if (typeof popquizEvents.updateHostId === 'function') popquizEvents.updateHostId(roomname, oldHostId, newHostId);
  if (typeof raffleEvents.updateHostId === 'function') raffleEvents.updateHostId(roomname, oldHostId, newHostId);
  if (typeof voteEvents.updateHostId === 'function') voteEvents.updateHostId(roomname, oldHostId, newHostId);
};

module.exports = registerHostedActivityEvents;

