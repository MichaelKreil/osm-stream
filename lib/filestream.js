"use strict"

const fs = require('fs');
const zlib = require('zlib');
const river = require('mississippi-promise');

module.exports = {
	FileStreamWriter,
	FileStreamReader,
}

function FileStreamWriter(filename, level = 1) {
	let pipeline = fs.createWriteStream(filename);

	if (filename.endsWith('.gz')) pipeline = river.pipeline( zlib.createGzip({level}), pipeline );

	return { write, end }

	function write(buf) {
		return new Promise(res => pipeline.write(buf,res));
	}

	function end() {
		return new Promise(res => pipeline.end(res));
	}
}

function FileStreamReader(filename) {
	return {}
}
