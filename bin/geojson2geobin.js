#!/usr/bin/node

"use strict"

const zlib = require('zlib');
const river = require('mississippi-promise');
river.split = river.split.default;

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
