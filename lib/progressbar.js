"use strict"

module.exports = ProgressBar;

function ProgressBar() {
	let lastProgress = -1;
	let progressEntries = [];
	return { update, finish }

	function update(progress, status) {
		if (progress === lastProgress) return;

		let timeLeft = '';
		let time = Date.now();
		progressEntries.push([progress, time]);

		if (progressEntries.length > 10) {

			let speed = (time-progressEntries[0][1])/(progress-progressEntries[0][0]);

			timeLeft = Math.round(speed*(1-progress)/1000);
			timeLeft = ' - '+[
				Math.floor(timeLeft/3600),
				(100+Math.floor(timeLeft/60) % 60).toFixed(0).slice(1),
				(100+timeLeft % 60).toFixed(0).slice(1),
			].join(':');

			if (progressEntries.length > 200) progressEntries = progressEntries.slice(-100);
		}

		let progressString = (100*progress).toFixed(2);

		process.stdout.write(`\r${status} - ${progressString}%${timeLeft} `);

		lastProgress = progress;
	}

	function finish() {
		process.stdout.write('- Finished\n');
	}
}