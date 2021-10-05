#!/bin/bash
set -e
cd "$(dirname "$0")"

node 1_parse_pbf.js
bash 2_sort_way_refs.sh
node 3_merge_nodes_into_wayrefs.js
bash 4_sort_way_nodes.sh
node 5_generate_paths.js
