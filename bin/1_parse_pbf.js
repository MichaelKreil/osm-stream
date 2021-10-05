"use strict"

const fs = require('fs');
const { resolve } = require('path');

const osm = require('../lib/osm.js');
const ProgressBar = require('../lib/progressbar.js');
const { } = require('../lib/number-converter.js');
const { FileStreamWriter } = require('../lib/filestream.js');



const filenamePbf = resolve(__dirname, '../data/1_osm/berlin-latest.osm.pbf');
const folderResult = resolve(__dirname, '../data/2_process');
const geoOffset = 0x80000000;

fs.mkdirSync(folderResult, {recursive:true});



(async function () {
	const fileNodesHex  = new FileStreamWriter(resolve(folderResult, 'temp_nodes.txt.gz'));
	const fileNodesJSON = new FileStreamWriter(resolve(folderResult, 'nodes.json.gz'));
	const fileWaysHex   = new FileStreamWriter(resolve(folderResult, 'temp_way_refs1.txt.gz'));
	const fileWaysJSON  = new FileStreamWriter(resolve(folderResult, 'temp_ways.json.gz'));
	const fileRefsJSON  = new FileStreamWriter(resolve(folderResult, 'refs.json.gz'));

	let parser;
	let lastType = 'null';
	let progressBar = new ProgressBar();

	await osm.Reader(
		filenamePbf,
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
					case 'way->relation': parser = parseRelations(); break;
					default: throw Error(key);
				}
				lastType = item.type;
			}

			progressBar.update(progress, `scan ${lastType}s`)
		}
	)

	progressBar.end();

	if (parser) await parser.flush();

	function parseNodes() {

		async function add(node) {
			let id = node.id;
			let lon = Math.round(node.lon*1e7) + geoOffset;
			let lat = Math.round(node.lat*1e7) + geoOffset;

			let buf = Buffer.allocUnsafe(27);
			buf.writeUIntHex( id,10, 0);
			buf.writeUIntHex(lon, 8,10);
			buf.writeUIntHex(lat, 8,18);
			buf[26] = 10;

			await fileNodesHex.write(buf);

			delete node.info;
			await fileNodesJSON.write(JSON.stringify(node)+'\n');
		}

		async function flush() {
			fileNodesHex.end();
			fileNodesJSON.end();
		}

		return { add, flush }
	}


	function parseWays() {

		async function add(way) {
			let id = way.id;

			for (let i = 0; i < way.refs.length; i++) {
				let ref = way.refs[i];

				let buf = Buffer.allocUnsafe(25);
				buf.writeUIntHex(ref,10, 0);
				buf.writeUIntHex(  i, 4,10);
				buf.writeUIntHex( id,10,14);
				buf[24] = 10;

				await fileWaysHex.write(buf);
			}

			way.len = way.refs.length;
			delete way.info;
			delete way.refs;
			await fileWaysJSON.write(JSON.stringify(way)+'\n');
		}

		async function flush() {
			fileWaysHex.end();
			fileWaysJSON.end();
		}

		return { add, flush }

	}


	function parseRelations() {

		async function add(rel) {
			delete rel.info;
			await fileRefsJSON.write(JSON.stringify(rel)+'\n');
		}

		async function flush() {
			fileRefsJSON.end();
		}

		return { add, flush }

	}
})()
