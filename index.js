var fs = require('fs');
var Dota2Api = require('dota2-api');
var dota = Dota2Api.create(process.env.STEAM_API_KEY);
var globalOptions = {
	restartTime: 3.2 * 1000 * 60, // First number is how many minutes. The rest converts it to ms.
	// very high skill
	maxSkillLevel: 3,
	// Game Modes: https://github.com/joshuaduffy/dota2api/blob/master/dota2api/ref/modes.json
	// all-pick and captains mode / draft (and all pick again?)
	gameModes: [1, 2, 16, 22]
};

function isValidMatch(match) {
	// Public matchmaking
	if (match.lobby_type !== 0) {
		return false;
	}

	// 10 players
	if (match.human_players !== 10) {
		return false;
	}

	// Game mode must be valid
	var validMode = false;
	for (var i = 0; i < globalOptions.gameModes.length; i++) {
		if (globalOptions.gameModes[i] === match.game_mode) {
			validMode = true;
		}
	}
	if (!validMode) {
		return false;
	}

	// No games with disconnect / afk / abandoned players
	for (var i = 0; i < match.players.length; i++) {
		if (match.players[i].leaver_status !== 0) {
			return false;
		}
	}

	return true;
}

function getDetailsForMatch(matchSummary, cb) {
	var options = {
		match_id: matchSummary.match_id
	};

	dota.getMatchDetails(options, function(err, response) {
		if (err) {
			console.error(err);
		}

		try {
			var result = JSON.parse(response);
			var match = result.result;

			if (isValidMatch(match)) {
				fs.appendFileSync("./match-ids.txt", match.match_id + "\r\n");
			}

			cb();
		} catch (e) {
			if (response && response.indexOf('Access Denied') != -1) {
				console.error('access denied. trying again in ' + globalOptions.restartTime / 1000 / 60 + ' min');

				setTimeout(function() {
					getDetailsForMatch(matchSummary, cb);
				}, globalOptions.restartTime);

				// Cancel if we are denied access.
				// return;
			} else {
				// console.error('detail error, retrying. ' + e);
				getDetailsForMatch(matchSummary, cb);
			}
		}
	});
}

function getDetailsForMatches(matches) {
	var i = 0;

	function recursiveGetDetailsForMatch() {
		i++;

		if (matches[i] && matches[i].length) {
			getDetailsForMatch(matches[i], recursiveGetDetailsForMatch);
		}
	}

	if (matches[i] && matches[i].length) {
		getDetailsForMatch(matches[i], recursiveGetDetailsForMatch);
	}
}

function getMatchHistory(startId, cb) {
	var options = {
		start_at_match_id: startId,
		skill: globalOptions.maxSkillLevel
	};

	dota.getMatchHistory(options, function(err, response) {
		if (err) {
			console.error(err);
		}

		try {
			var matchHistory = JSON.parse(response).result;

			cb(matchHistory);

		} catch (e) {
			if (response && response.indexOf('Access Denied') != -1) {
				console.error('access denied. trying again in ' + globalOptions.restartTime / 1000 / 60 + ' min');

				setTimeout(function() {
					getMatchHistory(null, cb);
				}, globalOptions.restartTime);

				// Cancel if we are denied access.
				// return;
			}

			getMatchHistory(startId, cb);
		}
	});
}

function getMatches() {
	function recursiveMatchHistory(matchHistory) {
		// Get the last returned match and subtract one to pick up from.
		var startId = matchHistory.matches[matchHistory.matches.length - 1].match_id - 1;
		getDetailsForMatches(matchHistory.matches);

		// keep grabbing results until there's nothing to grab.
		if (matchHistory.results_remaining > 0) {
			console.log('match history remaining: ' + matchHistory.results_remaining);
			getMatchHistory(startId, recursiveMatchHistory);
		} else {
			console.log('all done for match history. restarting in ' + globalOptions.restartTime / 1000 / 60 + ' min');

			setTimeout(function() {
				getMatchHistory(null, recursiveMatchHistory);
			}, globalOptions.restartTime);
		}
	}

	getMatchHistory(null, recursiveMatchHistory);
}

function cleanUp() {
	// fs.writeFileSync("./match-ids.txt", ""); // clear the match ids
}

function start() {
	cleanUp();
	getMatches();
}

start();
