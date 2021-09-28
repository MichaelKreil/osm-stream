#!/bin/bash
set -e
cd "$(dirname "$0")"

mkdir -p ../data/2_geobin/

wget -nc -P ../data/1_osm "https://download.geofabrik.de/europe/liechtenstein-latest.osm.pbf"
wget -nc -P ../data/1_osm "https://download.geofabrik.de/europe/germany/berlin-latest.osm.pbf"
wget -nc -P ../data/1_osm "https://download.geofabrik.de/europe/germany-latest.osm.pbf"
wget -nc -P ../data/1_osm "https://download.geofabrik.de/europe-latest.osm.pbf"
wget -nc -P ../data/1_osm "https://ftp5.gwdg.de/pub/misc/openstreetmap/planet.openstreetmap.org/pbf/planet-latest.osm.pbf"

osmium export --progress -r -f geojsonseq ../data/1_osm/liechtenstein-latest.osm.pbf | node geojson2geobin.js > ../data/2_geobin/liechtenstein.geobin
osmium export --progress -r -f geojsonseq ../data/1_osm/berlin-latest.osm.pbf | node geojson2geobin.js > ../data/2_geobin/berlin.geobin
osmium export --progress -r -f geojsonseq ../data/1_osm/germany-latest.osm.pbf | node geojson2geobin.js > ../data/2_geobin/germany.geobin
osmium export --progress -r -f geojsonseq ../data/1_osm/europe-latest.osm.pbf | node geojson2geobin.js > ../data/2_geobin/europe.geobin
osmium export --progress -r -f geojsonseq ../data/1_osm/planet-latest.osm.pbf | node geojson2geobin.js > ../data/2_geobin/planet.geobin
