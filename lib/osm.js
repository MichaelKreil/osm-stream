"use strict"

const fs = require('fs');
const river = require('mississippi-promise');
const parseOSM = require('osm-pbf-parser');

module.exports = { Reader }

function Reader(filename, cbItem) {
	const osm = parseOSM();
	const size = fs.statSync(filename).size;
	let stop, resume, pos = 0;


	return new Promise(resolve => {
		fs.createReadStream(filename)
			.pipe(river.through(async buf => {
				pos += buf.length;

				if (stop) {
					await new Promise(res => resume = res)
					resume = false;
				}
				
				return buf;
			}))
			.pipe(osm)
			.pipe(river.through.obj(
				async items => {
					stop = true;
					for (let item of items) await cbItem(item, pos/size);
					stop = false;
					if (resume) resume();
				},
				async () => resolve()
			))
	})
}


