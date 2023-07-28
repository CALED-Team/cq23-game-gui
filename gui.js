const CONSTANTS = {
    tankWidth: 20,
    tankHeight: 20,
    gridScaling: 20,
    bulletRadius: 5,
    powerupRadius: 15,
    tankBarrelWidth: 7,
    tankBarrelHeight: 20,
    pathIndicatorRadius: 5
};

const TIME_FACTOR = 2;

class CustomPIXIContainer extends PIXI.Container {
    _anchorX = 0;
    _anchorY = 0;

    set anchorX(value) {
        this._anchorX = value;
        this.pivot.x = (value * this.width) / this.scale.x;
    }

    get anchorX() {
        return this._anchorX;
    }

    set anchorY(value) {
        this._anchorY = value;
        this.pivot.y = (value * this.height) / this.scale.y;
    }

    get anchorY() {
        return this._anchorY;
    }
}

function get_angle(dx, dy) {
    if (dx == 0) {
        if (dy > 0) {
            return 90;
        } else {
            return 270;
        }
    }

    var theta = Math.atan2(dy, dx); // range (-PI, PI]
    theta *= 180 / Math.PI; // rads to degs, range (-180, 180]
    if (theta < 0) theta = 360 + theta; // range [0, 360)
    return theta;
}

COLOURS = ["Blue", "Red", "Green", "Beige"];

const floorMap = {
    ".": PIXI.Texture.from("PNG/Environment/dirt.png"),
    S: PIXI.Texture.from("PNG/Environment/sand.png"),
    D: PIXI.Texture.from("PNG/Environment/dirt.png"),
    X: PIXI.Texture.from("PNG/Environment/dirt.png"),
    P: PIXI.Texture.from("PNG/Environment/sand.png"),
};

const additionalMap = {
    D: PIXI.Texture.from("PNG/Obstacles/barrelGrey_up.png"),
    X: PIXI.Texture.from("PNG/Obstacles/sandbagBeige.png"),
};

const bulletTextures = {
    // Blue: PIXI.Texture.from("PNG/Bullets/bulletBlueSilver_outline.png"),
    Blue: PIXI.Texture.from("PNG/Homemade/bullet.png"),
    Green: PIXI.Texture.from("PNG/Bullets/bulletGreenSilver_outline.png"),
    Red: PIXI.Texture.from("PNG/Bullets/bulletRedSilver_outline.png"),
    Beige: PIXI.Texture.from("PNG/Bullets/bulletBlueSilver_outline.png"),
};

const powerupTextures = {
    HEALTH: PIXI.Texture.from("PNG/Tmp/health.png"),
    DAMAGE: PIXI.Texture.from("PNG/Tmp/damage.png"),
    SPEED: PIXI.Texture.from("PNG/Tmp/speed.png"),
};

const pathIndicatorTextures = {
    Red: PIXI.Texture.from("PNG/Obstacles/barrelRed_up.png"),
}

class Game {
    constructor(divId, gameInfo, dimensions) {
        this.main_div = document.getElementById(divId);
        this.gameInfo = gameInfo;

        this.width = dimensions.width;
        this.height = dimensions.height;

        // console.assert(jsonData.length >= 3);
        // this.mapData = jsonData[0];
        // this.clientData = jsonData[1];
        // this.gameData = jsonData.slice(2, jsonData.length - 1);
        // this.outcomeData = jsonData[jsonData.length - 1];

        this.app = new PIXI.Application(dimensions);
        this.main_div.appendChild(this.app.view);
        this.outer_controls_div = document.createElement("div");
        this.outer_controls_div.classList.add("controls");
        this.main_div.appendChild(this.outer_controls_div);

        this.playing = true;

        this.tick = 0;
        this.elapsed = 0;
        this.need_to_update_graphics = false;

        this.mapInitialised = false;
        this.tanksInitialised = false;
        this.teamStatusInitialised = false;

        this.pathIndicators = [];

        this.initControls();
        this.initStatus();
        this.initTeamStatus();
        this.initPlayback();
    }

    togglePlayPause() {
        this.playing = this.playing ? false : true;
    }

    forward() {
        this.playing = false;
        this.tick += 1;
        this.elapsed += TIME_FACTOR;
        this.updateStatus();
        this.updateTeamStatus();
        this.need_to_update_graphics = true;
    }

    backward() {
        this.playing = false;
        if (this.tick > 0) {
            this.tick -= 1;
            this.elapsed -= TIME_FACTOR;
        }
        this.updateStatus();
        this.updateTeamStatus();
        this.need_to_update_graphics = true;
    }

    reset() {
        this.elapsed = 0;
        this.tick = 0;
        if (this.mapInitialised) {
            this.app.stage.removeChild(this.ground_layer);
            this.ground_layer.destroy();
            this.ground_layer = null;
            this.app.stage.removeChild(this.boundary_layer);
            this.boundary_layer.destroy();
            this.boundary_layer = null;
            this.mapInitialised = false;
        }
        if (this.tanksInitialised) {
            this.app.stage.removeChild(this.moving_layer);
            this.moving_layer.destroy();
            this.moving_layer = null;
            this.tanksInitialised = false;
        }
        this.updateStatus();
        this.updateTeamStatus();
    }

    initControls() {
        this.controlsDiv = document.createElement("div");
        this.controlsDiv.classList.add("controls");
        this.outer_controls_div.appendChild(this.controlsDiv);

        let backwardButton = document.createElement("button");
        backwardButton.innerText = "Backward";
        backwardButton.addEventListener("click", this.backward.bind(this));
        this.controlsDiv.appendChild(backwardButton);

        let playPauseButton = document.createElement("button");
        playPauseButton.innerText = "Play/Pause";
        playPauseButton.addEventListener(
            "click",
            this.togglePlayPause.bind(this)
        );
        this.controlsDiv.appendChild(playPauseButton);

        let resetButton = document.createElement("button");
        resetButton.innerText = "Reset";
        resetButton.addEventListener("click", this.reset.bind(this));
        this.controlsDiv.appendChild(resetButton);

        let forwardButton = document.createElement("button");
        forwardButton.innerText = "Forward";
        forwardButton.addEventListener("click", this.forward.bind(this));
        this.controlsDiv.appendChild(forwardButton);
    }

    initStatus() {
        this.statusDiv = document.createElement("div");
        this.statusDiv.classList.add("status");
        this.outer_controls_div.appendChild(this.statusDiv);
        this.updateStatus();
    }

    updateStatus() {
        if (this.gameInfo.finished) {
            let _max = this.gameInfo.organisedData.length;
            this.statusDiv.innerHTML = `<label for=\"file\">Tick: ${this.tick}/${_max} </label><progress id=\"file\" value=\"${this.tick}\" max=\"${_max}\">${this.tick}</progress>`;
        } else {
            this.statusDiv.innerHTML = `<label for=\"file\">Tick: ${
                this.tick
            }/${1000} </label><progress id=\"file\" value=\"${
                this.tick
            }\" max=\"1000\">${this.tick}</progress>`;
        }
    }

    initTeamStatus() {
        this.teamStatusDiv = document.createElement("div");
        this.teamStatusDiv.classList.add("teams");
        this.main_div.appendChild(this.teamStatusDiv);

        this.teamOneStatusDiv = document.createElement("div");
        this.teamTwoStatusDiv = document.createElement("div");
        this.teamStatusDiv.appendChild(this.teamOneStatusDiv);
        this.teamStatusDiv.appendChild(this.teamTwoStatusDiv);

        this.updateTeamStatus();
    }

    updateTeamStatus() {
        // client info
        if (this.gameInfo.clientInfo == null) {
            return;
        }

        // initial setup
        if (!this.teamStatusInitialised) {
            if (this.gameInfo.clientInfo[0].id < this.gameInfo.clientInfo[1].id) {
                this.teamOneId = this.gameInfo.clientInfo[0].id;
                this.teamTwoId = this.gameInfo.clientInfo[1].id;
            } else {
                this.teamOneId = this.gameInfo.clientInfo[1].id;
                this.teamTwoId = this.gameInfo.clientInfo[0].id;
            }
            this.teamIdToIndex = {}
            this.teamIdToIndex[this.teamOneId] = 0;
            this.teamIdToIndex[this.teamTwoId] = 1;

            this.teamOneStatusDiv.innerHTML += `<div><img src="PNG/Tanks/tank${COLOURS[0]}_outline.png"/><span>Team 1</span><span>${this.gameInfo.clientInfo[0].name}</span></div>`;
            this.teamTwoStatusDiv.innerHTML += `<div><img src="PNG/Tanks/tank${COLOURS[1]}_outline.png"/><span>Team 2</span><span>${this.gameInfo.clientInfo[1].name}</span></div>`;

            this.teamOneInnerStatusDiv = document.createElement("div");
            this.teamTwoInnerStatusDiv = document.createElement("div");
            this.teamOneStatusDiv.appendChild(this.teamOneInnerStatusDiv);
            this.teamTwoStatusDiv.appendChild(this.teamTwoInnerStatusDiv);


            this.teamStatusInitialised = true;
        }

        this.teamOneInnerStatusDiv.innerHTML = "";
        this.teamTwoInnerStatusDiv.innerHTML = "";
        // colour of tank

        // game progress info
        let current_data = this.gameInfo.getTimestepData(this.tick);
        if (current_data == null) {
            if (this.gameInfo.finished) {
                // display result info
                this.gameInfo.winners.forEach((key) => {
                    if (key == this.teamOneId) {
                        this.teamOneStatusDiv.classList.add("winner");
                    }
                    if (key == this.teamTwoId) {
                        this.teamTwoStatusDiv.classList.add("winner");
                    }
                });

                this.gameInfo.losers.forEach((key) => {
                    if (key == this.teamOneId) {
                        this.teamOneStatusDiv.classList.add("loser");
                    }
                    if (key == this.teamTwoId) {
                        this.teamTwoStatusDiv.classList.add("loser");
                    }
                });
            }

            return;
        }

        let tank1 = current_data.updated_objects[`tank-${this.teamOneId}`];
        this.teamOneInnerStatusDiv.innerHTML += `<span>hp: ${tank1.hp}</span><br>`;
        this.teamOneInnerStatusDiv.innerHTML += `<span>powerups: ${tank1.powerups}</span><br>`;

        let tank2 = current_data.updated_objects[`tank-${this.teamTwoId}`];
        this.teamTwoInnerStatusDiv.innerHTML += `<span>hp: ${tank2.hp}</span><br>`;
        this.teamTwoInnerStatusDiv.innerHTML += `<span>powerups: ${tank2.powerups}</span><br>`;
    }

    initMap() {
        this.mapInitialised = true;
        this.ground_layer = new PIXI.Container();
        this.app.stage.addChild(this.ground_layer);

        // find map info
        let dimensions = this.gameInfo.mapInfo[0].split(" ");
        this.cols = Number(dimensions[0]);
        this.rows = Number(dimensions[1]);

        this.continuousWidth = this.cols * CONSTANTS.gridScaling;
        this.continuousHeight = this.rows * CONSTANTS.gridScaling;

        this.tileWidth = this.width / this.cols;
        this.tileHeight = this.height / this.rows;

        this.unitWidth = this.tileWidth / CONSTANTS.gridScaling;
        this.unitHeight = this.tileHeight / CONSTANTS.gridScaling;

        let gridMap = this.gameInfo.mapInfo.slice(1);
        gridMap = gridMap.map((l) => l.replace("\n", ""));
        this.map = gridMap;

        this.walls = {};

        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                const floor = new PIXI.Sprite(floorMap[this.map[i][j]]);
                floor.width = this.tileWidth;
                floor.height = this.tileHeight;
                floor.anchor.set(0, 0);
                floor.x = j * this.tileWidth;
                floor.y = i * this.tileHeight;
                this.ground_layer.addChild(floor);
            }
        }

        Object.entries(this.gameInfo.getTimestepData(0).updated_objects)
            .filter(([key, _]) => key.indexOf("wall") !== -1)
            .forEach(([key, obj]) => {
                const obstacle = new PIXI.Sprite(
                    obj.type === 4
                        ? PIXI.Texture.from("PNG/Obstacles/barrelGrey_up.png")
                        : PIXI.Texture.from("PNG/Obstacles/sandbagBeige.png")
                );
                obstacle.width = this.tileWidth;
                obstacle.height = this.tileHeight;
                obstacle.anchor.set(0.5, 0.5);

                let [x, y] = obj.position;
                let new_pos = this.continuousToCanvasCoords(x, y);

                obstacle.x = new_pos.x;
                obstacle.y = new_pos.y;
                this.ground_layer.addChild(obstacle);

                this.walls[key] = obstacle;
            });

        // create the closing boundary
        this.boundary_layer = new PIXI.Container();
        this.app.stage.addChild(this.boundary_layer);

        this.closing_boundary = {};

        // top boundary
        let top = new PIXI.Sprite(PIXI.Texture.from(`PNG/Homemade/storm.png`));
        top.height = 0;
        top.width = this.width;
        top.x = 0;
        top.y = 0;
        this.boundary_layer.addChild(top);
        this.closing_boundary.top = top;

        // bottom boundary
        let bottom = new PIXI.Sprite(
            PIXI.Texture.from(`PNG/Homemade/storm.png`)
        );
        bottom.height = 0;
        bottom.width = this.width;
        bottom.x = 0;
        bottom.y = this.height - 0;
        this.boundary_layer.addChild(bottom);
        this.closing_boundary.bottom = bottom;

        // left boundary
        let left = new PIXI.Sprite(PIXI.Texture.from(`PNG/Homemade/storm.png`));
        left.height = this.height;
        left.width = 0;
        left.x = 0;
        left.y = 0;
        this.boundary_layer.addChild(left);
        this.closing_boundary.left = left;

        // right boundary
        let right = new PIXI.Sprite(
            PIXI.Texture.from(`PNG/Homemade/storm.png`)
        );
        right.height = this.height;
        right.width = 0;
        right.x = this.width - 0;
        right.y = 0;
        this.boundary_layer.addChild(right);
        this.closing_boundary.right = right;
    }

    initTanks() {
        this.tanksInitialised = true;
        this.tanks = {};
        this.bullets = {};
        this.powerups = {};

        this.moving_layer = new PIXI.Container();
        this.app.stage.addChild(this.moving_layer);

        let first_timestep_data = this.gameInfo.getTimestepData(0);

        Object.entries(first_timestep_data.updated_objects).forEach(
            ([key, objData]) => {
                if (key.indexOf("tank") == -1) {
                    return;
                }

                let tankId = parseInt(key.substring(5));
                let tankIndex = this.teamIdToIndex[tankId];
                let position = objData.position;

                const tankContainer = new CustomPIXIContainer();
                tankContainer.width = this.unitWidth * CONSTANTS.tankWidth;
                tankContainer.height = this.unitHeight * CONSTANTS.tankHeight;
                tankContainer.anchorX = 0.5;
                tankContainer.anchorY = 0.5;
                tankContainer.x = position[0];
                tankContainer.y = position[1];

                const tankBase = new PIXI.Sprite(
                    PIXI.Texture.from(
                        `PNG/Tanks/tank${COLOURS[tankIndex]}_outline.png`
                    )
                );
                tankBase.width = this.unitWidth * CONSTANTS.tankWidth;
                tankBase.height = this.unitHeight * CONSTANTS.tankHeight;
                tankBase.anchor.set(0.5, 0.5);
                tankBase.x = tankContainer.width / 2;
                tankBase.y = tankContainer.height / 2;

                const tankBarrel = new PIXI.Sprite(
                    PIXI.Texture.from(
                        `PNG/Tanks/barrel${COLOURS[tankIndex]}_outline.png`
                    )
                );
                tankBarrel.width = this.unitWidth * CONSTANTS.tankBarrelWidth;
                tankBarrel.height =
                    this.unitHeight * CONSTANTS.tankBarrelHeight;
                tankBarrel.anchor.set(0.5, 0.2);
                tankBarrel.x = tankContainer.width / 2;
                tankBarrel.y = tankContainer.height / 2;

                tankContainer.addChild(tankBase);
                tankContainer.addChild(tankBarrel);

                this.tanks[key] = {
                    stable_x: position[0],
                    stable_y: position[1],
                    container: tankContainer,
                    base: tankBase,
                    barrel: tankBarrel,
                    color: COLOURS[tankIndex],
                };
                this.moving_layer.addChild(tankContainer);
            }
        );
    }

    continuousToCanvasCoords(x, y) {
        return {
            x: (x / this.continuousWidth) * this.width,
            y: this.height - (y / this.continuousHeight) * this.height,
        };
    }

    toGridCoords(x, y) {
        return {
            x: Math.floor(x / CONSTANTS.gridScaling),
            y: this.rows - Math.ceil(y / CONSTANTS.gridScaling) - 1,
        };
    }

    spawnBullet(key, obj) {
        let bullet = new PIXI.Sprite(bulletTextures.Blue);
        bullet.anchor.set(0.5, 0.5);
        bullet.height = CONSTANTS.bulletRadius * this.unitHeight * 2;
        bullet.width = CONSTANTS.bulletRadius * this.unitWidth * 2;
        let [x, y] = obj.position;
        let { x2, y2 } = this.continuousToCanvasCoords(x, y);
        bullet.x = x2;
        bullet.y = y2;
        this.moving_layer.addChild(bullet);
        this.bullets[key] = bullet;

        // update the tank barrel position
        let tank_id = obj.tank_id;
        if (!(tank_id in this.tanks)) {
            return;
        }

        let [vx, vy] = obj.velocity;

        let angle = get_angle(vx, vy);

        this.tanks[tank_id].barrel.angle = (630 - angle) % 360;

        return bullet;
    }

    updatePathIndicators(pathIndicators) {
        if (pathIndicators.length != this.pathIndicators.length ||
            !pathIndicators.reduce((acc, e, i) => acc && e === this.pathIndicators[i], true)) {
            // remove old path indicators
            this.pathIndicators.forEach(point => {
                this.moving_layer.removeChild(point);
                point.destroy();
            });

            // add new path indicators
            this.pathIndicators = [];
            pathIndicators.forEach(([x, y]) => {
                let sprite = new PIXI.Sprite(pathIndicatorTextures.Red);
                sprite.anchor.set(0.5, 0.5);
                sprite.height = CONSTANTS.pathIndicatorRadius * this.unitHeight * 2;
                sprite.width = CONSTANTS.pathIndicatorRadius * this.unitWidth * 2;
                let coord = this.continuousToCanvasCoords(x, y);
                console.log(x, y)
                sprite.x = coord.x;
                sprite.y = coord.y;
                this.moving_layer.addChild(sprite);
                this.pathIndicators.push(sprite);
            });
        }
    }

    destroyBullet(key) {
        if (!this.bullets.hasOwnProperty(key)) {
            return;
        }
        this.moving_layer.removeChild(this.bullets[key]);
        this.bullets[key].destroy();
        delete this.bullets[key];
    }

    spawnPowerup(key, obj) {
        let powerup = new PIXI.Sprite(powerupTextures[obj.powerup_type]);
        powerup.anchor.set(0.5, 0.5);
        powerup.height = CONSTANTS.powerupRadius * this.unitHeight * 2;
        powerup.width = CONSTANTS.powerupRadius * this.unitWidth * 2;
        let [x, y] = obj.position;
        let { x2, y2 } = this.continuousToCanvasCoords(x, y);
        powerup.x = x2;
        powerup.y = y2;
        this.moving_layer.addChild(powerup);
        this.powerups[key] = powerup;
        return powerup;
    }

    destroyPowerup(key) {
        if (!this.powerups.hasOwnProperty(key)) {
            return;
        }
        this.moving_layer.removeChild(this.powerups[key]);
        this.powerups[key].destroy();
        delete this.powerups[key];
    }

    destroyWall(wallId) {
        if (wallId in this.walls) {
            this.walls[wallId].destroy();
            this.ground_layer.removeChild(this.walls[wallId]);
            delete this.walls[wallId];
        }
    }

    updateClosingBoundary(vertices) {
        let { x: x1, y: y1 } = this.continuousToCanvasCoords(
            vertices[0][0],
            vertices[0][1]
        );
        this.closing_boundary.top.height = y1;
        this.closing_boundary.left.width = x1;

        let { x: x2, y: y2 } = this.continuousToCanvasCoords(
            vertices[2][0],
            vertices[2][1]
        );
        this.closing_boundary.bottom.height = this.height - y2;
        this.closing_boundary.bottom.y = y2;
        this.closing_boundary.right.width = this.width - x2;
        this.closing_boundary.right.x = x2;
    }

    initPlayback() {
        this.app.ticker.add((delta) => {
            // console.log(this.tick, this.elapsed);

            // Initialise stuff if needed
            if (!this.mapInitialised) {
                let first_timestep_data = this.gameInfo.getTimestepData(0);
                if (
                    this.gameInfo.mapInfo !== null &&
                    first_timestep_data !== null
                ) {
                    this.initMap();
                }
                return;
            }

            // TODO: initialise client info
            if (!this.teamStatusInitialised) {
                this.updateTeamStatus();
            }

            if (!this.tanksInitialised) {
                let first_timestep_data = this.gameInfo.getTimestepData(0);
                if (first_timestep_data !== null) {
                    this.initTanks();
                }
                return;
            }

            if (!this.playing && !this.need_to_update_graphics) {
                return;
            }

            const currentIndex = this.elapsed / TIME_FACTOR;
            const prevIndex = Math.floor(currentIndex);
            const newIndex = Math.ceil(currentIndex);

            this.tick = newIndex;
            this.updateStatus();
            this.updateTeamStatus();

            if (this.gameInfo.getTimestepData(newIndex) === null) {
                // Stop Updating
                return;
            }

            if (!this.need_to_update_graphics) {
                this.elapsed += delta;
                this.tick += 1;
            }

            // console.log(curPosition, newPosition);

            // if (true && (prevIndex == newIndex)) {
            //     const curSpots = this.gameInfo.getTimestepData(prevIndex)["updated_objects"];
            //     Object.keys(curSpots).forEach((key) => {
            //         if (!this.tanks.hasOwnProperty(key)) return;
            //         const position = curSpots[key]["position"];
            //         let {x, y} = this.continuousToCanvasCoords(position[0], position[1]);
            //         this.tanks[key].container.x = x;
            //         this.tanks[key].container.y = y;
            //     });
            const nextSpots =
                this.gameInfo.getTimestepData(prevIndex)["updated_objects"];
            Object.keys(nextSpots).forEach((key) => {
                if (!this.tanks.hasOwnProperty(key)) return;
                const new_pos = nextSpots[key]["position"];
                this.tanks[key].stable_x = new_pos[0];
                this.tanks[key].stable_y = new_pos[1];
                let { x, y } = this.continuousToCanvasCoords(
                    new_pos[0],
                    new_pos[1]
                );
                this.tanks[key].container.x = x;
                this.tanks[key].container.y = y;
            });

            // bullet stuff
            let bullets = Object.entries(
                this.gameInfo.getTimestepData(prevIndex).updated_objects
            ).filter(([k, _]) => k.indexOf("bullet") != -1);

            bullets.forEach(([key, objData]) => {
                if (this.bullets.hasOwnProperty(key)) {
                    // update bullet position
                    let { x, y } = this.continuousToCanvasCoords(
                        objData.position[0],
                        objData.position[1]
                    );
                    this.bullets[key].x = x;
                    this.bullets[key].y = y;
                } else {
                    // spawn bullet at position
                    this.spawnBullet(key, objData);
                }
            });

            let newPathIndicators = this.gameInfo.getTimestepData(prevIndex)["path_indicators"];
            this.updatePathIndicators(newPathIndicators);

            // powerups
            let powerups = Object.entries(
                this.gameInfo.getTimestepData(prevIndex).updated_objects
            ).filter(([k, _]) => k.indexOf("powerup") != -1);

            powerups.forEach(([key, objData]) => {
                if (this.powerups.hasOwnProperty(key)) {
                    // update bullet position
                    let { x, y } = this.continuousToCanvasCoords(
                        objData.position[0],
                        objData.position[1]
                    );
                    this.powerups[key].x = x;
                    this.powerups[key].y = y;
                } else {
                    this.spawnPowerup(key, objData);
                }
            });

            // boundaries
            let boundaries = Object.entries(
                this.gameInfo.getTimestepData(prevIndex).updated_objects
            ).filter(([k, _]) => k.indexOf("closing_boundary") != -1);
            if (boundaries.length === 1) {
                let b = boundaries[0];
                let vertices = b[1].position;
                this.updateClosingBoundary(vertices);
            }

            // deleting objects
            // for all current bullets
            Object.keys(this.bullets).forEach((key) => {
                if (
                    key in this.gameInfo.objectDeletedAt &&
                    prevIndex >= this.gameInfo.objectDeletedAt[key]
                ) {
                    this.destroyBullet(key);
                }
                if (
                    key in this.gameInfo.objectCreatedAt &&
                    prevIndex < this.gameInfo.objectCreatedAt[key]
                ) {
                    this.destroyBullet(key);
                }
            });
            // for all current powerups
            Object.keys(this.powerups).forEach((key) => {
                if (
                    key in this.gameInfo.objectDeletedAt &&
                    prevIndex >= this.gameInfo.objectDeletedAt[key]
                ) {
                    this.destroyPowerup(key);
                }
                if (
                    key in this.gameInfo.objectCreatedAt &&
                    prevIndex < this.gameInfo.objectCreatedAt[key]
                ) {
                    this.destroyPowerup(key);
                }
            });
            // for all current obstacles
            Object.keys(this.walls).forEach((key) => {
                if (
                    key in this.gameInfo.objectDeletedAt &&
                    prevIndex >= this.gameInfo.objectDeletedAt[key]
                ) {
                    this.destroyWall(key);
                }
            });

            this.need_to_update_graphics = false;
        });
    }
}
