"use strict"

const { resolve } = require('path');

const { } = require('../lib/number-converter.js');
const { FileStreamReader, FileStreamWriter } = require('../lib/filestream.js');

const folderResult = resolve(__dirname, '../data/2_process');
const geoOffset = 0x80000000;


console.log('5. generate paths');

(async function () {
	let fileWays     = new FileStreamReader(resolve(folderResult, 'temp_ways.json.gz'));
	let fileWayNodes = new FileStreamReader(resolve(folderResult, 'temp_way_nodes2.txt.gz'), true);
	let fileWayPaths = new FileStreamWriter(resolve(folderResult, 'way.json.gz'));
	let pathDB = new FastDB('paths')

	let node = {}, way = {}, stillProcessing = true;

	await readNode();
	await readWay();

	while (stillProcessing) {
		if (node.wayId === way.id) {
			way.path[node.index] = [node.lon, node.lat];
			way.nodeCount++;

			if (way.nodeCount < way.len) {
				await readNode();
				continue;
			}

			// save way
			delete way.len;
			delete way.nodeCount;
			
			await fileWayPaths.write(JSON.stringify(way)+'\n')
			await pathDB.set(way.id.toFixed(0), way.path);

			await readNode();
			await readWay();
			continue;
		}

		if (node.wayId > way.id) {
			// not enough nodes: ignore way (ig norway)
			await readWay();
			continue;
		}

		console.log(node, way);
		throw Error();
	}

	await fileWayPaths.end();
	await pathDB.flush();

	async function readNode() {
		let buf = await fileWayNodes.read();
		if (!buf) return stillProcessing = false;

		node.wayId =  buf.readUIntHex(10, 0);
		node.index =  buf.readUIntHex( 4,10);
		node.lon   = (buf.readUIntHex( 8,14) - geoOffset)/1e7;
		node.lat   = (buf.readUIntHex( 8,22) - geoOffset)/1e7;
	}

	async function readWay() {
		let buf = await fileWays.read();
		if (!buf) return stillProcessing = false;

		way = JSON.parse(buf);
		way.path = [];
		way.nodeCount = 0;
	}
})()


function FastDB(name) {
	const level = require('level');

	let ops = [];
	const db = level(resolve(__dirname, '../temp/'+name), {keyEncoding:'ascii', valueEncoding:'json'});

	return { get, set, forEach, flush };
	
	async function set(key, value) {
		ops.push({ type:'put', key, value });
		if (ops.length > 1e4) await flush();
	}

	async function flush() {
		await db.batch(ops);
		ops = [];
	}
	
	async function get(id) {
		return db.get(id);
	}

	async function forEach(cb) {
		let stream = db.createValueStream();
		for await (let value of stream) {
			await cb(value);
		}
	}
}
