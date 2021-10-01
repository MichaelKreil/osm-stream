"use strict"

const fs = require('fs');
const river = require('mississippi-promise');
const parseOSM = require('osm-pbf-parser');

module.exports = { Reader }

function Reader(filename, cbItem) {
	const osm = parseOSM();
	const size = fs.statSync(filename).size;
	let pos = 0;


	return new Promise(resolve => {
		fs.createReadStream(filename)
			.pipe(river.through(async buf => {
				pos += buf.length;
				return buf;
			}))
			.pipe(osm)
			.pipe(river.through.obj(
				async items => {
					for (let item of items) await cbItem(item, pos/size);
				},
				async () => resolve()
			))
	})
}


