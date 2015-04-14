var canvasWidth, canvasHeight;

angular.module('myApp', [])
  .run(['$translate', '$log', 'realTimeService', 'randomService', 
      function ($translate, $log, realTimeService, randomService) {

  'use strict';

  var playerColor = [
    'blue', 'red', 'brown', 'purple',
    'pink', 'yellow', 'orange', 'silver',
  ];


  var SFX = {
    laser:     new Audio('audio/39459__THE_bizniss__laser.wav'),
    explosion: new Audio('audio/51467__smcameron__missile_explosion.wav')
  };

  // preload audio
  for (var sfx in SFX) {
    (function () {
      var audio = SFX[sfx];
      audio.muted = true;
      audio.play();

      SFX[sfx] = function () {
        if (!this.muted) {
          if (audio.duration === 0) {
            // somehow dropped out
            audio.load();
            audio.play();
          } else {
            audio.muted = false;
            audio.currentTime = 0;
          }
        }
        return audio;
      };

    })();
  }
  // pre-mute audio
  SFX.muted = true;


  function createCanvasController(canvas) {

    var Ship = function () {
      this.init("ship",
                [-5,   4,
                  0, -12,
                  5,   4]);

      this.children.exhaust = new Sprite();
      this.children.exhaust.init("exhaust",
                                 [-3,  6,
                                   0, 11,
                                   3,  6]);

      this.bulletCounter = 0;

      this.postMove = this.wrapPostMove;

      this.collidesWith = ["asteroid", "bigalien", "alienbullet"];

      this.preMove = function (delta) {
        if (KEY_STATUS.left) {
          this.vel.rot = -6;
        } else if (KEY_STATUS.right) {
          this.vel.rot = 6;
        } else {
          this.vel.rot = 0;
        }

        if (KEY_STATUS.up) {
          var rad = ((this.rot-90) * Math.PI)/180;
          this.acc.x = 0.5 * Math.cos(rad);
          this.acc.y = 0.5 * Math.sin(rad);
          this.children.exhaust.visible = randomService.random(3) > 0.1;
        } else {
          this.acc.x = 0;
          this.acc.y = 0;
          this.children.exhaust.visible = false;
        }

        if (this.bulletCounter > 0) {
          this.bulletCounter -= delta;
        }
        if (KEY_STATUS.space) {
          if (this.bulletCounter <= 0) {
            this.bulletCounter = 10;
            for (var i = 0; i < this.bullets.length; i++) {
              if (!this.bullets[i].visible) {
                SFX.laser();
                var bullet = this.bullets[i];
                var rad = ((this.rot-90) * Math.PI)/180;
                var vectorx = Math.cos(rad);
                var vectory = Math.sin(rad);
                // move to the nose of the ship
                bullet.x = this.x + vectorx * 4;
                bullet.y = this.y + vectory * 4;
                bullet.vel.x = 6 * vectorx + this.vel.x;
                bullet.vel.y = 6 * vectory + this.vel.y;
                bullet.visible = true;
                break;
              }
            }
          }
        }

        // limit the ship's speed
        if (Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y) > 8) {
          this.vel.x *= 0.95;
          this.vel.y *= 0.95;
        }
      };

      this.collision = function (other) {
        SFX.explosion();
        Game.explosionAt(other.x, other.y);
        Game.FSM.state = 'player_died';
        this.visible = false;
        this.currentNode.leave(this);
        this.currentNode = null;
        Game.lives--;
      };

    };
    Ship.prototype = new Sprite();

    var BigAlien = function () {
      this.init("bigalien",
                [-20,   0,
                 -12,  -4,
                  12,  -4,
                  20,   0,
                  12,   4,
                 -12,   4,
                 -20,   0,
                  20,   0]);

      this.children.top = new Sprite();
      this.children.top.init("bigalien_top",
                             [-8, -4,
                              -6, -6,
                               6, -6,
                               8, -4]);
      this.children.top.visible = true;

      this.children.bottom = new Sprite();
      this.children.bottom.init("bigalien_top",
                                [ 8, 4,
                                  6, 6,
                                 -6, 6,
                                 -8, 4]);
      this.children.bottom.visible = true;

      this.collidesWith = ["asteroid", "ship", "bullet"];

      this.bridgesH = false;

      this.bullets = [];
      this.bulletCounter = 0;

      this.newPosition = function () {
        if (randomService.random(3) < 0.5) {
          this.x = -20;
          this.vel.x = 1.5;
        } else {
          this.x = Game.canvasWidth + 20;
          this.vel.x = -1.5;
        }
        this.y = randomService.random(3) * Game.canvasHeight;
      };

      this.setup = function () {
        this.newPosition();

        for (var i = 0; i < 3; i++) {
          var bull = new AlienBullet();
          this.bullets.push(bull);
          Game.sprites.push(bull);
        }
      };

      this.preMove = function (delta) {
        var cn = this.currentNode;
        if (cn == null) return;

        var topCount = 0;
        if (cn.north.nextSprite) topCount++;
        if (cn.north.east.nextSprite) topCount++;
        if (cn.north.west.nextSprite) topCount++;

        var bottomCount = 0;
        if (cn.south.nextSprite) bottomCount++;
        if (cn.south.east.nextSprite) bottomCount++;
        if (cn.south.west.nextSprite) bottomCount++;

        if (topCount > bottomCount) {
          this.vel.y = 1;
        } else if (topCount < bottomCount) {
          this.vel.y = -1;
        } else if (randomService.random(3) < 0.01) {
          this.vel.y = -this.vel.y;
        }

        this.bulletCounter -= delta;
        if (this.bulletCounter <= 0) {
          this.bulletCounter = 22;
          for (var i = 0; i < this.bullets.length; i++) {
            if (!this.bullets[i].visible) {
              var bullet = this.bullets[i];
              var rad = 2 * Math.PI * randomService.random(3);
              var vectorx = Math.cos(rad);
              var vectory = Math.sin(rad);
              bullet.x = this.x;
              bullet.y = this.y;
              bullet.vel.x = 6 * vectorx;
              bullet.vel.y = 6 * vectory;
              bullet.visible = true;
              SFX.laser();
              break;
            }
          }
        }

      };

      BigAlien.prototype.collision = function (other) {
        if (other.name == "bullet") Game.score += 200;
        SFX.explosion();
        Game.explosionAt(other.x, other.y);
        this.visible = false;
        this.newPosition();
      };

      this.postMove = function () {
        if (this.y > Game.canvasHeight) {
          this.y = 0;
        } else if (this.y < 0) {
          this.y = Game.canvasHeight;
        }

        if ((this.vel.x > 0 && this.x > Game.canvasWidth + 20) ||
            (this.vel.x < 0 && this.x < -20)) {
          // why did the alien cross the road?
          this.visible = false;
          this.newPosition();
        }
      }
    };
    BigAlien.prototype = new Sprite();

    var Bullet = function () {
      this.init("bullet", [0, 0]);
      this.time = 0;
      this.bridgesH = false;
      this.bridgesV = false;
      this.postMove = this.wrapPostMove;
      // asteroid can look for bullets so doesn't have
      // to be other way around
      //this.collidesWith = ["asteroid"];

      this.configureTransform = function () {};
      this.draw = function () {
        if (this.visible) {
          this.context.save();
          this.context.lineWidth = 2;
          this.context.beginPath();
          this.context.moveTo(this.x-1, this.y-1);
          this.context.lineTo(this.x+1, this.y+1);
          this.context.moveTo(this.x+1, this.y-1);
          this.context.lineTo(this.x-1, this.y+1);
          this.context.stroke();
          this.context.restore();
        }
      };
      this.preMove = function (delta) {
        if (this.visible) {
          this.time += delta;
        }
        if (this.time > 50) {
          this.visible = false;
          this.time = 0;
        }
      };
      this.collision = function (other) {
        this.time = 0;
        this.visible = false;
        this.currentNode.leave(this);
        this.currentNode = null;
      };
      this.transformedPoints = function (other) {
        return [this.x, this.y];
      };

    };
    Bullet.prototype = new Sprite();

    var AlienBullet = function () {
      this.init("alienbullet");

      this.draw = function () {
        if (this.visible) {
          this.context.save();
          this.context.lineWidth = 2;
          this.context.beginPath();
          this.context.moveTo(this.x, this.y);
          this.context.lineTo(this.x-this.vel.x, this.y-this.vel.y);
          this.context.stroke();
          this.context.restore();
        }
      };
    };
    AlienBullet.prototype = new Bullet();

    var Asteroid = function () {
      this.init("asteroid",
                [-10,   0,
                  -5,   7,
                  -3,   4,
                   1,  10,
                   5,   4,
                  10,   0,
                   5,  -6,
                   2, -10,
                  -4, -10,
                  -4,  -5]);

      this.visible = true;
      this.scale = 6;
      this.postMove = this.wrapPostMove;

      this.collidesWith = ["ship", "bullet", "bigalien", "alienbullet"];

      this.collision = function (other) {
        SFX.explosion();
        if (other.name == "bullet") Game.score += 120 / this.scale;
        this.scale /= 3;
        if (this.scale > 0.5) {
          // break into fragments
          for (var i = 0; i < 3; i++) {
            var roid = $.extend(true, {}, this);
            roid.vel.x = randomService.random(3) * 6 - 3;
            roid.vel.y = randomService.random(3) * 6 - 3;
            if (randomService.random(3) > 0.5) {
              roid.points.reverse();
            }
            roid.vel.rot = randomService.random(3) * 2 - 1;
            roid.move(roid.scale * 3); // give them a little push
            Game.sprites.push(roid);
          }
        }
        Game.explosionAt(other.x, other.y);
        this.die();
      };
    };
    Asteroid.prototype = new Sprite();

    var Explosion = function () {
      this.init("explosion");

      this.bridgesH = false;
      this.bridgesV = false;

      this.lines = [];
      for (var i = 0; i < 5; i++) {
        var rad = 2 * Math.PI * randomService.random(3);
        var x = Math.cos(rad);
        var y = Math.sin(rad);
        this.lines.push([x, y, x*2, y*2]);
      }

      this.draw = function () {
        if (this.visible) {
          this.context.save();
          this.context.lineWidth = 1.0 / this.scale;
          this.context.beginPath();
          for (var i = 0; i < 5; i++) {
            var line = this.lines[i];
            this.context.moveTo(line[0], line[1]);
            this.context.lineTo(line[2], line[3]);
          }
          this.context.stroke();
          this.context.restore();
        }
      };

      this.preMove = function (delta) {
        if (this.visible) {
          this.scale += delta;
        }
        if (this.scale > 8) {
          this.die();
        }
      };
    };
    Explosion.prototype = new Sprite();

    var GridNode = function () {
      this.north = null;
      this.south = null;
      this.east  = null;
      this.west  = null;

      this.nextSprite = null;

      this.dupe = {
        horizontal: null,
        vertical:   null
      };

      this.enter = function (sprite) {
        sprite.nextSprite = this.nextSprite;
        this.nextSprite = sprite;
      };

      this.leave = function (sprite) {
        var ref = this;
        while (ref && (ref.nextSprite != sprite)) {
          ref = ref.nextSprite;
        }
        if (ref) {
          ref.nextSprite = sprite.nextSprite;
          sprite.nextSprite = null;
        }
      };

      this.eachSprite = function(sprite, callback) {
        var ref = this;
        while (ref.nextSprite) {
          ref = ref.nextSprite;
          callback.call(sprite, ref);
        }
      };

      this.isEmpty = function (collidables) {
        var empty = true;
        var ref = this;
        while (ref.nextSprite) {
          ref = ref.nextSprite;
          empty = !ref.visible || collidables.indexOf(ref.name) == -1
          if (!empty) break;
        }
        return empty;
      };
    };

    var Game = {
      score: 0,
      totalAsteroids: 5,
      lives: 0,

      canvasWidth: 1000,
      canvasHeight: 600,

      sprites: [],
      ship: null,
      bigAlien: null,

      nextBigAlienTime: null,

      spawnAsteroids: function (count) {
        if (!count) count = this.totalAsteroids;
        for (var i = 0; i < count; i++) {
          var roid = new Asteroid();
          roid.x = randomService.random(3) * this.canvasWidth;
          roid.y = randomService.random(3) * this.canvasHeight;
          while (!roid.isClear()) {
            roid.x = randomService.random(3) * this.canvasWidth;
            roid.y = randomService.random(3) * this.canvasHeight;
          }
          roid.vel.x = randomService.random(3) * 4 - 2;
          roid.vel.y = randomService.random(3) * 4 - 2;
          if (randomService.random(3) > 0.5) {
            roid.points.reverse();
          }
          roid.vel.rot = randomService.random(3) * 2 - 1;
          Game.sprites.push(roid);
        }
      },

      explosionAt: function (x, y) {
        var splosion = new Explosion();
        splosion.x = x;
        splosion.y = y;
        splosion.visible = true;
        Game.sprites.push(splosion);
      },

      FSM: {
        boot: function () {
          Game.spawnAsteroids(5);
          this.state = 'waiting';
        },
        waiting: function () {
          Text.renderText(window.ipad ? 'Touch Screen to Start' : 'Press Space to Start', 36, Game.canvasWidth/2 - 270, Game.canvasHeight/2);
          if (KEY_STATUS.space || window.gameStart) {
            KEY_STATUS.space = false; // hack so we don't shoot right away
            window.gameStart = false;
            this.state = 'start';
          }
        },
        start: function () {
          for (var i = 0; i < Game.sprites.length; i++) {
            if (Game.sprites[i].name == 'asteroid') {
              Game.sprites[i].die();
            } else if (Game.sprites[i].name == 'bullet' ||
                       Game.sprites[i].name == 'bigalien') {
              Game.sprites[i].visible = false;
            }
          }

          Game.score = 0;
          Game.lives = 2;
          Game.totalAsteroids = 2;
          Game.spawnAsteroids();

          Game.nextBigAlienTime = Date.now() + 30000 + (30000 * randomService.random(3));

          this.state = 'spawn_ship';
        },
        spawn_ship: function () {
          Game.ship.x = Game.canvasWidth / 2;
          Game.ship.y = Game.canvasHeight / 2;
          if (Game.ship.isClear()) {
            Game.ship.rot = 0;
            Game.ship.vel.x = 0;
            Game.ship.vel.y = 0;
            Game.ship.visible = true;
            this.state = 'run';
          }
        },
        run: function () {
          for (var i = 0; i < Game.sprites.length; i++) {
            if (Game.sprites[i].name == 'asteroid') {
              break;
            }
          }
          if (i == Game.sprites.length) {
            this.state = 'new_level';
          }
          if (!Game.bigAlien.visible &&
              Date.now() > Game.nextBigAlienTime) {
            Game.bigAlien.visible = true;
            Game.nextBigAlienTime = Date.now() + (30000 * randomService.random(3));
          }
        },
        new_level: function () {
          if (this.timer == null) {
            this.timer = Date.now();
          }
          // wait a second before spawning more asteroids
          if (Date.now() - this.timer > 1000) {
            this.timer = null;
            Game.totalAsteroids++;
            if (Game.totalAsteroids > 12) Game.totalAsteroids = 12;
            Game.spawnAsteroids();
            this.state = 'run';
          }
        },
        player_died: function () {
          if (Game.lives < 0) {
            this.state = 'end_game';
          } else {
            if (this.timer == null) {
              this.timer = Date.now();
            }
            // wait a second before spawning
            if (Date.now() - this.timer > 1000) {
              this.timer = null;
              this.state = 'spawn_ship';
            }
          }
        },
        end_game: function () {
          Text.renderText('GAME OVER', 50, Game.canvasWidth/2 - 160, Game.canvasHeight/2 + 10);
          if (this.timer == null) {
            this.timer = Date.now();
          }
          // wait 5 seconds then go back to waiting state
          if (Date.now() - this.timer > 5000) {
            this.timer = null;
            this.state = 'waiting';
          }

          window.gameStart = false;
        },

        execute: function () {
          this[this.state]();
        },
        state: 'boot'
      }

    };

    canvasWidth = Game.canvasWidth  = canvas.width;
    canvasHeight = Game.canvasHeight = canvas.height;

    var context = canvas.getContext("2d");

    Text.face = vector_battle;

    var gridWidth = Math.round(Game.canvasWidth / GRID_SIZE);
    var gridHeight = Math.round(Game.canvasHeight / GRID_SIZE);

    var grid = new Array(gridWidth);
    for (var i = 0; i < gridWidth; i++) {
      grid[i] = new Array(gridHeight);
      for (var j = 0; j < gridHeight; j++) {
        grid[i][j] = new GridNode();
      }
    }

    // set up the positional references
    for (var i = 0; i < gridWidth; i++) {
      for (var j = 0; j < gridHeight; j++) {
        var node   = grid[i][j];
        node.north = grid[i][(j == 0) ? gridHeight-1 : j-1];
        node.south = grid[i][(j == gridHeight-1) ? 0 : j+1];
        node.west  = grid[(i == 0) ? gridWidth-1 : i-1][j];
        node.east  = grid[(i == gridWidth-1) ? 0 : i+1][j];
      }
    }

    // set up borders
    for (var i = 0; i < gridWidth; i++) {
      grid[i][0].dupe.vertical            =  Game.canvasHeight;
      grid[i][gridHeight-1].dupe.vertical = -Game.canvasHeight;
    }

    for (var j = 0; j < gridHeight; j++) {
      grid[0][j].dupe.horizontal           =  Game.canvasWidth;
      grid[gridWidth-1][j].dupe.horizontal = -Game.canvasWidth;
    }

    Sprite.prototype.matrix  = new Matrix(2, 3);

    var yourPlayerIndex,
        playersInfo,
        matchController;

    function startGame(params) {
      yourPlayerIndex = params.yourPlayerIndex;
      playersInfo = params.playersInfo;
      matchController = params.matchController;

      var sprites = [];
      Game.sprites = sprites;

      var ship = new Ship();
      ship.x = Game.canvasWidth / 2;
      ship.y = Game.canvasHeight / 2;
      ship.game = Game;
      sprites.push(ship);

      ship.bullets = [];
      for (var i = 0; i < 10; i++) {
        var bull = new Bullet();
        bull.game = Game;
        ship.bullets.push(bull);
        sprites.push(bull);
      }
      Game.ship = ship;

      var bigAlien = new BigAlien();
      bigAlien.setup();
      bigAlien.game = Game;
      sprites.push(bigAlien);
      Game.bigAlien = bigAlien;

      var extraDude = new Ship();
      extraDude.scale = 0.6;
      extraDude.visible = true;
      extraDude.preMove = null;
      extraDude.children = [];

      var paused = false;
      var showFramerate = false;
      var avgFramerate = 0;
      var frameCount = 0;
      var elapsedCounter = 0;

      var lastFrame = Date.now();
      var thisFrame = undefined;
      var elapsed = undefined;
      var delta = undefined;

      var i, j = 0;

      var mainLoop = function () {
        Text.context = context;
        Sprite.prototype.context = context;
        Sprite.prototype.grid    = grid;

        context.clearRect(0, 0, Game.canvasWidth, Game.canvasHeight);
        Game.FSM.execute();

        if (KEY_STATUS.g) {
          context.beginPath();
          for (var i = 0; i < gridWidth; i++) {
            context.moveTo(i * GRID_SIZE, 0);
            context.lineTo(i * GRID_SIZE, Game.canvasHeight);
          }
          for (var j = 0; j < gridHeight; j++) {
            context.moveTo(0, j * GRID_SIZE);
            context.lineTo(Game.canvasWidth, j * GRID_SIZE);
          }
          context.closePath();
          context.stroke();
        }

        thisFrame = Date.now();
        elapsed = thisFrame - lastFrame;
        lastFrame = thisFrame;
        delta = elapsed / 30;

        for (i = 0; i < sprites.length; i++) {

          sprites[i].run(delta);

          if (sprites[i].reap) {
            sprites[i].reap = false;
            sprites.splice(i, 1);
            i--;
          }
        }

        // score
        var score_text = ''+Game.score;
        Text.renderText(score_text, 18, Game.canvasWidth - 14 * score_text.length, 20);

        // extra dudes
        for (i = 0; i < Game.lives; i++) {
          context.save();
          extraDude.x = Game.canvasWidth - (8 * (i + 1));
          extraDude.y = 32;
          extraDude.configureTransform();
          extraDude.draw();
          context.restore();
        }

        if (showFramerate) {
          Text.renderText(''+avgFramerate, 24, Game.canvasWidth - 38, Game.canvasHeight - 2);
        }

        frameCount++;
        elapsedCounter += elapsed;
        if (elapsedCounter > 1000) {
          elapsedCounter -= 1000;
          avgFramerate = frameCount;
          frameCount = 0;
        }

        if (paused) {
          Text.renderText('PAUSED', 72, Game.canvasWidth/2 - 160, 120);
        } else {
          requestAnimFrame(mainLoop, canvas);
        }
      };
      mainLoop();
    }

    function handleMessage(params) {

    }

    function stopGame(endMatchScores) {

    }


    $(window).keydown(function (e) {
      switch (KEY_CODES[e.keyCode]) {
        case 'f': // show framerate
          showFramerate = !showFramerate;
          break;
        case 'p': // pause
          paused = !paused;
          if (!paused) {
            // start up again
            lastFrame = Date.now();
            mainLoop();
          }
          break;
        case 'm': // mute
          SFX.muted = !SFX.muted;
          break;
      }
    });


    return {
      gotStartMatch: startGame,
      gotMessage: handleMessage,
      gotEndMatch: stopGame
    };
  }

  realTimeService.init({
    createCanvasController: createCanvasController,
    canvasWidth: 1600,
    canvasHeight: 600
  });


}]);