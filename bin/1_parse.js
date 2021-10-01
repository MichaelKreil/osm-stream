"use strict"

const fs = require('fs');
const { resolve } = require('path');

const osm = require('../lib/osm.js');
const { Int2Buf, Buf2Int, ArrayInt2Buf, ArrayBuf2Int } = require('../lib/number-converter.js');

const filename = resolve(__dirname, '../data/1_osm/germany-latest.osm.pbf');
const idMaxByteCount = 5;
const geoOffset = 0x80000000;

start();

async function start() {
	let dbNodes = FastDB('nodes');
	let dbWays = FastDB('ways');
	let dbRelations = FastDB('relations');
	let tables = TableFinder();

	let parser;
	let type = 'null';
	let lastProgress = -1;
	let timeStart = Date.now();

	await osm.Reader(
		filename,
		async (item, progress) => {
			if (progress !== lastProgress) {
				let time = Date.now();
				time = (time-timeStart)*(1-progress)/progress;
				time = Math.round(time/1000);
				time = [
					Math.floor(time/3600),
					(100+Math.floor(time/60) % 60).toFixed(0).slice(1),
					(100+time % 60).toFixed(0).slice(1),
				].join(':')
				process.stdout.write('\rscan '+(100*progress).toFixed(2)+'% - '+time);
				lastProgress = progress;
			}

			if (item.type === type) {
				try {
					await parser.add(item);
				} catch (e) {
					if (e.name === 'NotFoundError') return;
					throw e;
				}
			} else {
				let key = type + '->' + item.type;
				switch (key) {
					case 'null->node':
						parser = parseNodes();
					break;
					case 'node->way':
						parser.flush();
						parser = parseWays();
					break;
					case 'way->relation':
						parser.flush();
						parser = parseRelations();
					break;
					default:
						throw Error(key);
				}
				type = item.type;
			}
		}
	)

	console.log();
	await parser.flush();

	await tables.close();



	function parseNodes() {
		const id2buf = Int2Buf(idMaxByteCount);
		const geo2buf = ArrayInt2Buf(4);

		async function add(node) {

			await dbNodes.set(
				id2buf(node.id),
				geo2buf([
					Math.round(node.lon*1e7) + geoOffset,
					Math.round(node.lat*1e7) + geoOffset,
				]),
			)

			let table;
			if (!(table = tables.find('point', node))) return;
			await addGeoJSON(table, 'Point', [node.lon, node.lat], node.tags);
		}

		async function flush() {
			await dbNodes.flush()
		}

		return {add, flush}
	}

	function parseWays() {
		const id2buf = Int2Buf(idMaxByteCount);
		const ids2buf = ArrayInt2Buf(idMaxByteCount);
		const buf2int = ArrayBuf2Int(4);

		async function add(way) {
			//await dbWays.set(id2buf(way.id), Buffer.concat(pointBuffers))

			let table;
			if (way.tags.area === 'yes') {
				if (!(table = tables.find('polygon', way))) return;
				let pointBuffers = await getPointBuffer();
				await addGeoJSON(table, 'Polygon', [buffer2Points(pointBuffers)], way.tags);
			} else {
				if (!(table = tables.find('linestring', way))) return;
				let pointBuffers = await getPointBuffer();
				await addGeoJSON(table, 'Linestring', buffer2Points(pointBuffers), way.tags);
			}

			async function getPointBuffer() {
				let idsBuf = ids2buf(way.refs);
				return await Promise.all(way.refs.map((id,i) => {
					let idBuf = idsBuf.slice(i*idMaxByteCount, (i+1)*idMaxByteCount)
					return dbNodes.get(idBuf);
				}));
			}

			function buffer2Points(pointBuffers) {
				return pointBuffers.map(buf => {
					let point = buf2int(buf);
					point[0] = (point[0]-geoOffset)/1e7;
					point[1] = (point[1]-geoOffset)/1e7;
					return point;
				})
			}
		}

		async function flush() {
			await dbWays.flush();
		}

		return {add, flush}
	}

	function parseRelations() {
		async function add(rel) {
			switch (rel.tags.type) {

				case 'multilinestring':
				return;
				case 'multipolygon':
				return;
			}
		}

		async function flush() {
		}

		return {add, flush}
	}
}

async function addGeoJSON(table, type, coordinates, properties) {

	let maxSpeed = [properties.maxspeed, properties['maxspeed:forward'], properties['maxspeed:backward']];
	//console.log(maxSpeed);
	maxSpeed = maxSpeed.map(speed => {
		if (!speed) return false;
		if (/^[0-9]+/.test(speed)) return parseInt(speed, 10);
		if (speed === 'walk') return 5;
		if (speed === 'none') return 300;
		return false;
	})
	//console.log(maxSpeed);
	maxSpeed = maxSpeed.filter(s => s);
	//console.log(maxSpeed);
	if (maxSpeed.length === 0) return;

	maxSpeed = Math.max(...maxSpeed);
	//properties.maxSpeed = maxSpeed;
	if (maxSpeed <= 30) return;
	properties = {maxSpeed:1000+maxSpeed};

	await table.write(JSON.stringify({
		type: 'Feature',
		properties,
		geometry: { type, coordinates },
	})+'\n');
}

function TableFinder() {
	const yaml = require('js-yaml');

	let tables = [];
	let tableFinder = {
		polygon:[],
		linestring:[],
		point:[],
	}

	let scheme = yaml.load(fs.readFileSync(resolve(__dirname, '../data/mapping.yml')));
	for (const [tableName, table] of Object.entries(scheme.tables)) {
		table.name = tableName;

		if (table.filter) {
			if (table.filter.require) table.filter.require = makeFilter(table.filter.require);
			if (table.filter.reject ) table.filter.reject  = makeFilter(table.filter.reject );
		}

		table.filename = resolve(__dirname, '../data/3_geojson/'+table.name+'.geojsonseq');
		table.file = fs.openSync(table.filename, 'w');

		let writeBuffer = [];
		table.write = async text => {
			writeBuffer.push(text);
			if (writeBuffer.length > 1000) await table.flush();
		}
		table.flush = async () => {
			if (writeBuffer.length === 0) return;
			fs.writeSync(table.file, writeBuffer.join(''));
			writeBuffer = [];
		}
		table.close = async () => {
			await table.flush();
			fs.closeSync(table.file)
		}

		tables.push(table);

		let tagList = tableFinder[table.type];
		if (!tagList) throw Error(table.type);

		for (const [tag, values] of Object.entries(table.mapping)) {
			let tagEntry = tagList.find(o => o.tag === tag);
			if (!tagEntry) tagList.push(tagEntry = {tag});

			if (values === '__any__') {
				tagEntry.table = table;
				continue;
			}

			if (!tagEntry.tables) tagEntry.tables = new Map();
			values.forEach(value => tagEntry.tables.set(value, table));
		}
	}

	return {
		find:findTable,
		close:closeTables,
	}

	async function closeTables() {
		for (let table of tables) await table.close()
	}

	function findTable(type, obj) {
		let tags = obj.tags;
		if (Object.keys(tags).length === 0) return false;

		let tagList = tableFinder[type];
		if (!tagList) throw Error(type);

		for (let tagEntry of tagList) {
			let value = tags[tagEntry.tag];
			if (!value) continue;

			if (tagEntry.table) return tagEntry.table;

			let table = tagEntry.tables.get(value);
			if (!table) continue;

			if (table.filter) {
				if (table.filter.reject  &&  table.filter.reject( obj)) continue;
				if (table.filter.require && !table.filter.require(obj)) continue;
			}

			return table;
		}

		return false;
	}

	function makeFilter(query) {
		let checks = Object.keys(query).map(key => {
			let value = query[key];
			if (value === '__any__') value = true;
			return {key, value}
		});
		return function filter(obj) {
			return checks.every(check => {
				if (check.value === true) {
					return obj.tags[check.key]
				} else {
					return (obj.tags[check.key] === check.value)
				}
			})
		}
	}
}

function FastDB(name) {
	const level = require('level');

	let ops = [];
	const db = level(resolve(__dirname, '../temp/'+name), {keyEncoding:'binary', valueEncoding:'binary'});

	return { get, set, forEach, flush };
	
	async function set(id, value) {
		ops.push({ type:'put', key:id, value });
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
