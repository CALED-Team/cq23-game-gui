const POLL_FREQUENCY_DELAY = 200;

class GameInfo {
    constructor(baseUrl, infoDivId) {
        this.baseUrl = baseUrl;
        this.counter = 1;

        this.rawData = {};
        this.organisedData = [];
        this.objectDeletedAt = {};
        this.objectCreatedAt = {};
        this.attempts = {};

        this.finished = false;
        this.winners = [];
        this.losers = [];

        this.mapInfo = null;
        this.clientInfo = null;

        this.infoDiv = document.getElementById(infoDivId);

        this._setToPoll();

    }

    _setToPoll() {
        // console.log(this.counter);
        this.pollingIntervalId = setInterval(
            this.update.bind(this),
            POLL_FREQUENCY_DELAY
        );
        this.update();
    }

    _finishPolling() {
        clearInterval(this.pollingIntervalId);

        this.finished = true;

        console.log(this.mapInfo, this.clientInfo);
        console.log(this.organisedData);

        this._updateInfo();
    }

    _addToOrganisedData(data) {
        let lines = data.content.replace('\n"EOF"\n', "");
        lines = lines.split("\n");
        lines = lines.map((l) => l.trim());
        lines = lines.filter((l) => l != "");
        lines = lines.map((l) => l.replaceAll("Infinity", '"Infinity"'));
        lines = lines.map(JSON.parse);

        lines.forEach((line) => {
            if ("victor" in line || "vanquished" in line) {
                if ("victor" in line) {
                    this.winners = line.victor;
                }
                if ("vanquished" in line) {
                    this.losers = line.vanquished;
                }
                this._finishPolling();
            } else if ("map" in line) {
                this.mapInfo = line.map;
            } else if ("client_info" in line) {
                this.clientInfo = line.client_info;
            } else {
                if (
                    this.organisedData.length == 0 &&
                    Object.keys(line.updated_objects).length === 0
                ) {
                    return;
                }

                if (this.organisedData.length > 0) {
                    // include the info that has not changed from the previous timestep
                    Object.entries(this.organisedData[this.organisedData.length - 1].updated_objects).forEach(([key, val]) => {
                        if (key in line.updated_objects) {
                            return;
                        } else if (key in this.objectDeletedAt) {
                            return;
                        } else {
                            line.updated_objects[key] = val;
                        }
                    })
                }

                this.organisedData.push(line);


                Object.entries(line.updated_objects).forEach(([key, val]) => {
                    if (!(key in this.objectCreatedAt)) {
                        this.objectCreatedAt[key] = this.organisedData.length;
                    }
                })
                
                if ("deleted_objects" in line) {
                    line.deleted_objects.forEach((key) => {
                        this.objectDeletedAt[key] = this.organisedData.length;
                    })
                }
            }
        });
    }

    _updateInfo() {
        if (this.finished) {
            this.infoDiv.innerHTML = `<span style="color: green">Done</span>, total replay files collected: ${Object.keys(this.rawData).length}`;
        } else {
            this.infoDiv.innerHTML = `Collecting replay file: ${this.counter}, <span style="color: grey">number of attempts: ${(this.counter in this.attempts ? this.attempts[this.counter] : 0)}</span>`;
        }
        this.infoDiv.innerHTML += `<br>Total turns collected: ${this.organisedData.length}`;
    }

    update() {
        this._updateInfo();

        let next_replay_url =
            this.baseUrl +
            `get_replay_file_content/?file_name=replay-${this.counter}.txt`;
        console.log("updating", this.counter, next_replay_url);

        let current_counter = this.counter;
        if (current_counter in this.attempts) {
            this.attempts[current_counter] += 1;
        } else {
            this.attempts[current_counter] = 0;
        }
        fetch(next_replay_url)
            .then((response) => {
                if (!response.ok) {
                    return Promise.reject(response);
                }
                return response.json();
            })
            .then((data) => {
                console.log("Success", current_counter);

                if (!data.content.includes('\n"EOF"\n')) {
                    return;
                }

                if (!(current_counter in this.rawData)) {
                    this._addToOrganisedData(data);
                }
                this.rawData[current_counter] = data.content;
                this.counter = current_counter + 1;
            })
            .catch((error) => {
                if (typeof error.json === "function") {
                    error
                        .json()
                        .then((jsonError) => {
                            console.log("Json error from API");
                            console.log(jsonError);
                        })
                        .catch((genericError) => {
                            console.log("Generic error from API");
                            console.log(error.statusText);
                        });
                } else {
                    console.log("Fetch error", error);
                    console.log(error);
                }
            });
    }

    getTimestepData(index) {
        if (index >= 0 && index < this.organisedData.length) {
            return this.organisedData[index];
        } else {
            return null;
        }
    }
}

const searchParams = new URLSearchParams(window.location.search);

let baseUrl = "";

if (!searchParams.has("base_url")) {
    alert("URL requires the 'base_url' parameter");
} else {
    baseUrl = searchParams.get("base_url");
    let gameInfo = new GameInfo(baseUrl, "gui-debug-info");
    let game = new Game("gui", gameInfo, { height: 700, width: 1100 });
}
