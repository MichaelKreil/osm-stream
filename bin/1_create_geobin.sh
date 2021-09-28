#!/bin/bash
set -e
cd "$(dirname "$0")"

mkdir -p ../data/2_geobin/

wget -nc "https://download.geofabrik.de/europe/liechtenstein-latest.osm.pbf"
wget -nc "https://download.geofabrik.de/europe/germany/berlin-latest.osm.pbf"
wget -nc "https://download.geofabrik.de/europe/germany-latest.osm.pbf"
wget -nc "https://download.geofabrik.de/europe-latest.osm.pbf"

osmium export --progress -r -f geojsonseq ../data/1_osm/liechtenstein-latest.osm.pbf | node geojson2geobin.js > ../data/2_geobin/liechtenstein.geobuf.br
osmium export --progress -r -f geojsonseq ../data/1_osm/berlin-latest.osm.pbf | node geojson2geobin.js > ../data/2_geobin/berlin.geobuf.br
osmium export --progress -r -f geojsonseq ../data/1_osm/germany-latest.osm.pbf | node geojson2geobin.js > ../data/2_geobin/germany.geobuf.br
osmium export --progress -r -f geojsonseq ../data/1_osm/europe-latest.osm.pbf | node geojson2geobin.js > ../data/2_geobin/europe.geobuf.br
