"use strict"


osmium export -f geojsonseq liechtenstein-latest.osm.pbf | geojson2geobin.js

/*
const fs = require('fs');
const through2 = require('through2');
const level = require('level');
const parseOSM = require('osm-pbf-parser');
const yaml = require('js-yaml');

const { resolve } = require('path');

const filename = resolve(__dirname, '../data/osm/liechtenstein-latest.osm.pbf');

let dbNodes = FastDB('nodes');
let dbWays = FastDB('ways');
let dbRelations = FastDB('relations');
let findTable = TableFinder();

start();

async function start() {

	let parser;
	let type = 'null';

	const osm = parseOSM();

	return new Promise(resolve => {
		let size = fs.statSync(filename).size;
		let pos = 0;
		fs.createReadStream(filename)
			.pipe(through2(function (buf, enc, cb) {
				pos += buf.length;
				process.stdout.write('\rscan '+(100*pos/size).toFixed(1)+'%');
				cb(null, buf);
			}))
			.pipe(osm)
			.pipe(through2.obj(
				async function (items, enc, cb) {
					for (let item of items) {
						if (item.type === type) {
							await parser.add(item);
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
		let lat = Math.round(node.lat*1e7)/1e7;
		let lon = Math.round(node.lon*1e7)/1e7;

		await dbNodes.set(node.id, [lon,lat]);

		let table;
		if (!(table = findTable('point', node))) return;
		addGeoJSON(table, 'Point', [lon,lat], node.tags);
	}

	async function flush() {
		await dbNodes.flush()
	}

	return {add, flush}
}

function parseWays() {
	async function add(way) {
		await dbWays.set(way.id, way.refs);

		let table;
		if (way.tags.area === 'yes') {
			if (!(table = findTable('polygon', way))) return;
			try {
				addGeoJSON(table, 'Polygon', [await wayRefs2Ring(way.refs)], way.tags);
			} catch (e) {}
		} else {
			if (!(table = findTable('linestring', way))) return;
			try {
				addGeoJSON(table, 'Linestring', await wayRefs2LineString(way.refs), way.tags);
			} catch (e) {}
		}
	}

	async function flush() {
		await dbWays.flush();
	}

	return {add, flush}
}

function parseRelations() {
	async function add(rel) {
		await dbRelations.set(rel.id, rel);
	}

	async function flush() {
		await dbRelations.flush();

		let table;
		dbRelations.forEach(async rel => {
			switch (rel.tags.type) {
				case 'collection':
				case 'network':
				case 'route_master':
				case 'public_transport':
				case 'restriction':
				case 'route':
				case 'site':
				case 'destination_sign':
				case 'associatedStreet':

				case 'waterway':
					//ignore
				return;
				case 'multilinestring':
					//if (!(table = findTable('linestring', rel))) return;
					//console.log(rel);
					//addGeoJSON(table, 'MultiLineString', path, rel.tags);
				return;
				case 'multipolygon':
					if (!(table = findTable('polygon', rel))) return;

					let path = rel.members;
					console.log(rel);
					await Promise.all(path.map(async p => {
						if (p.type !== 'way') throw Error(JSON.stringify(p));

						let ids = await dbWays.get(p.id);
						let ring = await wayRefs2Ring(ids);
						console.log(ring);
						process.exit();

		//let path = await Promise.all(way.refs.map(id => dbNodes.get(id)));
					}))

					addGeoJSON(table, 'MultiPolygon', path, rel.tags);
				return;
				case 'boundary':
					//if (!(table = findTable('polygon', rel))) return;

					//console.log(rel);
					//addGeoJSON(table, 'MultiPolygon', path, rel.tags);
				return
				default:
					return;
			}

			console.log('unknown type'+rel.tags.type);
			//console.log(rel);
			//process.exit();
		})
	}

	return {add, flush}
}

async function wayRefs2LineString(ids) {
	return await Promise.all(ids.map(id => dbNodes.get(id)));
}

async function wayRefs2Ring(ids) {
	// ensure first === last
	if (ids[0] !== ids[ids.length-1]) ids.push(ids[0]);
	return await Promise.all(ids.map(id => dbNodes.get(id)));
}

function addGeoJSON(table, type, coordinates, properties) {

}

function TableFinder() {
	let tables = [];
	let tableFinder = {
		polygon:[],
		linestring:[],
		point:[],
	}

	let scheme = yaml.load(fs.readFileSync(resolve(__dirname, '../data/mapping.yml')));
	for (const [tableName, table] of Object.entries(scheme.tables)) {
		table.name = tableName;
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

	return function findTable(type, obj) {
		let tags = obj.tags;
		if (Object.keys(tags).length === 0) return false;

		let tagList = tableFinder[type];
		if (!tagList) throw Error(type);

		for (let tagEntry of tagList) {
			let value = tags[tagEntry.tag];
			if (!value) continue;

			if (tagEntry.table) return tagEntry.table;

			let table = tagEntry.tables.get(value);
			if (table) return table;
		}

		return false;
	}
}

function FastDB(name) {
	let ops = [];
	const db = level(resolve(__dirname, '../temp/'+name), {keyEncoding:'ascii', valueEncoding:'json'});

	return { get, set, forEach, flush };
	
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

	async function forEach(cb) {
		let stream = db.createValueStream();
		for await (let value of stream) {
			await cb(value);
		}
	}
}
*/