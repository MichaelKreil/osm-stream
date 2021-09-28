#!/usr/bin/node

"use strict"

const fs = require('fs');
const zlib = require('zlib');
const river = require('mississippi-promise');
const os = require('os');
river.split = river.split.default;

const maxBufferSize = 16*1024*1024;

river.pipe(
	process.stdin,
	splitter(),
	river.parallel(
		os.cpus().length,
		function each(chunk) {
			return new Promise(resolve => {
				//console.error(chunk.length);
				zlib.brotliCompress(
					chunk,
					{ params: {
						[zlib.constants.BROTLI_PARAM_SIZE_HINT]: chunk.length,
						[zlib.constants.BROTLI_PARAM_QUALITY]: 5,
					} },
					(err,buffer) => {
						let header = Buffer.allocUnsafe(4);
						header.writeUInt32LE(chunk.length, 0);
						buffer = Buffer.concat([header, buffer]);

						resolve(buffer);
					},
				)
			})
		}
	),
	process.stdout
)

function splitter() {
	let buffers = [];
	let bufferSize = 0;

	return river.through.obj(
		async function(chunk) {
			if (bufferSize > maxBufferSize) {
				let index = chunk.indexOf(10);
				if (index >= 0) {
					buffers.push(chunk.slice(0,index));
					this.push(Buffer.concat(buffers));

					chunk = chunk.slice(index+1);
					buffers = [];
					bufferSize = 0;
				}
			}

			buffers.push(chunk);
			bufferSize += chunk.length;
		},
		async function() {
			if (buffers.length > 0) return Buffer.concat(buffers);
		}
	)
}
