"use strict"

const fs = require('fs');
const { resolve } = require('path');

const osm = require('../lib/osm.js');
const { Int2Buf, Buf2Int, ArrayInt2Buf, ArrayBuf2Int } = require('../lib/number-converter.js');
const BufferHashMap = require('../lib/buffer-hash-map.js');

const idMaxByteCount = 6;
const geoOffset = 0x80000000;
const hashCount = (1 << 24);
const valueBytes = idMaxByteCount + 2*4;

const filename = resolve(__dirname, '../data/1_osm/europe-latest.osm.pbf');
const folderHashmap = resolve(__dirname, '../data/2_process');
const folderGeoJSON = resolve(__dirname, '../data/3_geojson')
const filenameNodesResult = resolve(folderHashmap, 'node-hashmap.json');

fs.mkdirSync(folderHashmap, {recursive:true});
fs.mkdirSync(folderGeoJSON, {recursive:true});

start();

async function start() {
	let dbWays = FastDB('ways');
	let dbRelations = FastDB('relations');
	let tables = TableFinder();

	let parser;
	let lastType = 'null';
	let progressBar = new ProgressBar();

	await osm.Reader(
		filename,
		async (item, progress) => {
			if (item.type === lastType) {
				try {
					if (parser) await parser.add(item);
				} catch (e) {
					if (e.name === 'NotFoundError') return;
					throw e;
				}
			} else {
				if (parser) await parser.flush();

				let key = lastType + '->' + item.type;
				switch (key) {
					case 'null->node':    parser = parseNodes();     break;
					case 'node->way':     parser = parseWays();      break;
					case 'way->relation': parser = false;/*parseRelations();*/ break;
					default: throw Error(key);
				}
				lastType = item.type;
			}

			progressBar.update(progress, `scan ${lastType}s`)
		}
	)

	progressBar.finish();

	if (parser) await parser.flush();

	await tables.close();



	function parseNodes() {
		const value = Buffer.allocUnsafe(valueBytes);

		let lastId = -1;
		let hashmap, minId, maxId;
		let hashmapList = [];

		async function add(node) {
			let id = node.id;

			if (lastId >= (lastId = id)) throw Error(); // ensure in ascending order

			if (!hashmap || hashmap.isFull) {
				flushHashmap();
				hashmap = new BufferHashMap({ indexCount: hashCount, valueBytes });
			}

			let index = value.writeUInt48LE(id, 0);
			index = value.writeUInt32LE(Math.round(node.lon*1e7) + geoOffset, index);
			index = value.writeUInt32LE(Math.round(node.lat*1e7) + geoOffset, index);

			hashmap.set(id % hashCount, value);

			if (id < minId) minId = id;
			if (id > maxId) maxId = id;

			let table = tables.find('point', node);
			if (!table) return;
			await addGeoJSON(table, 'Point', [node.lon, node.lat], node.tags);
		}

		async function flush() {
			flushHashmap();
			fs.writeFileSync(filenameNodesResult, JSON.stringify(hashmapList, null, '\t'))
		}

		return {add, flush}

		function flushHashmap() {
			if (hashmap) {
				let filename = resolve(folderHashmap, ['nodes', minId, maxId].join('-')+'.bin');
				let size = hashmap.save(filename);
				hashmapList.push({ minId, maxId, filename, size });
			}
			minId =  1e20;
			maxId = -1e20;
		}
	}

	function parseWays() {
		let nodeHashmapList = JSON.parse(fs.readFileSync(filenameNodesResult));

		let wayBuffer = [];
		let nodeBuffer = [];

		async function add(way) {
			way.refs = way.refs.map(id => {
				let point = [id, way];
				nodeBuffer.push(point);
				return point;
			})
			wayBuffer.push(way);
			if (nodeBuffer.length > 3e7) await processWayBuffer();
		}

		async function flush() {
			if (nodeBuffer.length > 0) await processWayBuffer();
		}

		return {add, flush}

		async function processWayBuffer() {
			console.log('processWayBuffer', wayBuffer.length, nodeBuffer.length);
			nodeBuffer = nodeBuffer.sort((a,b) => a[0]-b[0]);

			let hashmapIndex = 0;
			let hashmap = loadHashmap(hashmapIndex);
			nodeBuffer.forEach(e => {
				if (e[1].ignore) return;

				let id = e[0];

				if (id > hashmap.maxId) {
					hashmapIndex++;
					hashmap = loadHashmap(hashmapIndex);
				}

				let buf = hashmap.get(id % hashCount);
				if (buf) {
					let index = 0;
					while (index < buf.length) {
						let dbId = buf.readUInt48LE(index);
						if (id === dbId) {
							e[0] = (buf.readUInt32LE(index+ 6) - geoOffset)/1e7;
							e[1] = (buf.readUInt32LE(index+10) - geoOffset)/1e7;
							return;
						}
						index += 14;
					}
				}

				e[1].ignore = true;
			})

			for (let way of wayBuffer) {
				if (way.ignore) continue

				let table;
				if (way.tags.area === 'yes') {
					if (!(table = tables.find('polygon', way))) continue;
					await addGeoJSON(table, 'Polygon', [way.refs], way.tags);
				} else {
					if (!(table = tables.find('linestring', way))) continue;
					await addGeoJSON(table, 'Linestring', way.refs, way.tags);
				}

			}

			wayBuffer = [];
			nodeBuffer = [];

			function loadHashmap(index) {
				console.log('loadHashmap', index);
				let entry = nodeHashmapList[index];
				let hashmap = new BufferHashMap(entry.filename);
				hashmap.minId = entry.minId;
				hashmap.maxId = entry.maxId;
				return hashmap;
			}
		}
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
		if (speed === 'none') return 500;
		return false;
	})
	//console.log(maxSpeed);
	maxSpeed = maxSpeed.filter(s => s);
	//console.log(maxSpeed);
	if (maxSpeed.length === 0) return;

	maxSpeed = Math.max(...maxSpeed);
	//properties.maxSpeed = maxSpeed;
	if (maxSpeed <= 30) return;

	properties = { maxSpeed:maxSpeed, highway:properties.highway };

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
	let closed = false;

	let scheme = yaml.load(fs.readFileSync(resolve(__dirname, '../data/mapping.yml')));
	for (const [tableName, table] of Object.entries(scheme.tables)) {
		table.name = tableName;

		if (table.filter) {
			if (table.filter.require) table.filter.require = makeFilter(table.filter.require);
			if (table.filter.reject ) table.filter.reject  = makeFilter(table.filter.reject );
		}

		table.filename = resolve(folderGeoJSON, table.name+'.geojsonseq');
		table.file = fs.openSync(table.filename, 'w');

		let writeBuffer = [];
		table.write = async text => {
			writeBuffer.push(text);
			if (writeBuffer.length > 1000) await table.flush();
		}
		table.flush = async () => {
			if (closed) throw Error('already closed');
			if (writeBuffer.length === 0) return;
			fs.writeSync(table.file, writeBuffer.join(''));
			writeBuffer = [];
		}
		table.close = async () => {
			if (closed) throw Error('already closed');
			await table.flush();
			fs.closeSync(table.file)
			closed = true;
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


function ProgressBar() {
	let lastProgress = -1;
	let progressEntries = [];
	return { update, finish }

	function update(progress, status) {
		if (progress === lastProgress) return;

		let timeLeft = '';
		let time = Date.now();
		progressEntries.push([progress, time]);

		if (progressEntries.length > 10) {

			let speed = (time-progressEntries[0][1])/(progress-progressEntries[0][0]);

			timeLeft = Math.round(speed*(1-progress)/1000);
			timeLeft = ' - '+[
				Math.floor(timeLeft/3600),
				(100+Math.floor(timeLeft/60) % 60).toFixed(0).slice(1),
				(100+timeLeft % 60).toFixed(0).slice(1),
			].join(':');

			if (progressEntries.length > 200) progressEntries = progressEntries.slice(-100);
		}

		let progressString = (100*progress).toFixed(2);

		process.stdout.write(`\r${status} - ${progressString}%${timeLeft} `);

		lastProgress = progress;
	}

	function finish() {
		process.stdout.write('- Finished\n');
	}
}