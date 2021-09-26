"use strict"

const fs = require('fs');
const through2 = require('through2');
const level = require('level');
const parseOSM = require('osm-pbf-parser');

const { resolve } = require('path');

const filename = resolve(__dirname, '../data/osm/liechtenstein-latest.osm.pbf');

let dbNodes = FastDB('nodes');
let dbWays = FastDB('ways');
let dbRelations = FastDB('relations');

start();

async function start() {
	await scan('node',     parseNodes());
	await scan('way',      parseWays());
	await scan('relation', parseRelations());
}

function scan(type, parser) {
	const osm = parseOSM();

	return new Promise(resolve => {
		let size = fs.statSync(filename).size;
		let pos = 0;
		fs.createReadStream(filename)
			.pipe(through2(function (buf, enc, cb) {
				pos += buf.length;
				process.stdout.write('\rscan '+type+'s - '+(100*pos/size).toFixed(1)+'%');
				cb(null, buf);
			}))
			.pipe(osm)
			.pipe(through2.obj(
				async function (items, enc, cb) {
					for (let item of items) {
						if (item.type === type) await parser.add(item);
					}
					cb(null);
				},
				async function (cb) {
					console.log();
					await parser.flush();
					resolve()
					cb()
				}
			))
	})
}

function parseNodes() {
	async function add(node) {
		let id = node.id;
		let lat = Math.round(node.lat*1e7)/1e7;
		let lon = Math.round(node.lon*1e7)/1e7;

		await dbNodes.set(id, [lon,lat]);
	}

	async function flush() {
		await dbNodes.flush()
	}

	return {add, flush}
}

function parseWays() {
	async function add(way) {

		let id = way.id;
		let path = await Promise.all(way.refs.map(id => dbNodes.get(id)));

		await dbWays.set(id, path);
	}

	async function flush() {
		await dbWays.flush();
	}

	return {add, flush}
}

function parseRelations() {
	async function add(rel) {
		console.log(rel);
		await dbRelations.set(rel.id, rel);
	}

	async function flush() {
		await dbRelations.flush();
	}

	return {add, flush}
}


function FastDB(name) {
	let ops = [];
	const db = level(resolve(__dirname, '../temp/'+name), {keyEncoding:'ascii', valueEncoding:'json'});

	return { get, set, flush };
	
	async function set(id, value) {
		ops.push({ type:'put', key:''+id, value });
		if (ops.length > 1e4) await flush();
	}

	async function flush() {
		await db.batch(ops);
		ops = [];
	}
	
	async function get(id) {
		return db.get(''+id);
	}
}