#!/usr/bin/node

"use strict"

const zlib = require('zlib');
const river = require('mississippi-promise');
river.split = river.split.default;

const maxBufferSize = 16*1024*1024;

let compressor = BrotliCompressor();
let bufferSize = 0;

river.pipe(
	process.stdin,
	river.split('\n'),
	river.through(
		async function(chunk) {
			chunk = chunk.toString()+'\n';
			await compressor.write(chunk);
			bufferSize += chunk.length;
			//console.error('bufferSize', bufferSize);

			if (bufferSize < maxBufferSize) return

			let result = await flush();
			compressor = BrotliCompressor();
			bufferSize = 0;
			return result;
		},
		async function() {
			if (bufferSize > 0) return await flush();
		}
	),
	process.stdout
)

async function flush() {
	console.error('flush');
	let buffer = await compressor.dump();
	let header = Buffer.allocUnsafe(4);
	header.writeUInt32LE(buffer.length, 0);
	console.error(buffer.length);

	return Buffer.concat([header,buffer]);
}

function BrotliCompressor(quality = 5) {
	console.error('BrotliCompressor');
	let compressor = zlib.createBrotliCompress({
		params:{
			[zlib.constants.BROTLI_PARAM_QUALITY]:quality
		}
	});
	let buffers = [];
	let toBuffer = river.to(async (data,enc) => buffers.push(data));
	compressor.pipe(toBuffer);

	return { write, dump }

	function write(chunk) {
		return new Promise(res => {
			if (compressor.write(chunk)) return res();
			compressor.once('drain', () => res());
		})
	}

	function dump(chunk) {
		return new Promise(res => {
			toBuffer.once('finish', () => res(Buffer.concat(buffers)));
			compressor.end();
		})
	}
}
