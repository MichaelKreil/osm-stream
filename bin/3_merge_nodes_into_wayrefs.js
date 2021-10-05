"use strict"

const { resolve } = require('path');

const { } = require('../lib/number-converter.js');
const { FileStreamReader, FileStreamWriter } = require('../lib/filestream.js');

const folderResult = resolve(__dirname, '../data/2_process');



(async function () {
	let fileNodes    = new FileStreamReader(resolve(folderResult, 'temp_nodes.txt.gz'));
	let fileWayRefs  = new FileStreamReader(resolve(folderResult, 'temp_way_refs2.txt.gz'), true);
	let fileWayNodes = new FileStreamWriter(resolve(folderResult, 'temp_way_nodes1.txt.gz'));

	let node = {}, way = {}, stillProcessing = true;

	await readNode();
	await readRef();

	while (stillProcessing) {
		if (node.id === way.ref) {
			// write

			let buf = Buffer.allocUnsafe(31);
			buf.writeUIntHex(way.id,  10, 0);
			buf.writeUIntHex(way.i,    4,10);
			buf.writeUIntHex(node.lon, 8,14);
			buf.writeUIntHex(node.lat, 8,22);
			buf[30] = 10;

			await fileWayNodes.write(buf);

			//await readNode();
			await readRef();
			continue;
		}

		if (node.id < way.ref) {
			await readNode();
			continue;
		}
		if (node.id > way.ref) {
			await readRef();
			continue;
		}

		console.log(node, way);
		throw Error();
	}

	await fileWayNodes.end();

	async function readNode() {
		let buf = await fileNodes.read();
		if (!buf) return stillProcessing = false;

		node.id  = buf.readUIntHex(10,0);
		node.lon = buf.readUIntHex(8,10);
		node.lat = buf.readUIntHex(8,18);
	}

	async function readRef() {
		let buf = await fileWayRefs.read();
		if (!buf) return stillProcessing = false;

		way.ref = buf.readUIntHex(10, 0);
		way.i   = buf.readUIntHex( 4,10);
		way.id  = buf.readUIntHex(10,14);
	}
})()

