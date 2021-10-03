"use strict"


const fs = require('fs');
const zlib = require('zlib');
module.exports = BufferHashMap;

function BufferHashMap(opt) {
	const headerSize = 12;
	let indexCount, entryCount, valueBytes;
	let bufferDatabase;

	if (typeof opt === 'string') {
		return loadBufferHashMap(opt);
	} else {
		return createBufferHashMap(opt);
	}

	function loadBufferHashMap(filename) {
		let lookup, values;

		init();

		return { get };

		function init() {
			let buffer = fs.readFileSync(filename);
			buffer = zlib.brotliDecompressSync(buffer);

			indexCount = buffer.readUInt32LE(indexCount, 0);
			entryCount = buffer.readUInt32LE(entryCount, 4);
			valueBytes = buffer.readUInt32LE(valueBytes, 8);

			const lookupSize = (4+2)*indexCount;
			const valuesSize = entryCount*valueBytes;

			lookup = buffer.slice(headerSize, headerSize+lookupSize);
			values = buffer.slice(headerSize+lookupSize, headerSize+lookupSize+valuesSize);
		}

		function get(hash) {
			let lookupIndex = hash*6;
			let valueCount = buffer.writeUInt16LE(lookupIndex);
			let valueIndex = buffer.readUInt32LE(lookupIndex+2);
			console.log(valueCount, valueIndex);
			return values.slice(valueIndex*valueBytes, (valueIndex+valueCount)*valueBytes);
		}
	}

	function createBufferHashMap(opt) {
		// buffer: [ indexed area ] [ linked area ]
		//	entry: [ 4 bytes int pointer ] [ value bytes ]
		entryCount = 0;

		if (!(indexCount = opt.indexCount)) throw Error('indexCount is missing');
		if (!(valueBytes = opt.valueBytes)) throw Error('valueBytes is missing');
		let entrySize = valueBytes+4;

		const maxEntryCount = Math.floor(indexCount*3);
		const maxDataSize = maxEntryCount*entrySize;

		let linkedAreaIndex = indexCount*entrySize;

		bufferDatabase = Buffer.alloc(maxDataSize);

		const me = { set, save, isFull:false };
		return me;

		function set(hash, bufferValue) {
			if (hash >= indexCount) throw Error();
			if (bufferValue.length !== valueBytes) throw Error();

			let dbIndex = hash*entrySize;

			while (true) {

				let status = bufferDatabase.readInt32LE(dbIndex);

				if (status < 0) {
					//console.log('create point')
					bufferDatabase.writeInt32LE(linkedAreaIndex, dbIndex);
					dbIndex = linkedAreaIndex;
					linkedAreaIndex += entrySize;

					if (linkedAreaIndex >= maxDataSize) me.isFull = true;
				}

				if (status <= 0) {
					//console.log('write')
					dbIndex = bufferDatabase.writeInt32LE(-1, dbIndex);
					bufferValue.copy(bufferDatabase, dbIndex);
					entryCount++;
					return
				} else {
					// jump
					dbIndex = status;
				}
			}
		}

		function save(filename) {
			// buffer: [ header ] [ lookup ] [ values ]

			const lookupSize = (4+2)*indexCount;
			const valuesSize = entryCount*valueBytes;
			let buffer = Buffer.allocUnsafe(headerSize + lookupSize + valuesSize);

			// write header
			let index = 0;
			index = buffer.writeUInt32LE(indexCount, index);
			index = buffer.writeUInt32LE(entryCount, index);
			index = buffer.writeUInt32LE(valueBytes, index);

			// write index and values
			let valueIndex = 0;
			for (let i = 0; i < indexCount; i++) {
				let lookupIndex = headerSize + 6*i;
				buffer.writeUInt32LE(valueIndex, lookupIndex+2);

				let valueCount = 0;
				let dbIndex = i*entrySize;
				while (true) {
					let status = bufferDatabase.readInt32LE(dbIndex);

					if (status === 0) break;

					bufferDatabase.copy(buffer, headerSize + lookupSize + valueIndex*valueBytes, dbIndex+4, dbIndex+4+valueBytes);
					valueIndex++;
					valueCount++;

					if (status < 0) break;
					dbIndex = status;
				}

				buffer.writeUInt16LE(valueCount, lookupIndex);
			}
			
			//fs.writeFileSync(filename+'.raw', buffer);

			buffer = zlib.brotliCompressSync(buffer, { params: {
				[zlib.constants.BROTLI_PARAM_SIZE_HINT]: bufferDatabase.length,
				[zlib.constants.BROTLI_PARAM_QUALITY]: 1,
			}})
			fs.writeFileSync(filename, buffer);
			return buffer.length;
		}
	}

}