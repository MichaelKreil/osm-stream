#!/bin/bash
set -e
cd "$(dirname "$0")"

mkdir -p ../data/2_geobin/

osmium export --progress -x print_record_separator=false -f geojsonseq ../data/1_osm/liechtenstein-latest.osm.pbf | node geojson2geobin.js > ../data/2_geobin/liechtenstein.geobuf.br
osmium export --progress -x print_record_separator=false -f geojsonseq ../data/1_osm/berlin-latest.osm.pbf | node geojson2geobin.js > ../data/2_geobin/berlin.geobuf.br
osmium export --progress -x print_record_separator=false -f geojsonseq ../data/1_osm/germany-latest.osm.pbf | node geojson2geobin.js > ../data/2_geobin/germany.geobuf.br
osmium export --progress -x print_record_separator=false -f geojsonseq ../data/1_osm/europe-latest.osm.pbf | node geojson2geobin.js > ../data/2_geobin/europe.geobuf.br
