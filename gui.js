class Map {
    constructor() {}
}

const CONSTANTS = {
    tankWidth: 20,
    tankHeight: 20,
    gridScaling: 20,
    bulletRadius: 5,
    powerupRadius: 15
};

COLOURS = ["Blue", "Green", "Red", "Beige"];

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
    SPEED: PIXI.Texture.from("PNG/Tmp/speed.png")
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

        this.playing = true;

        this.tick = 0;
        this.elapsed = 0;


        this.mapInitialised = false;
        this.tanksInitialised = false;

        this.initControls();
        this.initStatus();
        this.initPlayback();
    }

    togglePlayPause() {
        this.playing = this.playing ? false : true;
    }

    reset() {
        console.log("reset() called");
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
    }

    initControls() {
        this.controlsDiv = document.createElement("div")
        this.main_div.appendChild(this.controlsDiv);

        let playPauseButton = document.createElement("button");
        playPauseButton.innerText = "Play/Pause";
        playPauseButton.addEventListener("click", this.togglePlayPause.bind(this));
        this.controlsDiv.appendChild(playPauseButton);

        let resetButton = document.createElement("button");
        resetButton.innerText = "Reset";
        resetButton.addEventListener("click", this.reset.bind(this));
        this.controlsDiv.appendChild(resetButton);
    }

    initStatus() {
        this.statusDiv = document.createElement("div")
        this.main_div.appendChild(this.statusDiv);
        this.updateStatus();
    }

    updateStatus() {
        if (this.gameInfo.finished) {
            let _max = this.gameInfo.organisedData.length;
            this.statusDiv.innerHTML = `<label for=\"file\">Tick: ${this.tick}/${_max} </label><progress id=\"file\" value=\"${this.tick}\" max=\"${_max}\">${this.tick}</progress>`;
        } else {
            this.statusDiv.innerHTML = `<label for=\"file\">Tick: ${this.tick}/${1000} </label><progress id=\"file\" value=\"${this.tick}\" max=\"1000\">${this.tick}</progress>`;
        }
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

        Object.entries(this.gameInfo.getTimestepData(0).updated_objects).filter(([key, _]) => key.indexOf("wall") !== -1).forEach(([key, obj]) => {
            const obstacle = new PIXI.Sprite(
                obj.type === 4 ? PIXI.Texture.from("PNG/Obstacles/barrelGrey_up.png") : PIXI.Texture.from("PNG/Obstacles/sandbagBeige.png")
            );
            obstacle.width = this.tileWidth;
            obstacle.height = this.tileHeight;
            obstacle.anchor.set(0, 0);

            let [x, y] = obj.position;
            let new_pos = this.continuousToCanvasCoords(x, y);

            obstacle.x = new_pos.x;
            obstacle.y = new_pos.y - this.tileHeight;
            this.ground_layer.addChild(obstacle);

            this.walls[key] = obstacle;
        })

        // create the closing boundary
        this.boundary_layer = new PIXI.Container();
        this.app.stage.addChild(this.boundary_layer);

        this.closing_boundary = {}

        // top boundary
        let top = new PIXI.Sprite(
            PIXI.Texture.from(
                `PNG/Homemade/storm.png`
            )
        );
        top.height = 10;
        top.width = this.width;
        top.x = 0;
        top.y = 0;
        this.boundary_layer.addChild(top);
        this.closing_boundary.top = top;

        // bottom boundary
        let bottom = new PIXI.Sprite(
            PIXI.Texture.from(
                `PNG/Homemade/storm.png`
            )
        );
        bottom.height = 10;
        bottom.width = this.width;
        bottom.x = 0;
        bottom.y = this.height - 10;
        this.boundary_layer.addChild(bottom);
        this.closing_boundary.bottom = bottom;

        // top boundary
        let left = new PIXI.Sprite(
            PIXI.Texture.from(
                `PNG/Homemade/storm.png`
            )
        );
        left.height = this.height;
        left.width = 10;
        left.x = 0;
        left.y = 0;
        this.boundary_layer.addChild(left);
        this.closing_boundary.left = left;

        // top boundary
        let right = new PIXI.Sprite(
            PIXI.Texture.from(
                `PNG/Homemade/storm.png`
            )
        );
        right.height = this.height;
        right.width = 10;
        right.x = this.width - 10;
        right.y = 0;
        this.boundary_layer.addChild(right);
        this.closing_boundary.right = right;
    }

    initTanks() {
        this.tanksInitialised = true;
        let tankIndex = 0;

        this.tanks = {};
        this.bullets = {};
        this.powerups = {};

        this.moving_layer = new PIXI.Container();
        this.app.stage.addChild(this.moving_layer);

        let first_timestep_data = this.gameInfo.getTimestepData(0);
        console.log(first_timestep_data);

        Object.entries(first_timestep_data.updated_objects).forEach(
            ([key, objData]) => {
                if (key.indexOf("tank") == -1) {
                    return;
                }

                const tankContainer = new PIXI.Container();
                const tankBase = new PIXI.Sprite(
                    PIXI.Texture.from(
                        `PNG/Tanks/tank${COLOURS[tankIndex]}_outline.png`
                    )
                );
                tankBase.width = this.tileWidth;
                tankBase.height = this.tileHeight;
                const tankBarrel = new PIXI.Sprite(
                    PIXI.Texture.from(
                        `PNG/Tanks/barrel${COLOURS[tankIndex]}_outline.png`
                    )
                );
                // Set anchor to top middle of barrel
                tankBarrel.anchor.set(0.5, 0.2);
                // Move anchor to center.
                tankBarrel.x = this.tileWidth / 2;
                tankBarrel.y = this.tileHeight / 2;
                tankBarrel.width = this.tileWidth / 5;
                tankBarrel.height = this.tileHeight * 1.2;

                tankContainer.addChild(tankBase);
                tankContainer.addChild(tankBarrel);

                tankContainer.width = this.tileWidth;
                tankContainer.height = this.tileHeight;
                // tankContainer.pivot.x = this.tileWidth / 2;
                // tankContainer.pivot.y = this.tileHeight / 2;

                let position = objData.position;
                    
                // tankContainer.anchor.set(0.5, 0.5)
                tankContainer.x = position[0];
                tankContainer.y = position[1];

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
            y: this.height - (y / this.continuousHeight) * this.height
        }
    }

    toGridCoords(x, y) {
        return {
            x: Math.floor(x / CONSTANTS.gridScaling),
            y: this.rows - Math.ceil(y / CONSTANTS.gridScaling) - 1,
        }
    }

    spawnBullet(x, y, rotation, colour, key) {
        let bullet = new PIXI.Sprite(bulletTextures[colour]);
        bullet.anchor.set(0.5, 0.5);
        bullet.height = CONSTANTS.bulletRadius * this.unitHeight * 2;
        bullet.width = CONSTANTS.bulletRadius * this.unitWidth * 2;
        bullet.rotation = rotation;
        let {x2, y2} = this.continuousToCanvasCoords(x, y);
        bullet.x = x2;
        bullet.y = y2;
        this.moving_layer.addChild(bullet);
        this.bullets[key] = bullet;
        return bullet;
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
        let {x2, y2} = this.continuousToCanvasCoords(x, y);
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
        let { x: x1, y: y1 } = this.continuousToCanvasCoords(vertices[0][0], vertices[0][1]);
        this.closing_boundary.top.height = y1;
        this.closing_boundary.left.width = x1;

        let { x: x2, y: y2 } = this.continuousToCanvasCoords(vertices[2][0], vertices[2][1]);
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
                if ((this.gameInfo.mapInfo !== null) && (first_timestep_data !== null)) {
                    this.initMap();
                }
                return;
            }
            
            // TODO: initialise client info
            
            if (!this.tanksInitialised) {
                let first_timestep_data = this.gameInfo.getTimestepData(0);
                if (first_timestep_data !== null) {
                    console.log("init tanks called")
                    this.initTanks();
                }
                return;
            }
            
            if (!this.playing) {
                return;
            }

            const currentIndex = this.elapsed / 2;
            const prevIndex = Math.floor(currentIndex);
            const newIndex = Math.ceil(currentIndex);

            this.tick = newIndex;
            this.updateStatus();
            
            if (this.gameInfo.getTimestepData(newIndex) === null) {
                // Stop Updating
                return;
            }
            
            this.elapsed += delta;
            this.tick += 1;

            // console.log(curPosition, newPosition);

            if (prevIndex == newIndex) {
                const curSpots = this.gameInfo.getTimestepData(prevIndex)["updated_objects"];
                Object.keys(curSpots).forEach((key) => {
                    if (!this.tanks.hasOwnProperty(key)) return;
                    const position = curSpots[key]["position"];
                    let {x, y} = this.continuousToCanvasCoords(position[0], position[1]);
                    this.tanks[key].container.x = x;
                    this.tanks[key].container.y = y;
                });
            } else {
                const nextSpots = this.gameInfo.getTimestepData(newIndex)["updated_objects"];
                Object.keys(nextSpots).forEach((key) => {
                    if (!this.tanks.hasOwnProperty(key)) return;
                    const new_pos = nextSpots[key]["position"];
                    let {x, y} = this.continuousToCanvasCoords(new_pos[0], new_pos[1]);
                    this.tanks[key].container.x = x;
                    this.tanks[key].container.y = y;
                });

                // bullet stuff
                let bullets = Object.entries(
                    this.gameInfo.getTimestepData(newIndex).updated_objects
                ).filter(([k, _]) => k.indexOf("bullet") != -1);

                bullets.forEach(([key, objData]) => {
                    if (this.bullets.hasOwnProperty(key)) {
                        // update bullet position
                        let {x, y} = this.continuousToCanvasCoords(objData.position[0], objData.position[1]);
                        this.bullets[key].x = x;
                        this.bullets[key].y = y;
                    } else {
                        // spawn bullet at position
                        this.spawnBullet(
                            objData.position[0],
                            objData.position[1],
                            0,
                            COLOURS[0],
                            key
                        );
                    }
                });


                // powerups
                let powerups = Object.entries(
                    this.gameInfo.getTimestepData(newIndex).updated_objects
                ).filter(([k, _]) => k.indexOf("powerup") != -1);

                powerups.forEach(([key, objData]) => {
                    if (this.powerups.hasOwnProperty(key)) {
                        // update bullet position
                        let {x, y} = this.continuousToCanvasCoords(objData.position[0], objData.position[1]);
                        this.powerups[key].x = x;
                        this.powerups[key].y = y;
                    } else {
                        this.spawnPowerup(key, objData);
                    }
                });



                // boundaries
                let boundaries = Object.entries(
                    this.gameInfo.getTimestepData(newIndex).updated_objects
                ).filter(([k, _]) => k.indexOf("closing_boundary") != -1);
                if (boundaries.length === 1) {
                    let b = boundaries[0];
                    let vertices = b[1].position;
                    this.updateClosingBoundary(vertices);
                }

                // deleting objects
                // for all current bullets
                Object.keys(this.bullets).forEach((key) => {
                    if ((key in this.gameInfo.objectDeletedAt) && (newIndex >= this.gameInfo.objectDeletedAt[key])) {
                        this.destroyBullet(key);
                    }
                })
                // for all current powerups
                Object.keys(this.powerups).forEach((key) => {
                    if ((key in this.gameInfo.objectDeletedAt) && (newIndex >= this.gameInfo.objectDeletedAt[key])) {
                        this.destroyPowerup(key);
                    }
                })
                // for all current obstacles
                Object.keys(this.walls).forEach((key) => {
                    if ((key in this.gameInfo.objectDeletedAt) && (newIndex >= this.gameInfo.objectDeletedAt[key])) {
                        this.destroyWall(key);
                    }
                })
            }
        });
    }
}
