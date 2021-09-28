#!/usr/bin/node

// time osmium export --progress -x print_record_separator=false -f geojsonseq ../data/osm/germany-latest.osm.pbf | node geojson2geobin.js > germany.geobuf.br

"use strict"

const zlib = require('zlib');
const river = require('mississippi-promise');
river.split = river.split.default;

const types = ['Point'];
const typeLookup = Object.fromEntries(types.map((t,i) => [t,i]));

start();

function start() {

	river.pipe(
		process.stdin,
		river.split('\n'),
		river.through(async function(chunk) {

			let header = Buffer.allocUnsafe(4);
			header.writeUInt32LE(chunk.length, 0);
			this.push(header);

			return chunk;
		}),
		zlib.createBrotliCompress({params:{ [zlib.constants.BROTLI_PARAM_QUALITY]:3 }}),
		process.stdout
	)
}
