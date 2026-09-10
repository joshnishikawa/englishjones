const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');
const multiplayer = require('../lobby/lobby');

describe('Multiplayer Sockets Integration', () => {
  let io, server, serverPort;
  let clientSocket1, clientSocket2;

  beforeAll((done) => {
    server = http.createServer();
    io = new Server(server);
    multiplayer(io);

    server.listen(() => {
      serverPort = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    if (clientSocket1 && clientSocket1.connected) clientSocket1.disconnect();
    if (clientSocket2 && clientSocket2.connected) clientSocket2.disconnect();
    io.close(done);
  });

  beforeEach((done) => {
    clientSocket1 = Client(`http://localhost:${serverPort}`);
    clientSocket1.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket1.connected) clientSocket1.disconnect();
    if (clientSocket2 && clientSocket2.connected) clientSocket2.disconnect();
  });

  test('getName generates a random name and emits setName', (done) => {
    clientSocket1.emit('getName', { id: 'OldName' });
    clientSocket1.on('setName', (data) => {
      expect(data).toHaveProperty('id');
      expect(typeof data.id).toBe('string');
      expect(data.id.split(' ').length).toBeGreaterThanOrEqual(2);
      expect(data.number).toBe(1);
      done();
    });
  });

  test('getName generates a random name and emits setName when no prior id is provided', (done) => {
    clientSocket1.emit('getName', {});
    clientSocket1.on('setName', (data) => {
      expect(data).toHaveProperty('id');
      expect(typeof data.id).toBe('string');
      expect(data.id.split(' ').length).toBeGreaterThanOrEqual(2);
      expect(data.number).toBe(1);
      done();
    });
  });

  test('join private room and allow second player to join', (done) => {
    clientSocket1.emit('join', {
      id: 'Player1',
      roomtype: 'private',
      color: '#ff0000',
    });

    clientSocket1.on('joined', (data1) => {
      expect(data1.playerNum).toBe(1);
      expect(data1.room).toBeDefined();
      expect(data1.room.roomtype).toBe('private');
      const roomname = data1.room.roomname;

      // Connect second player and join same room
      clientSocket2 = Client(`http://localhost:${serverPort}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('join', {
          id: 'Player2',
          roomtype: 'private',
          roomname: roomname,
          color: '#00ff00',
        });
      });

      clientSocket2.on('joined', (data2) => {
        expect(data2.playerNum).toBe(2);
        expect(data2.room.roomname).toBe(roomname);
        expect(data2.room.players.length).toBe(2);
        done();
      });
    });
  });

  test('roomSearch finds an active room', (done) => {
    clientSocket1.emit('join', {
      id: 'SearchHost',
      roomtype: 'private',
      color: '#123456',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket1.emit('roomSearch', roomname);
      clientSocket1.on('roomSearch', (foundRoom) => {
        expect(foundRoom).not.toBeNull();
        expect(foundRoom.roomname).toBe(roomname);
        done();
      });
    });
  });

  test('setColor broadcasts color change to other players', (done) => {
    clientSocket1.emit('join', {
      id: 'ColorHost',
      roomtype: 'private',
      color: '#111111',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('join', {
          id: 'ColorGuest',
          roomtype: 'private',
          roomname: roomname,
          color: '#222222',
        });
      });

      clientSocket2.on('joined', () => {
        clientSocket2.on('setColor', (colorData) => {
          expect(colorData.color).toBe('#abcdef');
          expect(colorData.number).toBe(1);
          done();
        });

        clientSocket1.emit('setColor', {
          roomname: roomname,
          id: 'ColorHost',
          color: '#abcdef',
        });
      });
    });
  });

  test('activityComplete resets activity and emits returnToLobby', (done) => {
    clientSocket1.emit('join', {
      id: 'ActivityHost',
      roomtype: 'private',
      color: '#0d6efd',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket1.emit('activityComplete', { roomname, activity: null });

      clientSocket1.on('returnToLobby', (lobbyData) => {
        expect(lobbyData.roomname).toBe(roomname);
        expect(lobbyData.players[0].activity).toBeNull();
        done();
      });
    });
  });

  test('host ending hosted activity with activityComplete returns everyone to lobby while remaining host to select another activity', (done) => {
    clientSocket1.emit('join', {
      id: 'HostedHost',
      roomtype: 'private',
      color: '#0d6efd',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;

      clientSocket2 = Client(`http://localhost:${serverPort}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('join', {
          newRoom: roomname,
          player: { id: 'HostedStudent', color: '#ff0000', number: 2 },
        });
      });

      let returnedToLobby = false;

      clientSocket2.on('joined', () => {
        clientSocket1.emit('startActivity', {
          roomname,
          id: 'HostedHost',
          activity: 'popquiz',
        });
      });

      clientSocket1.on('loadActivity', (act) => {
        if (act === 'popquiz') {
          clientSocket1.emit('activityComplete', {
            roomname,
            activity: 'popquiz',
          });
        } else if (act === 'raffle') {
          expect(returnedToLobby).toBe(true);
          done();
        }
      });

      clientSocket1.on('returnToLobby', (lobbyData) => {
        returnedToLobby = true;
        expect(lobbyData.roomname).toBe(roomname);
        expect(lobbyData.players.length).toBe(2);
        expect(lobbyData.players[0].activity).toBeNull();
        expect(lobbyData.players[1].activity).toBeNull();

        clientSocket1.emit('startActivity', {
          roomname,
          id: 'HostedHost',
          activity: 'raffle',
        });
      });
    });
  });

  test('leave event allows player to exit room', (done) => {
    clientSocket1.emit('join', {
      id: 'Leaver',
      roomtype: 'private',
      color: '#0d6efd',
    });

    clientSocket1.on('joined', ({ room }) => {
      clientSocket1.emit('leave', {
        id: 'Leaver',
        roomname: room.roomname,
        roomtype: 'private',
      });

      clientSocket1.on('youLeft', () => {
        done();
      });
    });
  });

  test('activity events: match/state and race/state broadcast correctly', (done) => {
    clientSocket1.emit('join', {
      id: 'StateHost',
      roomtype: 'private',
      color: '#0d6efd',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('join', {
          id: 'StateGuest',
          roomtype: 'private',
          roomname: roomname,
          color: '#222222',
        });
      });

      clientSocket2.on('joined', () => {
        clientSocket2.on('match/state', (state) => {
          expect(state).toEqual({ score: 10 });
          done();
        });

        clientSocket1.emit('match/state', {
          roomname,
          state: { score: 10 },
        });
      });
    });
  });

  test('chooseActivity emits activityChosen and loadActivity when all players agree', (done) => {
    clientSocket1.emit('join', {
      id: 'Voter1',
      roomtype: 'private',
      color: '#0d6efd',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('join', {
          id: 'Voter2',
          roomtype: 'private',
          roomname: roomname,
          color: '#222222',
        });
      });

      clientSocket2.on('joined', () => {
        clientSocket2.on('loadActivity', (activity) => {
          expect(activity).toBe('race');
          done();
        });

        // Player 1 chooses race
        clientSocket1.emit('chooseActivity', {
          roomname,
          id: 'Voter1',
          activity: 'race',
        });

        // Player 2 chooses race
        clientSocket2.emit('chooseActivity', {
          roomname,
          id: 'Voter2',
          activity: 'race',
        });
      });
    });
  });

  test('chooseActivity ignores invalid activity IDs', (done) => {
    clientSocket1.emit('join', {
      id: 'InvalidActPlayer',
      roomtype: 'private',
      color: '#0d6efd',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket1.emit('chooseActivity', {
        roomname,
        id: 'InvalidActPlayer',
        activity: 'malicious-activity-script',
      });

      clientSocket1.on('roomOpened', () => {
        // If invalid activity was accepted, solitary player would open a public room
        done(new Error('Invalid activity should not open public room or set activity'));
      });

      clientSocket1.on('activityChosen', (data) => {
        const p = data.players.find(x => x.id === 'InvalidActPlayer');
        expect(p.activity).toBeNull();
        done();
      });
    });
  });

  test('startActivity ignores unknown activity IDs and does not emit loadActivity', (done) => {
    clientSocket1.emit('join', {
      id: 'InvalidStartHost',
      roomtype: 'private',
      color: '#0d6efd',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      let loadEmitted = false;

      clientSocket1.on('loadActivity', () => {
        loadEmitted = true;
      });

      clientSocket1.emit('startActivity', {
        roomname,
        id: 'InvalidStartHost',
        activity: '../../nonexistent',
      });

      setTimeout(() => {
        expect(loadEmitted).toBe(false);
        done();
      }, 150);
    });
  });

  test('choose activity flow: playerready, selectimg, selectword, reveal', (done) => {
    clientSocket1.emit('join', {
      id: 'Chooser',
      roomtype: 'private',
      color: '#0d6efd',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('join', {
          id: 'Guesser',
          roomtype: 'private',
          roomname: roomname,
          color: '#222222',
        });
      });

      clientSocket2.on('joined', () => {
        let roundStarted = false;

        clientSocket1.on('choose/roundstart', (roundData) => {
          expect(roundData.items.length).toBeGreaterThan(0);
          expect(roundData.chooserNumber).toBe(1);
          roundStarted = true;

          // Chooser selects image
          clientSocket1.emit('choose/selectimg', {
            roomname,
            word: 'apple',
          });
        });

        clientSocket2.on('choose/imageselected', (imgData) => {
          expect(imgData.word).toBe('apple');
          expect(imgData.chooserNumber).toBe(1);

          // Guesser submits word
          clientSocket2.emit('choose/selectword', {
            roomname,
            word: 'apple',
          });
        });

        clientSocket2.on('choose/reveal', (revealData) => {
          expect(revealData.correctWord).toBe('apple');
          expect(revealData.results).toEqual(
            expect.arrayContaining([
              expect.objectContaining({
                playerId: 'Guesser',
                word: 'apple',
                correct: true,
              }),
            ])
          );
          done();
        });

        // Both players mark ready
        clientSocket1.emit('choose/playerready', {
          roomname,
          playerId: 'Chooser',
          playerNumber: 1,
        });

        clientSocket2.emit('choose/playerready', {
          roomname,
          playerId: 'Guesser',
          playerNumber: 2,
        });
      });
    });
  });

  test('hostId is assigned to room creator and promoted to Player 2 when Player 1 leaves', (done) => {
    clientSocket1.emit('join', {
      id: 'OriginalHost',
      roomtype: 'private',
      color: '#ff0000',
    });

    clientSocket1.on('joined', ({ room, playerNum }) => {
      expect(playerNum).toBe(1);
      expect(room.hostId).toBe('OriginalHost');
      const roomname = room.roomname;

      // Connect Player 2
      clientSocket2 = Client(`http://localhost:${serverPort}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('join', {
          id: 'Player2',
          roomtype: 'private',
          roomname: roomname,
          color: '#00ff00',
        });
      });

      clientSocket2.on('joined', (data2) => {
        expect(data2.playerNum).toBe(2);
        expect(data2.room.hostId).toBe('OriginalHost');

        // Player 1 leaves
        clientSocket2.on('playerLeft', (remainingPlayers) => {
          expect(remainingPlayers.length).toBe(1);
          expect(remainingPlayers[0].id).toBe('Player2');

          // Verify hostId promotion by doing a roomSearch
          clientSocket2.emit('roomSearch', roomname);
          clientSocket2.on('roomSearch', (foundRoom) => {
            expect(foundRoom.hostId).toBe('Player2');

            // Connect a new Player 3 who will get playerNum 1
            const clientSocket3 = Client(`http://localhost:${serverPort}`);
            clientSocket3.on('connect', () => {
              clientSocket3.emit('join', {
                id: 'NewPlayer',
                roomtype: 'private',
                roomname: roomname,
                color: '#0000ff',
              });
            });

            clientSocket3.on('joined', (data3) => {
              // New player gets slot 1, but hostId remains Player2
              expect(data3.playerNum).toBe(1);
              expect(data3.room.hostId).toBe('Player2');
              clientSocket3.disconnect();
              done();
            });
          });
        });

        clientSocket1.emit('leave', {
          id: 'OriginalHost',
          roomname: roomname,
          roomtype: 'private',
        });
      });
    });
  });

  test('hostId updates when host changes name with getName', (done) => {
    clientSocket1.emit('join', {
      id: 'NameChangingHost',
      roomtype: 'private',
      color: '#ff0000',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      expect(room.hostId).toBe('NameChangingHost');

      clientSocket1.emit('getName', {
        id: 'NameChangingHost',
        roomname: roomname,
      });

      clientSocket1.on('setName', (data) => {
        expect(data.id).not.toBe('NameChangingHost');
        const newName = data.id;

        clientSocket1.emit('roomSearch', roomname);
        clientSocket1.on('roomSearch', (foundRoom) => {
          expect(foundRoom.hostId).toBe(newName);
          done();
        });
      });
    });
  });

  test('host activity flow: host selects Pop Quiz and starts activity', (done) => {
    clientSocket1.emit('join', {
      id: 'HostPlayer',
      roomtype: 'private',
      color: '#ff0000',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('join', {
          id: 'GuestPlayer',
          roomtype: 'private',
          roomname: roomname,
          color: '#00ff00',
        });
      });

      clientSocket2.on('joined', () => {
        // Guest listens for activityChosen when host picks popquiz
        clientSocket2.on('activityChosen', (data) => {
          expect(data.selectedHostActivity).toBe('popquiz');

          // Guest attempts to start activity -> should fail
          clientSocket2.emit('startActivity', {
            roomname,
            id: 'GuestPlayer',
            activity: 'popquiz',
          });

          clientSocket2.on('error', (err) => {
            expect(err.message).toMatch(/Only the host/);

            // Now host starts activity -> should emit loadActivity to all
            clientSocket2.on('loadActivity', (activity) => {
              expect(activity).toBe('popquiz');
              done();
            });

            clientSocket1.emit('startActivity', {
              roomname,
              id: 'HostPlayer',
              activity: 'popquiz',
            });
          });
        });

        // Host chooses popquiz
        clientSocket1.emit('chooseActivity', {
          roomname,
          id: 'HostPlayer',
          activity: 'popquiz',
        });
      });
    });
  });

  test('popquiz socket flow: ready, roundstart, select, grade, and gameover', (done) => {
    const customQuestions = [
      ['apples', 'bananas', 'pears'],
    ];

    clientSocket1.emit('join', {
      id: 'QuizHost',
      roomtype: 'private',
      color: '#ff0000',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('join', {
          id: 'QuizGuest',
          roomtype: 'private',
          roomname: roomname,
          color: '#00ff00',
        });
      });

      clientSocket2.on('joined', () => {
        // Player 2 ready
        clientSocket2.emit('popquiz/ready', {
          roomname,
          playerId: 'QuizGuest',
          playerNumber: 2,
          color: '#00ff00',
          isHost: false,
          questions: customQuestions,
        });

        // Player 1 (Host) ready
        clientSocket1.emit('popquiz/ready', {
          roomname,
          playerId: 'QuizHost',
          playerNumber: 1,
          color: '#ff0000',
          isHost: true,
          questions: customQuestions,
        });

        // Host sets numbers and starts quiz
        clientSocket1.emit('popquiz/setNumbers', {
          roomname,
          id: 'QuizHost',
        });

        // Listen for roundstart
        clientSocket2.on('popquiz/roundstart', (roundData) => {
          expect(roundData.choices).toEqual(['apples', 'bananas', 'pears']);
          expect(roundData.questionIndex).toBe(0);

          // Guest selects choice 0 (apples)
          clientSocket2.emit('popquiz/select', {
            roomname,
            playerId: 'QuizGuest',
            playerNumber: 2,
            color: '#00ff00',
            choiceIndex: 0,
          });
        });

        clientSocket1.on('popquiz/playerselected', (selectData) => {
          if (selectData.playerId === 'QuizGuest') {
            expect(selectData.choiceIndex).toBe(0);

            // Host grades choice 0 as correct
            clientSocket1.emit('popquiz/grade', {
              roomname,
              id: 'QuizHost',
              correctChoiceIndex: 0,
            });
          }
        });

        clientSocket2.on('popquiz/graded', (gradedData) => {
          expect(gradedData.correctChoiceIndex).toBe(0);
          expect(gradedData.scores['QuizGuest']).toBe(1);
          expect(gradedData.isGameOver).toBe(true);

          // Host taps Next to finish quiz
          clientSocket1.emit('popquiz/nextRound', {
            roomname,
            id: 'QuizHost',
          });
        });

        clientSocket2.on('popquiz/gameover', (overData) => {
          expect(overData.scores['QuizGuest']).toBe(1);
          done();
        });
      });
    });
  });

  test('refresh rejoining: player reconnects with same room and rejoins active activity', (done) => {
    clientSocket1.emit('join', {
      id: 'HostRefresh',
      roomtype: 'private',
      color: '#ff0000',
    });

    clientSocket1.on('joined', ({ room, playerNum }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('join', {
          id: 'GuestRefresh',
          roomtype: 'private',
          roomname: roomname,
          color: '#00ff00',
        });
      });

      clientSocket2.on('joined', () => {
        // Start Pop Quiz
        clientSocket1.emit('startActivity', {
          roomname,
          id: 'HostRefresh',
          activity: 'popquiz',
          questions: [['yes', 'no']],
        });

        clientSocket2.on('loadActivity', () => {
          // Host readies and starts quiz
          clientSocket1.emit('popquiz/ready', {
            roomname,
            playerId: 'HostRefresh',
            isHost: true,
            questions: [['yes', 'no']],
          });
          clientSocket1.emit('popquiz/setNumbers', {
            roomname,
            id: 'HostRefresh',
          });

          // Guest simulates page refresh by disconnecting socket2 and connecting socket3
          clientSocket2.disconnect();

          const clientSocket3 = Client(`http://localhost:${serverPort}`);
          clientSocket3.on('connect', () => {
            // Re-join with stored player data
            clientSocket3.emit('join', {
              id: 'GuestRefresh',
              roomtype: 'private',
              roomname: roomname,
              number: 2,
              color: '#00ff00',
            });
          });

          clientSocket3.on('joined', (rejoinData) => {
            expect(rejoinData.room.roomname).toBe(roomname);
            expect(rejoinData.room.activity).toBe('popquiz');

            // Ready in popquiz and verify receipt of ongoing roundstart
            clientSocket3.emit('popquiz/ready', {
              roomname,
              playerId: 'GuestRefresh',
              playerNumber: 2,
              color: '#00ff00',
              isHost: false,
            });

            clientSocket3.on('popquiz/roundstart', (roundData) => {
              expect(roundData.choices).toEqual(['yes', 'no']);
              clientSocket3.disconnect();
              done();
            });
          });
        });
      });
    });
  });

  test('host selects activity but has not started: refresh does not auto-start activity', (done) => {
    clientSocket1.emit('join', {
      id: 'HostPreStart',
      roomtype: 'private',
      color: '#ff0000',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;

      // Host chooses Pop Quiz (selects it in menu, but has NOT started it)
      clientSocket1.emit('chooseActivity', {
        roomname,
        id: 'HostPreStart',
        activity: 'popquiz',
      });

      clientSocket1.on('activityChosen', () => {
        // Host simulates refresh by disconnecting and reconnecting
        clientSocket1.disconnect();

        const newHostSocket = Client(`http://localhost:${serverPort}`);
        newHostSocket.on('connect', () => {
          newHostSocket.emit('join', {
            id: 'HostPreStart',
            roomtype: 'public',
            roomname: roomname,
            number: 1,
            color: '#ff0000',
            activity: 'popquiz',
          });
        });

        newHostSocket.on('joined', (rejoinData) => {
          expect(rejoinData.room.roomname).toBe(roomname);
          // Activity must NOT be marked running because host never clicked Start
          expect(rejoinData.room.activity).toBeNull();
          newHostSocket.disconnect();
          done();
        });
      });
    });
  });

  test('refresh on gameover: player reconnecting on winners screen receives gameover state again', (done) => {
    clientSocket1.emit('join', {
      id: 'HostPodium',
      roomtype: 'private',
      color: '#ff0000',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('join', {
          id: 'GuestPodium',
          roomtype: 'private',
          roomname: roomname,
          color: '#00ff00',
        });
      });

      clientSocket2.on('joined', () => {
        clientSocket1.emit('popquiz/ready', {
          roomname,
          playerId: 'HostPodium',
          isHost: true,
          questions: [['finish_now']],
        });

        clientSocket2.emit('popquiz/ready', {
          roomname,
          playerId: 'GuestPodium',
          isHost: false,
          questions: [['finish_now']],
        });

        clientSocket1.emit('popquiz/setNumbers', {
          roomname,
          id: 'HostPodium',
        });

        clientSocket2.on('popquiz/roundstart', () => {
          clientSocket2.emit('popquiz/select', {
            roomname,
            playerId: 'GuestPodium',
            choiceIndex: 0,
          });
        });

        clientSocket1.on('popquiz/playerselected', () => {
          clientSocket1.emit('popquiz/grade', {
            roomname,
            id: 'HostPodium',
            correctChoiceIndex: 0,
          });
        });

        clientSocket1.on('popquiz/graded', () => {
          clientSocket1.emit('popquiz/nextRound', {
            roomname,
            id: 'HostPodium',
          });
        });

        clientSocket2.on('popquiz/gameover', (gameOverData) => {
          expect(gameOverData.winners.length).toBeGreaterThan(0);

          // Simulate user refreshing on the gameover screen
          clientSocket2.disconnect();
          const clientSocket3 = Client(`http://localhost:${serverPort}`);
          clientSocket3.on('connect', () => {
            clientSocket3.emit('popquiz/ready', {
              roomname,
              playerId: 'GuestPodium',
              isHost: false,
            });
          });

          clientSocket3.on('popquiz/gameover', (rejoinedGameOverData) => {
            expect(rejoinedGameOverData.winners.length).toBeGreaterThan(0);
            expect(rejoinedGameOverData.scores['GuestPodium']).toBe(1);
            clientSocket3.disconnect();
            done();
          });
        });
      });
    });
  });

  test('live question update: host updates answers list and other players receive updated choices', (done) => {
    clientSocket1.emit('join', {
      id: 'HostQuestionUpdater',
      roomtype: 'private',
      color: '#ff0000',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('join', {
          id: 'GuestQuestionUpdater',
          roomtype: 'private',
          roomname: roomname,
          color: '#00ff00',
        });
      });

      clientSocket2.on('joined', () => {
        let receivedInitial = false;
        clientSocket2.on('popquiz/roundstart', (roundData) => {
          if (!receivedInitial) {
            receivedInitial = true;
            expect(roundData.choices).toEqual(['initial_1', 'initial_2']);

            // Host changes answers list after guest has joined
            clientSocket1.emit('popquiz/updateQuestions', {
              roomname,
              id: 'HostQuestionUpdater',
              questions: [['updated_cat', 'updated_dog', 'updated_bird']],
            });
          } else {
            // Guest receives the updated choices
            expect(roundData.choices).toEqual(['updated_cat', 'updated_dog', 'updated_bird']);
            done();
          }
        });

        // Both players ready in popquiz with initial questions
        clientSocket1.emit('popquiz/ready', {
          roomname,
          playerId: 'HostQuestionUpdater',
          isHost: true,
          questions: [['initial_1', 'initial_2']],
        });

        clientSocket2.emit('popquiz/ready', {
          roomname,
          playerId: 'GuestQuestionUpdater',
          isHost: false,
        });

        clientSocket2.once('popquiz/sync', () => {
          clientSocket1.emit('popquiz/setNumbers', {
            roomname,
            id: 'HostQuestionUpdater',
          });
        });
      });
    });
  });

  test('solitary host selecting an activity creates public room and broadcasts publicRoomsList', (done) => {
    clientSocket1.emit('join', {
      id: 'SolitaryHost',
      roomtype: 'private',
      color: '#0d6efd',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);

      clientSocket2.on('connect', () => {
        clientSocket2.on('publicRoomsList', (publicRooms) => {
          const found = publicRooms.find((r) => r.roomname === roomname);
          if (found) {
            expect(found.activity).toBe('race');
            expect(found.playerCount).toBe(1);
            expect(found.hostId).toBe('SolitaryHost');
            done();
          }
        });

        // Host selects race while alone in room
        clientSocket1.emit('chooseActivity', {
          roomname,
          id: 'SolitaryHost',
          activity: 'race',
        });
      });
    });
  });

  test('solitary host deselecting activity reverts room to private and updates publicRoomsList', (done) => {
    clientSocket1.emit('join', {
      id: 'ToggleHost',
      roomtype: 'private',
      color: '#0d6efd',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);

      clientSocket2.on('connect', () => {
        let wasPublic = false;

        clientSocket2.on('publicRoomsList', (publicRooms) => {
          const found = publicRooms.find((r) => r.roomname === roomname);
          if (found && !wasPublic) {
            wasPublic = true;
            // Now deselect the activity
            clientSocket1.emit('chooseActivity', {
              roomname,
              id: 'ToggleHost',
              activity: null,
            });
          } else if (wasPublic && !found) {
            // Room successfully removed from publicRoomsList
            done();
          }
        });

        // Host selects choose activity
        clientSocket1.emit('chooseActivity', {
          roomname,
          id: 'ToggleHost',
          activity: 'choose',
        });
      });
    });
  });

  test('host activity does not start on consensus when multiple players select it', (done) => {
    clientSocket1.emit('join', {
      id: 'NoConsensusHost',
      roomtype: 'private',
      color: '#ff0000',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);

      clientSocket2.on('connect', () => {
        clientSocket2.emit('join', {
          id: 'NoConsensusGuest',
          roomtype: 'private',
          roomname: roomname,
          color: '#00ff00',
        });
      });

      clientSocket2.on('joined', () => {
        let loadActivityCalled = false;
        clientSocket2.on('loadActivity', () => {
          loadActivityCalled = true;
        });

        clientSocket2.on('activityChosen', (data) => {
          expect(data.selectedHostActivity).toBe('popquiz');

          // Wait 150ms to ensure loadActivity was NOT triggered on consensus
          setTimeout(() => {
            expect(loadActivityCalled).toBe(false);
            done();
          }, 150);
        });

        // Host selects popquiz
        clientSocket1.emit('chooseActivity', {
          roomname,
          id: 'NoConsensusHost',
          activity: 'popquiz',
        });

        // Guest also selects popquiz
        clientSocket2.emit('chooseActivity', {
          roomname,
          id: 'NoConsensusGuest',
          activity: 'popquiz',
        });
      });
    });
  });

  test('rejoining guest with different questions in Pop Quiz does not replace items for room', (done) => {
    const hostQuestions = [
      ['host_apple', 'host_banana', 'host_cherry'],
    ];
    const guestRogueQuestions = [
      ['rogue_dog', 'rogue_cat'],
    ];

    clientSocket1.emit('join', {
      id: 'HostQuizMaster',
      roomtype: 'private',
      color: '#ff0000',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('join', {
          id: 'GuestStudent',
          roomtype: 'private',
          roomname: roomname,
          color: '#00ff00',
        });
      });

      clientSocket2.on('joined', () => {
        // Host starts Pop Quiz with hostQuestions
        clientSocket1.emit('startActivity', {
          roomname,
          id: 'HostQuizMaster',
          activity: 'popquiz',
          questions: hostQuestions,
        });

        clientSocket2.on('loadActivity', () => {
          // Host readies
          clientSocket1.emit('popquiz/ready', {
            roomname,
            playerId: 'HostQuizMaster',
            playerNumber: 1,
            isHost: true,
            questions: hostQuestions,
          });

          // Guest disconnects to simulate refresh
          clientSocket2.disconnect();

          const clientSocket3 = Client(`http://localhost:${serverPort}`);
          clientSocket3.on('connect', () => {
            clientSocket3.emit('join', {
              id: 'GuestStudent',
              roomtype: 'private',
              roomname: roomname,
              number: 2,
              color: '#00ff00',
            });
          });

          clientSocket3.on('joined', () => {
            // Guest rejoins and readies with guest's local rogue questions
            clientSocket3.emit('popquiz/ready', {
              roomname,
              playerId: 'GuestStudent',
              playerNumber: 2,
              isHost: false,
              questions: guestRogueQuestions,
            });

            clientSocket3.on('popquiz/sync', (syncData) => {
              // Sync must contain the host questions, NOT the guest's rogue questions
              expect(syncData.choices).toEqual(['host_apple', 'host_banana', 'host_cherry']);
              expect(syncData.totalQuestions).toBe(1);
              clientSocket3.disconnect();
              done();
            });
          });
        });
      });
    });
  });

  test('rejoining guest with different values in Raffle does not replace items for room', (done) => {
    const hostPrizes = ['Host Prize 1', 'Host Prize 2', 'Host Prize 3'];
    const guestPrizes = ['Rogue Prize X', 'Rogue Prize Y'];

    clientSocket1.emit('join', {
      id: 'HostRaffleMaster',
      roomtype: 'private',
      color: '#ff0000',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('join', {
          id: 'GuestRaffler',
          roomtype: 'private',
          roomname: roomname,
          color: '#00ff00',
        });
      });

      clientSocket2.on('joined', () => {
        // Host starts Raffle with hostPrizes
        clientSocket1.emit('startActivity', {
          roomname,
          id: 'HostRaffleMaster',
          activity: 'raffle',
          values: hostPrizes,
        });

        clientSocket2.on('loadActivity', () => {
          clientSocket1.emit('raffle/ready', {
            roomname,
            playerId: 'HostRaffleMaster',
            playerNumber: 1,
            isHost: true,
            values: hostPrizes,
          });

          clientSocket2.disconnect();

          const clientSocket3 = Client(`http://localhost:${serverPort}`);
          clientSocket3.on('connect', () => {
            clientSocket3.emit('join', {
              id: 'GuestRaffler',
              roomtype: 'private',
              roomname: roomname,
              number: 2,
              color: '#00ff00',
            });
          });

          clientSocket3.on('joined', () => {
            // Guest rejoins and readies with guest's local rogue prizes
            clientSocket3.emit('raffle/ready', {
              roomname,
              playerId: 'GuestRaffler',
              playerNumber: 2,
              isHost: false,
              values: guestPrizes,
            });

            clientSocket3.on('raffle/sync', (syncData) => {
              expect(syncData.totalCount).toBe(3);
              clientSocket3.disconnect();
              done();
            });
          });
        });
      });
    });
  });

  test('rejoining guest with different values in Vote does not replace items for room', (done) => {
    const hostOptions = ['Option Red', 'Option Green', 'Option Blue'];
    const guestOptions = ['Rogue Option 1', 'Rogue Option 2'];

    clientSocket1.emit('join', {
      id: 'HostVoteMaster',
      roomtype: 'private',
      color: '#ff0000',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('join', {
          id: 'GuestVoter',
          roomtype: 'private',
          roomname: roomname,
          color: '#00ff00',
        });
      });

      clientSocket2.on('joined', () => {
        // Host starts Vote with hostOptions
        clientSocket1.emit('startActivity', {
          roomname,
          id: 'HostVoteMaster',
          activity: 'vote',
          values: hostOptions,
        });

        clientSocket2.on('loadActivity', () => {
          clientSocket1.emit('vote/ready', {
            roomname,
            playerId: 'HostVoteMaster',
            playerNumber: 1,
            isHost: true,
            values: hostOptions,
          });

          clientSocket2.disconnect();

          const clientSocket3 = Client(`http://localhost:${serverPort}`);
          clientSocket3.on('connect', () => {
            clientSocket3.emit('join', {
              id: 'GuestVoter',
              roomtype: 'private',
              roomname: roomname,
              number: 2,
              color: '#00ff00',
            });
          });

          clientSocket3.on('joined', () => {
            // Guest rejoins and readies with guest's local rogue options
            clientSocket3.emit('vote/ready', {
              roomname,
              playerId: 'GuestVoter',
              playerNumber: 2,
              isHost: false,
              values: guestOptions,
            });

            clientSocket3.on('vote/sync', (syncData) => {
              expect(syncData.values).toEqual(['Option Red', 'Option Green', 'Option Blue']);
              expect(syncData.totalCount).toBe(3);
              clientSocket3.disconnect();
              done();
            });
          });
        });
      });
    });
  });

  describe('Inactivity Auto-Cleanup', () => {
    let customServer, customIo, customPort;
    let customClient1, customClient2;

    beforeAll((done) => {
      customServer = http.createServer();
      customIo = new Server(customServer);
      // Initialize multiplayer with a short inactivity timeout for testing
      multiplayer(customIo, { inactivityTimeout: 200, cleanupInterval: 50 });

      customServer.listen(() => {
        customPort = customServer.address().port;
        done();
      });
    });

    afterAll((done) => {
      if (customClient1 && customClient1.connected) customClient1.disconnect();
      if (customClient2 && customClient2.connected) customClient2.disconnect();
      customIo.close(done);
    });

    afterEach(() => {
      if (customClient1 && customClient1.connected) customClient1.disconnect();
      if (customClient2 && customClient2.connected) customClient2.disconnect();
    });

    test('inactive private room emits roomExpired and cleans up after inactivity timeout', (done) => {
      customClient1 = Client(`http://localhost:${customPort}`);
      customClient1.on('connect', () => {
        customClient1.emit('join', {
          id: 'InactivePlayer',
          roomtype: 'private',
          color: '#123456',
        });
      });

      customClient1.on('joined', ({ room }) => {
        const roomname = room.roomname;
        expect(roomname).toBeDefined();

        customClient1.on('roomExpired', (data) => {
          expect(data.roomname).toBe(roomname);

          // Verify the room no longer exists in search
          customClient1.emit('roomSearch', roomname);
          customClient1.on('roomSearch', (found) => {
            expect(found).toBeNull();
            done();
          });
        });
      });
    });

    test('inactive public room emits roomExpired and broadcasts updated public rooms list', (done) => {
      customClient1 = Client(`http://localhost:${customPort}`);
      customClient1.on('connect', () => {
        customClient1.emit('join', {
          id: 'PubInactiveHost',
          roomtype: 'private',
          color: '#abcdef',
        });
      });

      customClient1.on('joined', ({ room }) => {
        const roomname = room.roomname;

        // Host selects activity making the room public
        customClient1.emit('chooseActivity', {
          roomname,
          id: 'PubInactiveHost',
          activity: 'popquiz',
        });

        customClient1.on('roomOpened', () => {
          // Listen for room expiration and updated public rooms list
          let roomExpiredReceived = false;
          let publicListUpdated = false;

          customClient1.on('roomExpired', (data) => {
            expect(data.roomname).toBe(roomname);
            roomExpiredReceived = true;
            if (roomExpiredReceived && publicListUpdated) done();
          });

          customClient1.on('publicRoomsList', (roomsList) => {
            const hasRoom = roomsList.some((r) => r.roomname === roomname);
            if (roomExpiredReceived && !hasRoom) {
              publicListUpdated = true;
              done();
            } else if (!hasRoom && roomExpiredReceived) {
              publicListUpdated = true;
              done();
            }
          });
        });
      });
    });

    test('room activity resets inactivity timer and delays expiration', (done) => {
      customClient1 = Client(`http://localhost:${customPort}`);
      customClient1.on('connect', () => {
        customClient1.emit('join', {
          id: 'ActivePlayer',
          roomtype: 'private',
          color: '#333333',
        });
      });

      customClient1.on('joined', ({ room }) => {
        const roomname = room.roomname;
        let expiredEarly = false;

        customClient1.on('roomExpired', () => {
          expiredEarly = true;
        });

        // Send activity at 100ms (before 200ms timeout)
        setTimeout(() => {
          customClient1.emit('setColor', {
            roomname,
            id: 'ActivePlayer',
            color: '#444444',
          });
        }, 100);

        // Send another activity at 220ms (which is > 200ms from start, but < 200ms from last activity)
        setTimeout(() => {
          expect(expiredEarly).toBe(false);
          customClient1.emit('getName', {
            roomname,
            id: 'ActivePlayer',
          });
        }, 220);

        // At 300ms, the room should still be alive because of the touch at 220ms
        setTimeout(() => {
          expect(expiredEarly).toBe(false);
          done();
        }, 300);
      });
    });
  });

  test('roomSearch is case-insensitive and finds room when searched in uppercase or mixed-case', (done) => {
    clientSocket1.emit('join', {
      id: 'CaseHost',
      roomtype: 'private',
      color: '#123456',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket1.emit('roomSearch', '  ' + roomname.toUpperCase() + '  ');
      clientSocket1.on('roomSearch', (foundRoom) => {
        expect(foundRoom).not.toBeNull();
        expect(foundRoom.roomname).toBe(roomname);
        done();
      });
    });
  });

  test('join is case-insensitive and allows guest to join using uppercase room name', (done) => {
    clientSocket1.emit('join', {
      id: 'CaseHost2',
      roomtype: 'private',
      color: '#111111',
    });

    clientSocket1.on('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);
      clientSocket2.on('connect', () => {
        clientSocket2.emit('join', {
          newRoom: roomname.toUpperCase(),
          player: { id: 'CaseGuest', roomname: 'temp_room', roomtype: 'private', color: '#222222' },
        });
      });

      clientSocket2.on('joined', (data) => {
        expect(data.room).toBeDefined();
        expect(data.room.roomname).toBe(roomname);
        expect(data.playerNum).toBe(2);
        done();
      });
    });
  });

  test('lobby groups allow more than 4 players to join before an activity is chosen', (done) => {
    clientSocket1.emit('join', {
      id: 'LobbyHost',
      roomtype: 'private',
      color: '#111111',
    });

    clientSocket1.on('joined', async ({ room }) => {
      const roomname = room.roomname;
      const extraClients = [];

      try {
        for (let i = 2; i <= 6; i++) {
          await new Promise((resolve, reject) => {
            const c = Client(`http://localhost:${serverPort}`);
            extraClients.push(c);
            c.on('connect', () => {
              c.emit('join', {
                newRoom: roomname,
                player: { id: `LobbyGuest${i}`, roomname: `temp_${i}`, roomtype: 'private', color: '#333333' },
              });
            });
            c.on('joined', (data) => {
              expect(data.room).toBeDefined();
              expect(data.room.roomname).toBe(roomname);
              expect(data.room.players.length).toBe(i);
              expect(data.playerNum).toBe(i);
              resolve();
            });
          });
        }
        done();
      } finally {
        extraClients.forEach((c) => {
          if (c.connected) c.disconnect();
        });
      }
    });
  });

  test('attempting to join a non-existent room does not evict player from current room', (done) => {
    clientSocket1.emit('join', {
      id: 'SafePlayer',
      roomtype: 'private',
      color: '#123456',
    });

    clientSocket1.once('joined', (data1) => {
      const originalRoom = data1.room.roomname;

      clientSocket1.once('joined', (data2) => {
        expect(data2.room).toBeUndefined();
        expect(data2.message).toBe('Room not found.');

        // Verify player is still recognized in original room by performing an action
        clientSocket1.emit('getName', { roomname: originalRoom, id: 'SafePlayer' });
        clientSocket1.once('setName', (nameData) => {
          expect(nameData.id).toBeDefined();
          done();
        });
      });

      clientSocket1.emit('join', {
        newRoom: 'this_room_does_not_exist_xyz',
        player: { id: 'SafePlayer', roomname: originalRoom, roomtype: 'private', color: '#123456' },
      });
    });
  });

  test('host refreshes page after selecting correct answer in Pop Quiz: reconnected host receives popquiz/graded and can advance with popquiz/nextRound', (done) => {
    clientSocket1.emit('join', {
      id: 'HostGradedRefresh',
      roomtype: 'private',
      color: '#ff0000',
    });

    clientSocket1.once('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);

      clientSocket2.once('connect', () => {
        clientSocket2.emit('join', {
          id: 'GuestGradedRefresh',
          roomtype: 'private',
          roomname: roomname,
          color: '#00ff00',
        });
      });

      clientSocket2.once('joined', () => {
        // Start Pop Quiz
        clientSocket1.emit('startActivity', {
          roomname,
          id: 'HostGradedRefresh',
          activity: 'popquiz',
          questions: [['ChoiceA', 'ChoiceB']],
        });

        clientSocket1.emit('popquiz/ready', {
          roomname,
          playerId: 'HostGradedRefresh',
          playerNumber: 1,
          isHost: true,
          questions: [['ChoiceA', 'ChoiceB']],
        });

        clientSocket2.emit('popquiz/ready', {
          roomname,
          playerId: 'GuestGradedRefresh',
          playerNumber: 2,
          isHost: false,
        });

        clientSocket1.emit('popquiz/setNumbers', {
          roomname,
          id: 'HostGradedRefresh',
        });

        clientSocket2.once('popquiz/roundstart', () => {
          clientSocket2.emit('popquiz/select', {
            roomname,
            playerId: 'GuestGradedRefresh',
            playerNumber: 2,
            color: '#00ff00',
            choiceIndex: 1,
          });
        });

        clientSocket1.once('popquiz/playerselected', (sel) => {
          if (sel.playerId === 'GuestGradedRefresh') {
            // Host grades choice 1 as correct
            clientSocket1.emit('popquiz/grade', {
              roomname,
              id: 'HostGradedRefresh',
              correctChoiceIndex: 1,
            });
          }
        });

        clientSocket1.once('popquiz/graded', (firstGradedData) => {
          expect(firstGradedData.correctChoiceIndex).toBe(1);

          // Host simulates page refresh: disconnect socket1 and connect socket3
          clientSocket1.disconnect();

          const clientSocket3 = Client(`http://localhost:${serverPort}`);
          clientSocket3.once('connect', () => {
            clientSocket3.emit('join', {
              id: 'HostGradedRefresh',
              roomtype: 'private',
              roomname: roomname,
              number: 1,
              color: '#ff0000',
            });
          });

          clientSocket3.once('joined', () => {
            // Host emits popquiz/ready after refresh
            clientSocket3.emit('popquiz/ready', {
              roomname,
              playerId: 'HostGradedRefresh',
              playerNumber: 1,
              color: '#ff0000',
              isHost: true,
            });

            // Reconnected host MUST receive popquiz/graded!
            clientSocket3.once('popquiz/graded', (reconnectedGradedData) => {
              expect(reconnectedGradedData.correctChoiceIndex).toBe(1);
              expect(reconnectedGradedData.scores['GuestGradedRefresh']).toBe(1);

              // Host can now advance to next round / gameover
              clientSocket3.emit('popquiz/nextRound', {
                roomname,
                id: 'HostGradedRefresh',
              });

              clientSocket3.once('popquiz/gameover', (gameOverData) => {
                expect(gameOverData.scores['GuestGradedRefresh']).toBe(1);
                clientSocket3.disconnect();
                done();
              });
            });
          });
        });
      });
    });
  });

  test('guest cannot change name while in a room, but host can change name and activity retains host controls', (done) => {
    clientSocket1.emit('join', {
      id: 'HostRenameTest',
      roomtype: 'private',
      color: '#ff0000',
    });

    clientSocket1.once('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);
      clientSocket2.once('connect', () => {
        clientSocket2.emit('join', {
          id: 'GuestRenameTest',
          roomtype: 'private',
          roomname: roomname,
          color: '#00ff00',
        });
      });

      clientSocket2.once('joined', () => {
        // Guest attempts to change name via getName
        clientSocket2.emit('getName', {
          id: 'GuestRenameTest',
          roomname: roomname,
        });

        clientSocket2.once('error', (err) => {
          expect(err.message).toBe('Only the host can change their name.');

          // Host starts Pop Quiz
          clientSocket1.emit('startActivity', {
            roomname,
            id: 'HostRenameTest',
            activity: 'popquiz',
            questions: [['A', 'B'], ['C', 'D']],
          });

          clientSocket1.emit('popquiz/ready', {
            roomname,
            playerId: 'HostRenameTest',
            playerNumber: 1,
            isHost: true,
            questions: [['A', 'B'], ['C', 'D']],
          });

          clientSocket2.emit('popquiz/ready', {
            roomname,
            playerId: 'GuestRenameTest',
            playerNumber: 2,
            isHost: false,
          });

          // Host changes their name
          clientSocket1.emit('getName', {
            id: 'HostRenameTest',
            roomname: roomname,
          });

          clientSocket1.once('setName', (nameData) => {
            const newHostName = nameData.id;
            expect(newHostName).toBeDefined();
            expect(newHostName).not.toBe('HostRenameTest');

            // Newly renamed host can advance activity (popquiz/setNumbers) without being rejected
            clientSocket1.emit('popquiz/setNumbers', {
              roomname,
              id: newHostName,
            });

            clientSocket1.once('popquiz/roundstart', (roundData) => {
              expect(roundData.questionIndex).toBe(0);
              done();
            });
          });
        });
      });
    });
  });

  test('player leaving room emits playerLeft and rejoin preserves activity selections and score', (done) => {
    clientSocket1.emit('join', {
      id: 'HostLeaveRejoin',
      roomtype: 'private',
      color: '#ff0000',
    });

    clientSocket1.once('joined', ({ room }) => {
      const roomname = room.roomname;
      clientSocket2 = Client(`http://localhost:${serverPort}`);
      clientSocket2.once('connect', () => {
        clientSocket2.emit('join', {
          id: 'GuestLeaveRejoin',
          roomtype: 'private',
          roomname: roomname,
          color: '#00ff00',
        });
      });

      clientSocket2.once('joined', () => {
        clientSocket1.emit('startActivity', {
          roomname,
          id: 'HostLeaveRejoin',
          activity: 'popquiz',
          questions: [['X', 'Y'], ['W', 'Z']],
        });

        clientSocket1.emit('popquiz/ready', {
          roomname,
          playerId: 'HostLeaveRejoin',
          playerNumber: 1,
          isHost: true,
          questions: [['X', 'Y'], ['W', 'Z']],
        });

        clientSocket2.emit('popquiz/ready', {
          roomname,
          playerId: 'GuestLeaveRejoin',
          playerNumber: 2,
          isHost: false,
        });

        // Guest selects number 2
        clientSocket2.emit('popquiz/selectNumber', {
          roomname,
          playerId: 'GuestLeaveRejoin',
          number: 2,
        });

        clientSocket1.once('popquiz/numberSelected', (numData) => {
          expect(numData.playerId).toBe('GuestLeaveRejoin');
          expect(numData.number).toBe(2);

          // Guest leaves the room
          clientSocket2.emit('leave', {
            roomname,
            id: 'GuestLeaveRejoin',
            roomtype: 'private',
          });

          // Host receives playerLeft
          clientSocket1.once('playerLeft', (remainingPlayers) => {
            expect(remainingPlayers.some((p) => p.id === 'GuestLeaveRejoin')).toBe(false);

            // Guest reconnects / rejoins
            clientSocket2.emit('join', {
              id: 'GuestLeaveRejoin',
              roomtype: 'private',
              roomname: roomname,
              number: 2,
              color: '#00ff00',
            });

            clientSocket2.once('joined', () => {
              clientSocket2.emit('popquiz/ready', {
                roomname,
                playerId: 'GuestLeaveRejoin',
                playerNumber: 2,
                isHost: false,
              });

              // popquiz/sync should reflect the preserved number selection for GuestLeaveRejoin
              clientSocket2.once('popquiz/sync', (syncData) => {
                expect(syncData.numberSelections['GuestLeaveRejoin']).toBe(2);
                done();
              });
            });
          });
        });
      });
    });
  });
});



