class Map {
    constructor() {}
}

const CONSTANTS = {
    tankWidth: 20,
    tankHeight: 20,
    gridScaling: 20,
    bulletRadius: 5,
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

        this.mapInitialised = false;
        this.tanksInitialised = false;

        this.initPlayback();
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

        this.destructables = Array.from(
            Array(this.rows),
            () => new Array(this.cols)
        );

        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                const floor = new PIXI.Sprite(floorMap[this.map[i][j]]);
                floor.width = this.tileWidth;
                floor.height = this.tileHeight;
                floor.anchor.set(0, 0);
                floor.x = j * this.tileWidth;
                floor.y = i * this.tileHeight;
                this.ground_layer.addChild(floor);

                if (this.map[i][j] in additionalMap) {
                    const obstacle = new PIXI.Sprite(
                        additionalMap[this.map[i][j]]
                    );
                    obstacle.width = this.tileWidth;
                    obstacle.height = this.tileHeight;
                    obstacle.anchor.set(0, 0);
                    obstacle.x = j * this.tileWidth;
                    obstacle.y = i * this.tileHeight;
                    this.ground_layer.addChild(obstacle);

                    this.destructables[i][j] = obstacle;
                }
            }
        }

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

    destroyWall(event) {
        let position = event.data.position;
        // convert continuous to grid space coords
        let {x, y} = this.toGridCoords(position[0], position[1]);

        if (this.destructables[y][x] !== undefined) {
            console.log("destroying wall at", {x, y}, event);
            this.ground_layer.removeChild(this.destructables[y][x]);
        } else {
            console.log("cannot destroy null wall", event);
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
        let elapsed = 0.0;
        let iteration = 0;

        this.app.ticker.add((delta) => {


            // Initialise stuff if needed
            if (!this.mapInitialised) {
                if (this.gameInfo.mapInfo !== null) {
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
            
            const currentIndex = elapsed / 2;
            const prevIndex = Math.floor(currentIndex);
            const newIndex = Math.ceil(currentIndex);
            
            if (this.gameInfo.getTimestepData(newIndex) === null) {
                // Stop Updating
                return;
            }
            
            elapsed += delta;
            iteration += 1;

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


                // boundaries
                let boundaries = Object.entries(
                    this.gameInfo.getTimestepData(newIndex).updated_objects
                ).filter(([k, _]) => k.indexOf("closing_boundary") != -1);
                if (boundaries.length === 1) {
                    let b = boundaries[0];
                    let vertices = b[1].position;
                    this.updateClosingBoundary(vertices);
                }


                // events
                // this.gameInfo.getTimestepData(newIndex).events.forEach((e) => {

                //     if (e.event_type == "BULLET_DESTROYED") {
                //         this.destroyBullet(e.data.id);
                //     } else if (e.event_type == "WALL_DESTROYED") {
                //         this.destroyWall(e);
                //     }


                // })


            }
        });
    }
}
