"use strict"

const river = require('mississippi-promise');

const maxBufferSize = 16*1024*1024;

module.exports = {
	BitStreamWriter,
}

function ItemFileWriter(filename) {

	let pipeline = river.pipeline(
		getBlockCompressor(),
		fs.createWriteStream(filename),
	)

	return { write, end }

	function write(buf) {
		return new Promise(res => pipeline.write(buf,res));
	}

	function end() {
		return new Promise(res => pipeline.end(res));
	}
}


function BitStreamWriter(opt) {

	return river.pipeline(
		getSplitter(),
		getBlockCompressor(),
	)
}

function getSplitter(delimiter = '\n') {
	let buffers = [];
	let bufferSize = 0;

	return river.through.obj(
		async function(chunk) {
			if (bufferSize > maxBufferSize) {
				let index = chunk.indexOf(delimiter);
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


function getBlockCompressor(concurrent, quality = 5) {
	concurrent = concurrent || os.cpus().length;
	return river.parallel(
		concurrent,
		function each(chunk) {
			return new Promise(resolve => {
				zlib.brotliCompress(
					chunk,
					{ params: {
						[zlib.constants.BROTLI_PARAM_SIZE_HINT]: chunk.length,
						[zlib.constants.BROTLI_PARAM_QUALITY]: quality,
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
	)
}
