"use strict"


const fs = require('fs');
const zlib = require('zlib');
module.exports = BufferHashMap;

function BufferHashMap(opt) {
	const headerSize = 256;
	let indexCount, valueBytes, entrySize;
	let bufferDatabase;

	if (typeof opt === 'string') {
		return loadBufferHashMap(opt);
	} else {
		return createBufferHashMap(opt);
	}

	function createBufferHashMap(opt) {
		// buffer: [ indexed area ] [ linked area ]
		//	entry: [ 4 bytes int pointer ] [ value bytes ]

		if (!(indexCount = opt.indexCount)) throw Error('indexCount is missing');
		if (!(valueBytes = opt.valueBytes)) throw Error('valueBytes is missing');
		entrySize = valueBytes+4;

		const maxEntryCount = Math.floor(indexCount*3);
		const maxDataSize = maxEntryCount*entrySize;

		let linkedAreaIndex = indexCount*entrySize;

		bufferDatabase = Buffer.alloc(maxDataSize);

		let me = { set, save, isFull:false };
		return me;

		function set(hash, bufferValue) {
			if (hash >= indexCount) throw Error();
			if (bufferValue.length !== valueBytes) throw Error();

			let index = hash*entrySize;

			while (true) {

				let status = bufferDatabase.readInt32LE(index);

				if (status < 0) {
					//console.log('create point')
					bufferDatabase.writeInt32LE(linkedAreaIndex, index);
					index = linkedAreaIndex;
					linkedAreaIndex += entrySize;

					if (linkedAreaIndex >= maxDataSize) me.isFull = true;
				}
				if (status <= 0) {
					//console.log('write')
					index = bufferDatabase.writeInt32LE(-1, index);
					bufferValue.copy(bufferDatabase, index);
					return
				} else {
					// jump
					index = status;
				}
			}
		}

		function save(filename) {
			fs.writeFileSync(filename, zlib.brotliCompressSync(bufferDatabase, { params: {
				[zlib.constants.BROTLI_PARAM_SIZE_HINT]: bufferDatabase.length,
				[zlib.constants.BROTLI_PARAM_QUALITY]: 1,
			}}));
			return bufferDatabase.length;
		}
	}

}