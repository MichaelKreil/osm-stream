"use strict"

const fs = require('fs');
const zlib = require('zlib');
const river = require('mississippi-promise');
const ProgressBar = require('../lib/progressbar.js');

module.exports = {
	FileStreamWriter,
	FileStreamReader,
}

function FileStreamWriter(filename, level) {
	let pipeline = fs.createWriteStream(filename);

	if (filename.endsWith('.gz')) pipeline = river.pipeline(zlib.createGzip({level:level || 1}), pipeline);

	return { write, end }

	function write(buf) {
		return new Promise(res => pipeline.write(buf,res));
	}

	function end() {
		return new Promise(res => pipeline.end(res));
	}
}

function FileStreamReader(filename, showProgress) {
	let pipeline = fs.createReadStream(filename);

	if (showProgress) {
		let progressBar = new ProgressBar();
		let size = fs.statSync(filename).size;
		let pos = 0;
		let status = filename;

		pipeline = river.pipeline(
			pipeline,
			river.through(async chunk => {
				pos += chunk.length;
				progressBar.update(pos/size, status);
				return chunk;
			}, async () => {
				progressBar.end();
			})
		);
	}

	if (filename.endsWith('.gz')) pipeline = river.pipeline(pipeline, zlib.createGunzip());

	pipeline = river.pipeline(pipeline, river.split.default());

	return { read }

	async function read() {
		try {
			return await river.pull(pipeline);
		} catch (e) {
			return false;
		}
	}
}
