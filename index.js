const POLL_FREQUENCY_DELAY = 200;


class GameInfo {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.counter = 1;
        
        this.rawData = {};
        this.organisedData = [];
        
        this.mapInfo = null;
        this.clientInfo = null;

        this._setToPoll();
    }
    
    _setToPoll() {
        // console.log(this.counter);
        this.pollingIntervalId = setInterval(
            this.update.bind(this),
            POLL_FREQUENCY_DELAY
            );
        }
        
        _finishPolling() {
            clearInterval(this.pollingIntervalId);
            
            console.log(this.mapInfo, this.clientInfo);
            console.log(this.organisedData);
        }
        
        _addToOrganisedData(data) {
            let lines = data.content.split("\n");
            lines = lines.map((l) => l.trim());
            lines = lines.filter((l) => l != "");
            lines = lines.map((l) => l.replaceAll("Infinity", '"Infinity"'));
            lines = lines.map(JSON.parse);
            
            lines.forEach((line) => {
                if (("victor" in line) || ("vanquished" in line)) {
                this._finishPolling();
            } else if ("map" in line) {
                this.mapInfo = line.map;
            } else if ("client_info" in line) {
                this.clientInfo = line.client_info;
            } else {
                if ((this.organisedData.length == 0) && (Object.keys(line.object_info).length === 0)) {
                    return;
                }
                this.organisedData.push(line);
            }
        })
    }
    
    update() {
        if (this.counter >= 11) {
            this._finishPolling();
        }
        
        let next_replay_url =
        this.baseUrl + `get_replay_file_content?file_name=replay-${this.counter}.txt`;
        console.log("updating", this.counter, next_replay_url);
        
        
        let current_counter = this.counter;
        fetch(next_replay_url)
        .then((response) => {
            if (!response.ok) {
                return Promise.reject(response);
            }
            return response.json();
        })
        .then((data) => {
            console.log("Success", current_counter);

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
            if ((index >= 0) && (index < this.organisedData.length)) {
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
    let gameInfo = new GameInfo(baseUrl);
    let game = new Game("gui", gameInfo, { height: 700, width: 1100 });
}
