var fs = require('fs');
var Dota2Api = require('dota2-api');
var dota = Dota2Api.create('960A12EECBBFD5E09B15986AFA0B790F');
var globalOptions = {
	// howMany: 14000, // how many matches to grab
	// how many matches to grab
	howMany: 250,
	// very high skill
	maxSkillLevel: 3,
	// Game Modes: https://github.com/joshuaduffy/dota2api/blob/master/dota2api/ref/modes.json
	// all-pick and captains mode / draft (and all pick again?)
	gameModes: [1, 2, 16, 22]
};
var soFar = 0; // how many matches we've collected so far

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

function getDetailsForMatch(matchSummary) {
	var options = {
		match_id: matchSummary.match_id
	};

	dota.getMatchDetails(options, function(err, response) {
		if (err) {
			console.error(err);
		}

		try {
			var result = JSON.parse(response)
			var match = result.result;

			if (isValidMatch(match)) {
				fs.appendFileSync("./match-ids.txt", match.match_id + "\r\n");
			}
		} catch(e) {}
	});
}

function getDetailsForMatches(matches) {
	for (var i = 0; i < matches.length; i++) {
		getDetailsForMatch(matches[i]);
	}
}

function getMatchHistory(startId, cb) {
	var options = {
		start_at_match_id: startId,
		skill: globalOptions.maxSkillLevel
	};

	dota.getMatchHistory(options, function(err, result) {
		if (err) {
			console.error(err);
		}

		try {
			var matchHistory = JSON.parse(result).result;

			cb(matchHistory);
		} catch (e) {
			getMatchHistory(startId, cb);

		}
	});
}

function getMatches(howMany) {
	function recursiveMatchHistory(matchHistory) {
		// Get the last returned match and subtract one to pick up from.
		var startId = matchHistory.matches[matchHistory.matches.length - 1].match_id - 1;
		getDetailsForMatches(matchHistory.matches);
		soFar += matchHistory.num_results;

		if (soFar < howMany) {
			getMatchHistory(startId, recursiveMatchHistory);
		}
	}

	getMatchHistory(null, recursiveMatchHistory);
}

function start() {
	fs.writeFileSync("./match-ids.txt", ""); // clear the match ids
	getMatches(globalOptions.howMany);
}

start();